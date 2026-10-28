import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Readable } from "node:stream";
import { getTableConfig } from "drizzle-orm/pg-core";
import express from "express";
import sharp from "sharp";
import type { Server } from "node:http";

const testUrl = process.env.EXPORT_TEST_DATABASE_URL;
const enabled = { skip: !testUrl };
let server: Server;
let base: string;
let pool: typeof import("../server/db")["pool"];
let service: typeof import("../server/export-service");
const objects = new Map<string, Buffer>();
let restoreBucket: () => void;

before(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.equal(url.pathname, "/moodboard_export_test");
  process.env.DATABASE_URL = testUrl;
  process.env.PRIVATE_OBJECT_DIR = "/review-bucket/.private";
  process.env.S3_BUCKET = "review-bucket";
  process.env.S3_ENDPOINT = "https://example.invalid";
  process.env.S3_ACCESS_KEY_ID = "review-only";
  process.env.S3_SECRET_ACCESS_KEY = "review-only";
  pool = (await import("../server/db")).pool;
  const { projects, pins, users } = await import("../shared/schema");
  for (const table of [users, projects, pins]) {
    const config = getTableConfig(table);
    const columns = config.columns.map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? " PRIMARY KEY" : ""}`);
    await pool.query(`CREATE TABLE IF NOT EXISTS "${config.name}" (${columns.join(",")})`);
  }
  await pool.query("TRUNCATE pins,projects,users CASCADE");
  await pool.query("INSERT INTO users(id,email) VALUES('A','a@example.invalid'),('B','b@example.invalid')");
  await pool.query("INSERT INTO projects(id,user_id,title,paper_size,orientation,grid_columns,show_cover) VALUES(1,'A','Review export','A4','horizontal',2,false),(2,'B','Other board','A4','horizontal',2,false)");
  await pool.query("INSERT INTO pins(id,project_id,image_path,title,position) VALUES(1,1,'/objects/uploads/fixture.png','Reference',0)");
  objects.set(".private/uploads/fixture.png", await sharp({ create: { width: 16, height: 12, channels: 3, background: "#cdb79c" } }).png().toBuffer());
  const { objectStorageClient } = await import("../server/replit_integrations/object_storage/objectStorage");
  const original = objectStorageClient.bucket;
  objectStorageClient.bucket = () => ({ file: (name: string) => ({
    name,
    exists: async () => [objects.has(name)] as [boolean],
    getMetadata: async () => [{ contentType: name.endsWith('.pdf') ? 'application/pdf' : 'image/png', size: objects.get(name)?.length || 0,
      metadata: { 'custom:aclPolicy': JSON.stringify({ owner: 'A', visibility: 'private' }) } }],
    download: async () => [objects.get(name)!] as [Buffer],
    save: async (buffer: Buffer) => { objects.set(name, buffer); },
    setMetadata: async () => {},
    createReadStream: () => Readable.from([objects.get(name)!]),
  }) });
  restoreBucket = () => { objectStorageClient.bucket = original; };
  service = await import("../server/export-service");
  await service.initializeExportSchema();
  await pool.query("TRUNCATE export_jobs CASCADE");
  const app = express(); service.registerExportRoutes(app);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  process.env.SITE_URL = base;
  process.env.NODE_ENV = "test";
});
after(async () => {
  if (!testUrl) return;
  restoreBucket?.();
  server?.closeAllConnections();
  if (server) await new Promise<void>(r => server.close(() => r()));
  await pool?.end();
});
async function completed(id: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const job = await service.getExportJob("A", id);
    if (job.status === "ready" || job.status === "failed") return job;
    await new Promise(r => setTimeout(r, 40));
  }
  throw new Error("Export fixture did not complete");
}

test("jobs enforce owner, preserve idempotency and authorize expiring attachment downloads", enabled, async () => {
  await assert.rejects(service.startExport("B", { projectId: 1 }), /not found/);
  const first = await service.startExport("A", { projectId: 1, idempotencyKey: "review-repeat" });
  const duplicate = await service.startExport("A", { projectId: 1, idempotencyKey: "review-repeat" });
  assert.equal(first.id, duplicate.id);
  await assert.rejects(service.getExportJob("B", first.id), /not found/);
  await assert.rejects(service.startExport("A", { projectId: 1, paperSize: "A3", idempotencyKey: "review-repeat" }), /different export/);
  const job = await completed(first.id);
  assert.equal(job.status, "ready", JSON.stringify(job));
  assert.ok("downloadUrl" in job);
  const link = (job as { downloadUrl: string }).downloadUrl;
  const response = await fetch(link);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.match(response.headers.get("content-disposition")!, /^attachment;/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
  const invalid = new URL(link); invalid.searchParams.set("token", "A".repeat(43));
  assert.equal((await fetch(invalid)).status, 404);
  assert.equal((await fetch(base + `/exports/${first.id}`)).status, 404);
  await pool.query("UPDATE export_download_tokens SET expires_at=now()-interval '1 second' WHERE job_id=$1", [first.id]);
  assert.equal((await fetch(link)).status, 404);
});

test("a missing or corrupt reference fails the entire export without publishing a partial PDF", enabled, async () => {
  objects.set(".private/uploads/broken.png", Buffer.from("broken"));
  await pool.query("INSERT INTO pins(id,project_id,image_path,title,position) VALUES(2,1,'/objects/uploads/broken.png','Broken reference',1)");
  const started = await service.startExport("A", { projectId: 1, idempotencyKey: "review-failed" });
  const job = await completed(started.id);
  assert.equal(job.status, "failed");
  assert.equal("downloadUrl" in job, false);
  assert.ok(job.error);
});

test("expected export failures remain actionable without exposing internal storage errors", enabled, async () => {
  await assert.rejects(service.startExport("B", { projectId: 1 }), { status: 404, message: "Moodboard not found." });
  await pool.query("INSERT INTO projects(id,user_id,title) VALUES(3,'A','Empty draft')");
  await assert.rejects(service.startExport("A", { projectId: 3 }), { status: 400, message: "Add at least one reference image before exporting." });
  await pool.query("INSERT INTO projects(id,user_id,title) VALUES(4,'A','Oversized board')");
  await pool.query("INSERT INTO pins(id,project_id,title) SELECT 1000+n,4,'Reference' FROM generate_series(1,501) AS n");
  await assert.rejects(service.startExport("A", { projectId: 4 }), { status: 413, message: "Server exports support up to 500 references. Split this board before exporting; no partial PDF was created." });
  await assert.rejects(service.getExportJob("A", "not-a-job"), { status: 404, message: "Export not found." });
  await assert.rejects(service.getExportJob("A", "11111111-1111-4111-8111-111111111111"), { status: 404, message: "Export not found or expired." });
  const retryFixture = await service.startExport("A", { projectId: 1, idempotencyKey: "public-failure-retry" });
  await completed(retryFixture.id);
  await assert.rejects(service.startExport("A", { projectId: 1, paperSize: "A3", idempotencyKey: "public-failure-retry" }), { status: 409 });

  // Insert active jobs directly so no worker timing can race the quota case.
  await pool.query(`INSERT INTO export_jobs(id,user_id,project_id,idempotency_key,input_hash,snapshot,total,status,lease_until)
    VALUES('11111111-1111-4111-8111-111111111112','A',1,'active-one','fixture','{}',1,'running',now()+interval '9 minutes'),
          ('11111111-1111-4111-8111-111111111113','A',1,'active-two','fixture','{}',1,'running',now()+interval '9 minutes')`);
  await assert.rejects(service.startExport("A", { projectId: 1, idempotencyKey: "third-active" }), { status: 429, message: "Two export jobs are already active. Wait for one to finish." });
  await pool.query("DELETE FROM export_jobs WHERE idempotency_key IN ('active-one','active-two')");
  await pool.query("UPDATE export_jobs SET expires_at=now()-interval '1 second' WHERE idempotency_key='public-failure-retry'");
  await assert.rejects(service.startExport("A", { projectId: 1, idempotencyKey: "public-failure-retry" }), { status: 410, message: "This export expired. Start another export with a new idempotency key." });

  const originalDirectory = process.env.PRIVATE_OBJECT_DIR;
  try {
    delete process.env.PRIVATE_OBJECT_DIR;
    await assert.rejects(service.startExport("A", { projectId: 1 }), (error: any) => !(error instanceof service.ExportServiceError) && error.status === undefined);
  } finally { process.env.PRIVATE_OBJECT_DIR = originalDirectory; }
});
