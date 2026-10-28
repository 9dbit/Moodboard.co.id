import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import pg from "pg";

const testUrl = process.env.AUTH_TEST_DATABASE_URL;
const enabled = { skip: !testUrl };
const schema = `board_service_test_${process.pid}`;
let setup: pg.Pool;
let pool: typeof import("../server/db")["pool"];
let service: typeof import("../server/board-service");

before(async () => {
  if (!testUrl) return;
  const parsed = new URL(testUrl);
  assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname));
  assert.equal(parsed.pathname, "/moodboard_auth_test");
  setup = new pg.Pool({ connectionString: testUrl });
  await setup.query(`CREATE SCHEMA ${schema}`);
  parsed.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = parsed.href;
  process.env.SITE_URL = "http://localhost:5000";
  process.env.NODE_ENV = "test";
  pool = (await import("../server/db")).pool;
  await pool.query(`CREATE TABLE users(id varchar PRIMARY KEY,email varchar);
    CREATE TABLE projects(id serial PRIMARY KEY,user_id varchar REFERENCES users(id),title text,
      description_raw text,description_ai text,description_enabled boolean DEFAULT true,
      studio_name text,designer_name text,paper_size text DEFAULT 'A3',orientation text DEFAULT 'horizontal',
      image_layout text DEFAULT 'original',grid_columns integer DEFAULT 3,canvas_background text DEFAULT '#ffffff',
      show_cover boolean DEFAULT true,show_footer boolean DEFAULT true,
      created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
    CREATE TABLE pins(id serial PRIMARY KEY,project_id integer REFERENCES projects(id),title text,
      description_final text,description_ai text,description_custom_input text,description_enabled boolean,
      width integer,height integer,position integer,source_url text);`);
  await (await import("../server/mcp-auth")).initializeMcpSchema();
  service = await import("../server/board-service");
});
beforeEach(async () => {
  if (!testUrl) return;
  await pool.query("TRUNCATE moodboard_tool_requests,pins,projects,users RESTART IDENTITY CASCADE");
  await pool.query("INSERT INTO users VALUES('owner','owner@example.invalid'),('other','other@example.invalid')");
});
after(async () => {
  if (!testUrl) return;
  await pool?.end();
  if (setup) { await setup.query(`DROP SCHEMA ${schema} CASCADE`); await setup.end(); }
});

async function existingBoard() {
  const result = await pool.query(`INSERT INTO projects(user_id,title,description_raw,description_ai,description_enabled)
    VALUES('owner','Existing board','Original brief','Older generated wording',false) RETURNING id`);
  return (await service.getBoard("owner", result.rows[0].id)).board;
}

test("a requested brief replaces stale generated text without silently enabling its display", enabled, async () => {
  const original = await existingBoard();
  assert.equal(original.description, "Older generated wording");
  assert.equal(original.descriptionRaw, "Original brief");
  assert.equal(original.descriptionEnabled, false);
  const changed = await service.updateBoard("owner", original.id, original.updatedAt, { descriptionRaw: "New user-approved brief" });
  assert.equal(changed.board.description, "New user-approved brief");
  assert.equal(changed.board.descriptionRaw, "New user-approved brief");
  assert.equal(changed.board.descriptionEnabled, false);
  assert.notEqual(changed.board.updatedAt, original.updatedAt);
  const stored = (await pool.query("SELECT description_ai,description_enabled FROM projects WHERE id=$1", [original.id])).rows[0];
  assert.equal(stored.description_ai, null);
  assert.equal(stored.description_enabled, false);
  await assert.rejects(service.updateBoard("owner", original.id, original.updatedAt, { title: "Stale edit" }), { status: 409 });
  await assert.rejects(service.updateBoard("other", original.id, changed.board.updatedAt, { descriptionEnabled: true }), { status: 404 });
});

test("visibility and unrelated layout edits preserve existing wording until the brief is explicitly replaced", enabled, async () => {
  const original = await existingBoard();
  const layout = await service.updateBoard("owner", original.id, original.updatedAt, { gridColumns: 4 });
  assert.equal(layout.board.description, "Older generated wording");
  assert.equal(layout.board.descriptionEnabled, false);
  const visible = await service.updateBoard("owner", original.id, layout.board.updatedAt, { descriptionEnabled: true });
  assert.equal(visible.board.description, "Older generated wording");
  assert.equal(visible.board.descriptionEnabled, true);
  const cleared = await service.updateBoard("owner", original.id, visible.board.updatedAt, { descriptionRaw: "" });
  assert.equal(cleared.board.description, "");
  assert.equal(cleared.board.descriptionEnabled, true);
});

test("a new brief and explicit visibility survive idempotent creation without duplicating a board", enabled, async () => {
  const input = { title: "New client presentation", descriptionRaw: "Selected material references", descriptionEnabled: false };
  const created = await service.createBoard("owner", "new-brief-fixture", input);
  const retry = await service.createBoard("owner", "new-brief-fixture", input);
  assert.deepEqual(retry, created);
  assert.equal(created.board.description, input.descriptionRaw);
  assert.equal(created.board.descriptionEnabled, false);
  assert.equal((await service.listBoards("owner")).boards.length, 1);
  await assert.rejects(service.createBoard("owner", "new-brief-fixture", { ...input, descriptionEnabled: true }), { status: 409 });
});
