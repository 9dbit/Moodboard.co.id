import assert from "node:assert/strict";
import { after, test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";

// This test replaces the SQL mutation boundary; it never opens a DB connection.
process.env.DATABASE_URL = "postgresql://ownership-test:unused@127.0.0.1:1/ownership-test";
const { db, pool } = await import("../server/db");
const { storage } = await import("../server/storage");
const { projects, pins } = await import("../shared/schema");
after(() => pool.end());

async function captureUpdate(run: () => Promise<unknown>) {
  const original = db.update;
  const captured: { table?: unknown; values?: Record<string, unknown>; targetId?: unknown } = {};
  (db as any).update = (table: unknown) => {
    captured.table = table;
    return {
      set(values: Record<string, unknown>) {
        captured.values = values;
        return {
          where(predicate: any) {
            captured.targetId = new PgDialect().sqlToQuery(predicate).params[0];
            return { returning: async () => [{ ...values }] };
          },
        };
      },
    };
  };
  try { await run(); return captured; }
  finally { db.update = original; }
}

test("an editor project patch cannot transfer ownership or change row identity", async () => {
  const captured = await captureUpdate(() => storage.updateProject(17, {
    id: 99,
    userId: "another-account",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    title: "Updated presentation",
  }));
  assert.equal(captured.table, projects);
  assert.equal(captured.targetId, 17);
  assert.equal(captured.values?.title, "Updated presentation");
  for (const field of ["id", "userId", "createdAt"]) assert.equal(Object.hasOwn(captured.values!, field), false);
  assert.ok(captured.values?.updatedAt instanceof Date);
  assert.notEqual((captured.values?.updatedAt as Date).getTime(), 0);
});

test("pin patches and restored snapshot data cannot move a pin into another project", async () => {
  const captured = await captureUpdate(() => storage.updatePin(41, {
    id: 200,
    projectId: 999,
    createdAt: new Date(0),
    title: "Restored caption",
    position: 3,
    descriptionEnabled: false,
  }));
  assert.equal(captured.table, pins);
  assert.equal(captured.targetId, 41);
  assert.deepEqual(captured.values, { title: "Restored caption", position: 3, descriptionEnabled: false });
});
