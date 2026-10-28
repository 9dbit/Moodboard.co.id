import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { Readable } from "node:stream";
import express from "express";
import sharp from "sharp";

process.env.DATABASE_URL = "postgresql://assets-test:unused@127.0.0.1:1/assets-test";
process.env.PRIVATE_OBJECT_DIR = "/fixture-bucket/.private";
const assets = await import("../server/assets");
const { pool } = await import("../server/db");
const { ObjectStorageService, ObjectNotFoundError, objectStorageClient } = await import("../server/replit_integrations/object_storage/objectStorage");
const { registerObjectStorageRoutes } = await import("../server/replit_integrations/object_storage/routes");
const files = new Map<string, any>();
const intents = new Map<string, any>();
const legacyOwners = new Map<string, string>();
const shares = new Map<string, { path: string; expires: number; owner?: string }>();
let savedCount = 0;
function fakeFile(name: string) {
  let file = files.get(name);
  if (!file) {
    file = { name, present: false, bytes: Buffer.alloc(0), meta: {} as any,
      exists: async () => [file.present],
      getMetadata: async () => [{ ...file.meta, size: file.bytes.length }],
      setMetadata: async (value: any) => { file.meta.metadata = { ...file.meta.metadata, ...value.metadata }; },
      save: async (buffer: Buffer, options: any) => { savedCount++; file.present = true; file.bytes = buffer; file.meta.contentType = options.contentType; file.meta.metadata = options.metadata || {}; },
      download: async () => [file.bytes], createReadStream: () => Readable.from([file.bytes]),
    };
    files.set(name, file);
  }
  return file;
}
const nativeBucket = objectStorageClient.bucket;
const nativeGet = ObjectStorageService.prototype.getObjectEntityFile;
const nativeQuery = pool.query;
const nativeConnect = pool.connect;
(objectStorageClient as any).bucket = () => ({ file: fakeFile });
ObjectStorageService.prototype.getObjectEntityFile = async (path: string) => {
  const key = `.private/${path.slice("/objects/".length)}`;
  const file = files.get(key);
  if (!file?.present) throw new ObjectNotFoundError();
  return file;
};
const query = async (sql: string, params: any[] = []) => {
  if (sql.startsWith("INSERT INTO asset_upload_intents")) {
    const [id, user_id, token_hash, declared_size, content_type, expires_at] = params;
    intents.set(id, { id, user_id, token_hash, declared_size, content_type, expires_at, consumed_at: null });
    return { rows: [] };
  }
  if (sql.startsWith("SELECT * FROM asset_upload_intents")) {
    const found = intents.get(params[0]);
    return { rows: found && found.user_id === params[1] && found.token_hash === params[2] && found.expires_at > new Date() ? [found] : [] };
  }
  if (sql.startsWith("UPDATE asset_upload_intents")) { intents.get(params[0]).consumed_at = new Date(); return { rows: [] }; }
  if (sql.includes("p.share_token=$1")) {
    const grant = shares.get(params[0]);
    return { rows: grant && grant.path === params[1] && grant.expires > Date.now() ? [{ user_id: grant.owner || "A" }] : [] };
  }
  if (sql.includes("p.user_id=$1")) return { rows: [{ allowed: legacyOwners.get(params[1]) === params[0] }] };
  if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
  throw new Error("Unexpected DB query in fixture");
};
(pool as any).query = query;
(pool as any).connect = async () => ({ query, release() {} });
const app = express();
app.use(express.json());
app.use((req, _res, next) => { const id = req.get("x-test-user"); if (id) req.dbUser = { id } as any; next(); });
registerObjectStorageRoutes(app);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 500).json({message:error.message}));
const server = app.listen(0, "127.0.0.1");
let base = "";
before(async () => {
  await new Promise<void>(resolve => { if (server.listening) resolve(); else server.once("listening", resolve); });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  objectStorageClient.bucket = nativeBucket;
  ObjectStorageService.prototype.getObjectEntityFile = nativeGet;
  pool.query = nativeQuery; pool.connect = nativeConnect;
  await pool.end();
});
function ownedFixture(id: string, owner?: string, contentType = "image/png", visibility = "private") {
  const file = fakeFile(`.private/uploads/${id}`);
  file.present = true; file.bytes = Buffer.from("image-fixture");
  file.meta = { contentType, metadata: owner ? {"custom:aclPolicy":JSON.stringify({owner,visibility})} : {} };
  return `/objects/uploads/${id}`;
}

