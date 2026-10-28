import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import pg from "pg";
import sharp from "sharp";

const testUrl = process.env.AUTH_TEST_DATABASE_URL;
const integration = { skip: !testUrl };
let pool: any, assets: typeof import("../server/assets"), files: Map<string, any>, saved = 0;
let objectService: typeof import("../server/replit_integrations/object_storage/objectStorage");
before(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.equal(url.pathname, "/moodboard_auth_test");
  const bootstrap = new pg.Pool({ connectionString: url.href });
  await bootstrap.query("CREATE SCHEMA IF NOT EXISTS moodboard_assets_test"); await bootstrap.end();
  url.searchParams.set("options", "-c search_path=moodboard_assets_test");
  process.env.DATABASE_URL = url.href; process.env.PRIVATE_OBJECT_DIR = "/asset-fixture/.private";
  pool = (await import("../server/db")).pool;
  await pool.query(`CREATE TABLE IF NOT EXISTS users(id varchar PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS projects(id serial PRIMARY KEY,user_id varchar REFERENCES users(id),studio_logo_path text,share_token text,share_expires_at timestamp);
    CREATE TABLE IF NOT EXISTS pins(id serial PRIMARY KEY,project_id integer REFERENCES projects(id),image_path text,image_url text);
    TRUNCATE pins,projects,users CASCADE;
    INSERT INTO users(id) VALUES('A'),('B');
    INSERT INTO projects(id,user_id,share_token) VALUES(1,'A',repeat('a',48)),(2,'B',repeat('b',48));
    INSERT INTO pins(project_id,image_path) VALUES(1,'/objects/uploads/legacy.png');`);
  assets = await import("../server/assets"); await assets.initializeAssetSchema();
  objectService = await import("../server/replit_integrations/object_storage/objectStorage");
  files = new Map();
  const file = (name: string) => {
    if (!files.has(name)) files.set(name, { name, metadata: {} as any,
      exists: async () => [true], getMetadata: async () => [{metadata:files.get(name).metadata}],
      save: async (_bytes: Buffer, options: any) => { saved++; files.get(name).metadata = options.metadata || {}; },
    });
    return files.get(name);
  };
  (objectService.objectStorageClient as any).bucket = () => ({file});
  objectService.ObjectStorageService.prototype.getObjectEntityFile = async path => file(`.private/${path.slice(9)}`);
});
after(async () => {
  if (!pool) return;
  await pool.query("DROP SCHEMA moodboard_assets_test CASCADE"); await pool.end();
});

test("real SQL bounds legacy ownership and share grants by project, expiry, and explicit ACL", integration, async () => {
  const path = "/objects/uploads/legacy.png";
  const token = "a".repeat(48);
  assert.equal(await assets.canUserReadAsset("A",path),true);
  assert.equal(await assets.canUserReadAsset("B",path),false);
  assert.equal(await assets.canReadSharedAsset(path,token),true);
  assert.equal(await assets.canReadSharedAsset("/objects/uploads/other.png",token),false);
  const file = await new objectService.ObjectStorageService().getObjectEntityFile(path) as any;
  file.metadata = {"custom:aclPolicy":JSON.stringify({owner:"B",visibility:"private"})};
  assert.equal(await assets.canUserReadAsset("A",path),false);
  assert.equal(await assets.canReadSharedAsset(path,token),false);
  file.metadata = {"custom:aclPolicy":JSON.stringify({owner:"A",visibility:"private"})};
  assert.equal(await assets.canReadSharedAsset(path,token),true);
  await pool.query("UPDATE projects SET share_expires_at=now()-interval '1 second' WHERE id=1");
  assert.equal(await assets.canReadSharedAsset(path,token),false);
  await pool.query("UPDATE projects SET share_expires_at=NULL,share_token=NULL WHERE id=1");
  assert.equal(await assets.canReadSharedAsset(path,token),false);
});

test("real upload intent lock allows only one concurrent successful ingestion", integration, async () => {
  const bytes = await sharp({create:{width:5,height:5,channels:3,background:"red"}}).png().toBuffer();
  const intent = await assets.createUploadIntent("A",{name:"image.png",size:bytes.length,contentType:"image/png"});
  await assert.rejects(assets.consumeUploadIntent("B",intent.id,intent.ticket,bytes,"image/png"),assets.AssetError);
  const outcomes = await Promise.allSettled([1,2].map(()=>assets.consumeUploadIntent("A",intent.id,intent.ticket,bytes,"image/png")));
  assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
  assert.equal(saved,1);
  const result = outcomes.find(x=>x.status==="fulfilled") as PromiseFulfilledResult<any>;
  assert.equal(await assets.canUserReadAsset("A",result.value.url),true);
  assert.equal(await assets.canUserReadAsset("B",result.value.url),false);
});
