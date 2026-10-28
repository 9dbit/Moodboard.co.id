import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import pg from "pg";
import sharp from "sharp";
import { Readable } from "node:stream";

const testUrl = process.env.REFERENCE_TEST_DATABASE_URL || process.env.AUTH_TEST_DATABASE_URL;
const enabled = { skip: !testUrl };
let setup: pg.Pool;
let pool: typeof import("../server/db")["pool"];
let service: typeof import("../server/reference-service");
let restore: () => void;
const schema = `reference_test_${process.pid}`;
const objects = new Map<string, Buffer>();
before(async () => {
  if (!testUrl) return;
  const parsed = new URL(testUrl);
  assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname));
  assert.ok(["/moodboard_auth_test", "/moodboard_reference_test"].includes(parsed.pathname));
  setup = new pg.Pool({ connectionString: testUrl });
  await setup.query(`CREATE SCHEMA ${schema}`);
  parsed.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = parsed.href;
  process.env.PRIVATE_OBJECT_DIR = "/review-bucket/.private";
  pool = (await import("../server/db")).pool;
  await pool.query(`CREATE TABLE projects(id integer PRIMARY KEY,user_id varchar,title text,updated_at timestamp,studio_logo_path text);
    CREATE TABLE pins(id integer PRIMARY KEY,project_id integer,title text,description_final text,description_ai text,description_custom_input text,description_enabled boolean,position integer,width integer,height integer,image_path text,image_url text);
    INSERT INTO projects(id,user_id,title,updated_at) VALUES(1,'A','Owned',now()),(2,'B','Other',now());
    INSERT INTO pins VALUES(1,1,'Original',NULL,'AI fallback',NULL,true,0,2400,1000,'/objects/uploads/reference.png',NULL);
    INSERT INTO pins VALUES(2,1,'Disguised SVG',NULL,NULL,NULL,true,1,100,100,'/objects/uploads/svg.png',NULL);`);
  objects.set(".private/uploads/reference.png", await sharp({ create: { width: 2400, height: 1000, channels: 3, background: "#c8b49b" } }).png().toBuffer());
  objects.set(".private/uploads/svg.png", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>'));
  const { objectStorageClient } = await import("../server/replit_integrations/object_storage/objectStorage");
  const original = objectStorageClient.bucket;
  objectStorageClient.bucket = () => ({ file: (name: string) => ({ name,
    exists: async () => [objects.has(name)] as [boolean],
    getMetadata: async () => [{ contentType: "image/png", size: objects.get(name)?.length || 0, metadata: { 'custom:aclPolicy': JSON.stringify({ owner: "A", visibility: "private" }) } }],
    download: async () => [objects.get(name)!] as [Buffer],
    createReadStream: () => Readable.from([objects.get(name)!]), save: async () => {}, setMetadata: async () => {},
  }) });
  restore = () => { objectStorageClient.bucket = original; };
  service = await import("../server/reference-service");
});
after(async () => {
  if (!testUrl) return;
  restore?.(); await pool?.end();
  if (setup) { await setup.query(`DROP SCHEMA ${schema} CASCADE`); await setup.end(); }
});

test("reference previews enforce joined ownership and return bounded actual JPEG pixels", enabled, async () => {
  await assert.rejects(service.viewReferenceImage("B", 1, 1), /not found/);
  await assert.rejects(service.viewReferenceImage("A", 2, 1), /not found/);
  const out = await service.viewReferenceImage("A", 1, 1);
  assert.equal(out.image.type, "image"); assert.equal(out.image.mimeType, "image/jpeg");
  const bytes = Buffer.from(out.image.data, "base64"), metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, "jpeg"); assert.equal(metadata.width, 1200); assert.equal(metadata.height, 500);
  assert.equal(metadata.exif, undefined); assert.ok(bytes.length < 2 * 1024 * 1024);
  assert.equal(out.reference.caption, "AI fallback"); assert.match(out.reference.version, /^[a-f0-9]{64}$/);
  assert.equal("imagePath" in out.reference, false); assert.equal("userId" in out.reference, false);
});

test("image bytes, rather than filename or declared MIME, reject disguised SVG", enabled, async () => {
  await assert.rejects(service.viewReferenceImage("A", 1, 2), /supported raster/);
});

test("reference caption updates enforce owner/version and make identical retries harmless", enabled, async () => {
  const initial = (await service.viewReferenceImage("A", 1, 1)).reference;
  await assert.rejects(service.updateReference("B", 1, 1, initial.version, { title: "No" }), /not found/);
  const changed = await service.updateReference("A", 1, 1, initial.version, { descriptionFinal: "Warm interior with visible timber surfaces.", descriptionEnabled: false });
  assert.equal(changed.reference.caption, "Warm interior with visible timber surfaces.");
  assert.equal(changed.reference.descriptionEnabled, false); assert.notEqual(changed.reference.version, initial.version);
  const retry = await service.updateReference("A", 1, 1, initial.version, { descriptionFinal: "Warm interior with visible timber surfaces.", descriptionEnabled: false });
  assert.deepEqual(retry, changed);
  await assert.rejects(service.updateReference("A", 1, 1, initial.version, { title: "Stale edit" }), /changed/);
  await assert.rejects(service.updateReference("A", 1, 1, changed.reference.version, { projectId: 2 }), /unrecognized/i);
});

test("concurrent conflicting edits using one reference version cannot overwrite each other", enabled, async () => {
  const pin = (await pool.query("SELECT * FROM pins WHERE id=1")).rows[0];
  const version = service.getReferenceVersion(pin);
  const results = await Promise.allSettled([
    service.updateReference("A", 1, 1, version, { title: "First concurrent title" }),
    service.updateReference("A", 1, 1, version, { title: "Second concurrent title" }),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
  assert.equal(rejected.reason.status, 409);
});

test("hashes normalize public/SQL views and change when caption, enabled state or order changes", enabled, async () => {
  const { getReferenceVersion } = await import("../server/reference-service");
  const sql = { title: "Title", description_final: "", description_ai: "Fallback", description_enabled: false, position: 2 };
  const camel = { title: "Title", caption: "Fallback", descriptionEnabled: false, position: 2 };
  assert.equal(getReferenceVersion(sql), getReferenceVersion(camel));
  for (const altered of [{ ...sql, position: 3 }, { ...sql, description_enabled: true }, { ...sql, description_final: "Changed" }]) assert.notEqual(getReferenceVersion(sql), getReferenceVersion(altered));
});
