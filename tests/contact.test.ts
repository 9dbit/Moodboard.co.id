import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.AUTH_TEST_DATABASE_URL;
if (databaseUrl) {
  const parsed = new URL(databaseUrl);
  assert.ok(["127.0.0.1", "localhost"].includes(parsed.hostname), "Contact integration tests require isolated local Postgres");
  assert.equal(parsed.pathname, "/moodboard_auth_test");
}
process.env.DATABASE_URL = databaseUrl || "postgresql://review:unused@127.0.0.1:1/contact_no_connection";
const { registerContactRoutes, initializeContactSchema, saveContactMessage } = await import("../server/contact");
const { pool } = await import("../server/db");
const payload = { requestId: randomUUID(), name: "  Designer  ", email: " DESIGNER@EXAMPLE.COM ", subject: "Help with my account", message: "Please help me with my account request." };

async function withEndpoint(
  save: (message: any) => Promise<{ id: string }>,
  work: (base: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  registerContactRoutes(app, (_req, res) => { res.status(401).json({ message: "Unauthorized" }); }, { save, rateLimit: (_req, _res, next) => next() });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try { await work(`http://127.0.0.1:${(server.address() as {port:number}).port}`); }
  finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}
function post(base: string, body: unknown) {
  return fetch(base + "/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

test("contact acknowledges only after storage confirms a normalized message", async () => {
  let stored = false;
  await withEndpoint(async message => {
    assert.equal(message.name, "Designer");
    assert.equal(message.email, "designer@example.com");
    assert.equal(message.message, payload.message);
    stored = true;
    return { id: message.requestId };
  }, async base => {
    const response = await post(base, payload);
    assert.equal(response.status, 202);
    assert.equal(stored, true);
    assert.deepEqual(await response.json(), { received: true, reference: payload.requestId, message: "Your message has been received and saved." });
  });
});

test("invalid and oversized contact submissions do not reach storage", async () => {
  let calls = 0;
  await withEndpoint(async () => { calls++; return {id:randomUUID()}; }, async base => {
    for (const body of [{...payload,email:"invalid"},{...payload,message:"short"},{...payload,message:"x".repeat(10001)},{...payload,name:"x".repeat(121)}]) {
      const response = await post(base, body);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).received, undefined);
    }
    assert.equal(calls, 0);
  });
});

test("storage failure gives a retryable error without a false receipt", async () => {
  await withEndpoint(async () => { throw Error("fixture unavailable"); }, async base => {
    const response = await post(base, payload);
    assert.equal(response.status, 503);
    const result = await response.json();
    assert.equal(result.received, undefined);
    assert.equal(result.reference, undefined);
    assert.match(result.message, /could not be saved/);
  });
});

test("the support inbox requires the supplied admin guard", async () => {
  await withEndpoint(async () => ({id:randomUUID()}), async base => {
    assert.equal((await fetch(base + "/api/admin/contact-messages")).status, 401);
  });
});

before(async () => { if (databaseUrl) await initializeContactSchema(); });
const persistedIds: string[] = [];
after(async () => {
  if (databaseUrl && persistedIds.length) await pool.query("DELETE FROM contact_messages WHERE id=ANY($1::uuid[])", [persistedIds]);
  await pool.end();
});

test("contact retry is idempotent and a reused reference cannot replace a message", { skip: !databaseUrl }, async () => {
  const id = randomUUID(); persistedIds.push(id);
  const data = { ...payload, name: "Designer", email: "designer@example.com", requestId: id };
  assert.deepEqual(await saveContactMessage(data), { id });
  assert.deepEqual(await saveContactMessage(data), { id });
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM contact_messages WHERE id=$1", [id])).rows[0].count, 1);
  await assert.rejects(saveContactMessage({ ...data, message: "Replacement content should never overwrite the original." }), (error: any) => error.status === 409);
  assert.equal((await pool.query("SELECT message FROM contact_messages WHERE id=$1", [id])).rows[0].message, payload.message);
});