test("upload metadata rejects active formats, missing sizes, and over-limit declarations", () => {
  for (const metadata of [
    {name:"x.html",size:2,contentType:"text/html"}, {name:"x.svg",size:100,contentType:"image/svg+xml"},
    {name:"x.png",contentType:"image/png"}, {name:"x.png",size:assets.MAX_IMAGE_UPLOAD_BYTES+1,contentType:"image/png"},
  ]) assert.throws(() => assets.requireUploadMetadata(metadata), assets.AssetError);
});

test("byte decoding rejects HTML/SVG masquerading as images and normalizes valid transparent PNG", async () => {
  await assert.rejects(assets.normalizeImageUpload(Buffer.from("<html>active</html>"), "image/png"), assets.AssetError);
  await assert.rejects(assets.normalizeImageUpload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'), "image/png"), assets.AssetError);
  const input = await sharp({create:{width:20,height:12,channels:4,background:{r:230,g:100,b:30,alpha:0.5}}}).png().toBuffer();
  const normalized = await assets.normalizeImageUpload(input, "image/png");
  const metadata = await sharp(normalized.buffer).metadata();
  assert.equal(metadata.format, "webp"); assert.equal(metadata.hasAlpha, true); assert.equal(normalized.width,20);
  await assert.rejects(assets.normalizeImageUpload(input, "image/jpeg"), assets.AssetError);
});

test("new ingestion records a private owner ACL and normalized MIME", async () => {
  const input = await sharp({create:{width:4,height:4,channels:3,background:"red"}}).png().toBuffer();
  const saved = await assets.ingestOwnedImage("owner", input, "image/png");
  assert.ok(saved.url.endsWith(".webp"));
  assert.equal(await assets.canUserReadAsset("owner", saved.url),true);
  assert.equal(await assets.canUserReadAsset("other", saved.url),false);
});

test("private objects require the owner; migrated references retain owner access", async () => {
  const path = ownedFixture("private.png", "A");
  assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+path,{headers:{"x-test-user":"B"}})).status,404);
  const response = await fetch(base+path,{headers:{"x-test-user":"A"}});
  assert.equal(response.status,200); assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.equal(response.headers.get("cache-control"),"private, no-store");
  const migrated = ownedFixture("migrated.png"); legacyOwners.set(migrated,"A");
  assert.equal((await fetch(base+migrated,{headers:{"x-test-user":"A"}})).status,200);
  assert.equal((await fetch(base+migrated,{headers:{"x-test-user":"B"}})).status,404);
  legacyOwners.set(path, "B");
  assert.equal((await fetch(base+path,{headers:{"x-test-user":"B"}})).status,404, "An explicit foreign ACL overrides legacy references");
});

test("scoped share image access expires and cannot read another asset", async () => {
  const path = ownedFixture("shared.png","A"); const token = "a".repeat(48);
  const other = ownedFixture("unshared.png","A"); shares.set(token,{path,expires:Date.now()+60_000});
  assert.equal((await fetch(`${base}${path}?share=${token}`)).status,200);
  assert.equal((await fetch(`${base}${other}?share=${token}`)).status,404);
  shares.set(token,{path,expires:Date.now()-1});
  assert.equal((await fetch(`${base}${path}?share=${token}`)).status,404);
});

test("active objects are not served even to their owner; explicit public image ACL remains supported", async () => {
  const active=ownedFixture("old-active.html","A","text/html");
  assert.equal((await fetch(base+active,{headers:{"x-test-user":"A"}})).status,415);
  const publicImage=ownedFixture("public.png","A","image/png","public");
  assert.equal((await fetch(base+publicImage)).status,200);
});

