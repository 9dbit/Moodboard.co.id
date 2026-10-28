import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import pg from "pg";
process.env.DATABASE_URL = "postgresql://review:unused@127.0.0.1:1/import-tests-no-default-connection";
const { ImportJobStore, initializeImportSchema } = await import("../server/import-jobs");
const { pool: unusedPool } = await import("../server/db");
const url = process.env.IMPORT_TEST_DATABASE_URL || process.env.AUTH_TEST_DATABASE_URL;
const integration = { skip: !url };
let database: pg.Pool;
let jobs: InstanceType<typeof ImportJobStore>;
before(async () => {
    if (!url)
        return;
    const u = new URL(url);
    assert.ok(["127.0.0.1", "localhost"].includes(u.hostname));
    assert.equal(u.pathname, "/moodboard_auth_test");
    const bootstrap = new pg.Pool({ connectionString: url });
    await bootstrap.query("CREATE SCHEMA IF NOT EXISTS moodboard_import_test");
    await bootstrap.end();
    database = new pg.Pool({ connectionString: url, options: "-c search_path=moodboard_import_test" });
    await database.query(`CREATE TABLE IF NOT EXISTS users(id varchar PRIMARY KEY);CREATE TABLE IF NOT EXISTS projects(id integer PRIMARY KEY,user_id varchar REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS pins(id serial PRIMARY KEY,project_id integer REFERENCES projects(id),image_url text,image_path text,source_url text,title text,position integer);
    CREATE TABLE IF NOT EXISTS sources(id serial PRIMARY KEY,project_id integer REFERENCES projects(id),type text,url text,status text,total_items integer,imported_items integer);`);
    await initializeImportSchema(database);
    jobs = new ImportJobStore(database);
});
beforeEach(async () => { if (!url)
    return; await database.query("TRUNCATE moodboard_import_receipts,moodboard_import_jobs,pins,sources,projects,users RESTART IDENTITY CASCADE;INSERT INTO users(id) VALUES('A'),('B');INSERT INTO projects(id,user_id) VALUES(1,'A'),(2,'B'),(3,'A')"); });
after(async () => { if (database)
    await database.end(); await unusedPool.end(); });
const board = "https://www.pinterest.com/review/board/";
const images = [{ imageUrl: "https://i.pinimg.com/originals/aa/bb/cc/fixture.jpg", title: "Fixture", sourceUrl: board }];
async function ready() { const id = await jobs.create("A", board); const claim = await jobs.claim(); assert.equal(claim?.id, id); await jobs.complete(id, claim!.run_id, images, board); return id; }
test("preview results and consumption are owner-scoped even when another account knows the UUID", integration, async () => {
    const id = await ready();
    assert.equal(await jobs.progress("B", id), null);
    assert.equal(await jobs.progress("A", "A_progress"), null);
    await assert.rejects(jobs.consume("B", 2, id), (e: any) => e.status === 404);
    assert.equal((await jobs.progress("A", id))?.status, "done");
    assert.equal((await database.query("SELECT count(*)::int n FROM pins")).rows[0].n, 0);
});
test("concurrent confirmations import once and survive a new store instance", integration, async () => {
    const id = await ready();
    const restarted = new ImportJobStore(database);
    const [a, b] = await Promise.all([jobs.consume("A", 1, id), restarted.consume("A", 1, id)]);
    assert.equal(a.imported, 1);
    assert.equal(b.imported, 1);
    assert.equal(a.alreadyImported || b.alreadyImported, true);
    assert.equal((await database.query("SELECT count(*)::int n FROM pins")).rows[0].n, 1);
    assert.equal((await database.query("SELECT count(*)::int n FROM sources")).rows[0].n, 1);
    await assert.rejects(jobs.consume("A", 3, id), (e: any) => e.status === 409);
});
test("expired previews and projects belonging to another owner cannot write pins", integration, async () => {
    const id = await ready();
    await assert.rejects(jobs.consume("A", 2, id), (e: any) => e.status === 404);
    await database.query("UPDATE moodboard_import_jobs SET expires_at=now()-interval '1 second' WHERE id=$1", [id]);
    await assert.rejects(jobs.consume("A", 1, id), (e: any) => e.status === 410);
    assert.equal((await database.query("SELECT count(*)::int n FROM pins")).rows[0].n, 0);
});
test("leased jobs are recovered after restart and stale workers cannot overwrite results", integration, async () => {
    const id = await jobs.create("A", board);
    const old = await jobs.claim();
    assert.ok(old);
    assert.equal(await jobs.claim(), null);
    await database.query("UPDATE moodboard_import_jobs SET lease_until=now()-interval '1 second' WHERE id=$1", [id]);
    const claimed = await new ImportJobStore(database).claim();
    assert.equal(claimed?.id, id);
    assert.notEqual(claimed?.run_id, old.run_id);
    await jobs.complete(id, old.run_id, images, board);
    assert.equal((await jobs.progress("A", id))?.status, "scraping");
    await jobs.complete(id, claimed!.run_id, images, board);
    assert.equal((await jobs.progress("A", id))?.status, "done");
});
test("direct imports are transactional, idempotent, and deduplicate existing image references", integration, async () => {
    const [a, b] = await Promise.all([jobs.importDirect("A", 1, "request", images, board, "pinterest"), jobs.importDirect("A", 1, "request", images, board, "pinterest")]);
    assert.equal(a.imported, 1);
    assert.equal(b.imported, 1);
    const next = await jobs.importDirect("A", 1, "new-request", images, board, "pinterest");
    assert.equal(next.imported, 0);
    assert.equal((await database.query("SELECT count(*)::int n FROM pins")).rows[0].n, 1);
});
test("a failed source write rolls back pins and leaves the preview safe to retry", integration, async () => {
    const id = await ready();
    await database.query(`CREATE OR REPLACE FUNCTION reject_review_source() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END; $$;CREATE TRIGGER reject_review_source BEFORE INSERT ON sources FOR EACH ROW EXECUTE FUNCTION reject_review_source()`);
    try {
        await assert.rejects(jobs.consume("A", 1, id));
        assert.equal((await database.query("SELECT count(*)::int n FROM pins")).rows[0].n, 0);
        assert.equal((await database.query("SELECT count(*)::int n FROM moodboard_import_receipts")).rows[0].n, 0);
    }
    finally {
        await database.query("DROP TRIGGER reject_review_source ON sources;DROP FUNCTION reject_review_source()");
    }
    assert.equal((await jobs.consume("A", 1, id)).imported, 1);
});
test("an owner cannot enqueue unlimited concurrent jobs", integration, async () => {
    await jobs.create("A", board);
    await jobs.create("A", board);
    await assert.rejects(jobs.create("A", board), (e: any) => e.status === 429);
    assert.ok(await jobs.create("B", board));
});