test("migrated images with absent MIME are decoded safely without changing their bytes", async () => {
  const path=ownedFixture("old-no-mime.png","A","application/octet-stream");
  const file=files.get(".private/uploads/old-no-mime.png");
  file.bytes=await sharp({create:{width:6,height:6,channels:3,background:"green"}}).png().toBuffer();
  const response=await fetch(base+path,{headers:{"x-test-user":"A"}});
  assert.equal(response.status,200); assert.equal(response.headers.get("content-type"),"image/png");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),file.bytes);
  file.bytes=Buffer.from("<html>not an image</html>");
  assert.equal((await fetch(base+path,{headers:{"x-test-user":"A"}})).status,415);
});

test("foreign local asset references cannot manufacture ownership", async () => {
  const path=ownedFixture("foreign.png","A");
  await assert.rejects(assets.assertOwnedAssetReferences("B",{imagePath:path}),assets.AssetError);
  await assert.rejects(assets.assertOwnedAssetReferences("B",{studioLogoPath:`https://elsewhere.invalid${path}`}),assets.AssetError);
  await assets.assertOwnedAssetReferences("A",{imageUrl:path});
  for(const invalid of ["/objects/uploads/../secret.sql","/objects/uploads/%2e%2e/secret","/objects/uploads/a%5cb.png","/objects/uploads//file.png"])
    assert.throws(()=>assets.assetPath(invalid),assets.AssetError);
});

test("cleanup never deletes foreign or legacy objects", async () => {
  const legacy=ownedFixture("legacy-cleanup.png");
  const taggedLegacy=ownedFixture("tagged-legacy-cleanup.png","A");
  const foreign=ownedFixture("foreign-cleanup.png","B");
  for(const path of [legacy,taggedLegacy,foreign]) await assert.rejects(assets.deleteOwnedAsset("A",path),assets.AssetError);
});

test("same-origin upload intent enforces principal, byte size, real format, and one use", async () => {
  const input=await sharp({create:{width:5,height:5,channels:3,background:"blue"}}).png().toBuffer();
  const response=await fetch(base+"/api/uploads/request-url",{method:"POST",headers:{"Content-Type":"application/json","x-test-user":"A"},body:JSON.stringify({name:"image.png",size:input.length,contentType:"image/png"})});
  assert.equal(response.status,200); const intent=await response.json();
  const beforeSave=savedCount;
  const put=(user:string,body:Buffer=input)=>fetch(intent.uploadURL,{method:"PUT",headers:{"Content-Type":"image/png","x-test-user":user},body});
  assert.equal((await put("B")).status,404); assert.equal(savedCount,beforeSave);
  assert.equal((await put("A",Buffer.from("bad"))).status,400); assert.equal(savedCount,beforeSave);
  assert.equal((await put("A")).status,200); assert.equal(savedCount,beforeSave+1);
  assert.equal((await put("A")).status,409); assert.equal(savedCount,beforeSave+1);
  assert.equal((await fetch(base+intent.objectPath,{headers:{"x-test-user":"A"}})).status,200);
});

test("public share output omits owner/phone/email/notes and scopes only its image URLs", () => {
  const safe=assets.publicSharedBoard({id:1,title:"Published",userId:"private-owner",clientPhone:"secret",clientEmail:"secret@example.invalid",descriptionRaw:"private brief",studioLogoPath:"/objects/uploads/logo.png"},
    [{id:4,projectId:1,title:"Reference",note:"private note",imageUrl:"/objects/uploads/image.png"}],"b".repeat(48));
  for(const k of ["userId","clientPhone","clientEmail","descriptionRaw"]) assert.equal(k in safe.project,false);
  assert.equal("note" in safe.pins[0],false); assert.equal("projectId" in safe.pins[0],false);
  assert.match(String(safe.project.studioLogoPath),/\?share=/); assert.match(String(safe.pins[0].imageUrl),/\?share=/);
});
