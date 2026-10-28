import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { createHash } from "node:crypto";
import pg from "pg";
import { applyPaymentNotification, verifyPaymentNotification, PaymentWebhookError } from "../server/payments";

const KEY = "local-fixture-key-not-a-real-gateway-secret";
function signed(overrides: Record<string, unknown> = {}) {
  const p: Record<string, unknown> = { order_id: "test-order", status_code: "200", gross_amount: "88000.00", transaction_status: "settlement", currency: "IDR", ...overrides };
  p.signature_key = createHash("sha512").update(`${p.order_id}${p.status_code}${p.gross_amount}${KEY}`).digest("hex");
  return p;
}
function checkError(status: number) { return (error: unknown) => error instanceof PaymentWebhookError && error.status === status; }

test("unconfigured gateway and unauthenticated notifications fail closed", () => {
  for (const secret of [null, undefined, "", "   "]) assert.throws(() => verifyPaymentNotification(signed(), secret), checkError(503));
  for (const signature_key of [undefined, "", "short", "x".repeat(128), "0".repeat(128)]) {
    assert.throws(() => verifyPaymentNotification({ ...signed(), signature_key }, KEY), checkError(403));
  }
});

test("signature binds the exact order, status code, and decimal amount", () => {
  const body = signed();
  const notification = verifyPaymentNotification(body, KEY);
  assert.equal(notification.amountMinor, 8800000n);
  assert.equal(notification.outcome, "completed");
  for (const edit of [{ order_id: "other-order" }, { gross_amount: "88000" }, { status_code: "201" }]) {
    assert.throws(() => verifyPaymentNotification({ ...body, ...edit }, KEY), checkError(403));
  }
});

test("rejects malformed money, unexpected currency and inconsistent paid status", () => {
  for (const gross_amount of [0, -1, "-1", "1e6", "Infinity", "88000.001", "0.00", " 88000", {}, "9".repeat(20)]) {
    assert.throws(() => verifyPaymentNotification(signed({ gross_amount }), KEY), checkError(400));
  }
  assert.throws(() => verifyPaymentNotification(signed({ currency: "USD" }), KEY), checkError(400));
  assert.throws(() => verifyPaymentNotification(signed({ status_code: "201" }), KEY), checkError(400));
  assert.throws(() => verifyPaymentNotification(signed({ transaction_status: "made-up" }), KEY), checkError(400));
});

test("capture requires fraud acceptance, challenged events wait, denied events fail", () => {
  assert.equal(verifyPaymentNotification(signed({ transaction_status: "capture" }), KEY).outcome, "pending");
  assert.equal(verifyPaymentNotification(signed({ transaction_status: "capture", fraud_status: "accept" }), KEY).outcome, "completed");
  assert.equal(verifyPaymentNotification(signed({ fraud_status: "challenge" }), KEY).outcome, "pending");
  assert.equal(verifyPaymentNotification(signed({ fraud_status: "deny" }), KEY).outcome, "failed");
  assert.equal(verifyPaymentNotification(signed({ transaction_status: "refund" }), KEY).outcome, "pending");
});

const url = process.env.PAYMENT_TEST_DATABASE_URL;
let pool: pg.Pool;
const integration = { skip: !url };
before(async () => {
  if (!url) return;
  const parsed = new URL(url);
  assert.ok(["127.0.0.1", "localhost"].includes(parsed.hostname), "Payment tests require local isolated PostgreSQL");
  assert.equal(parsed.pathname, "/moodboard_payment_test");
  pool = new pg.Pool({ connectionString: url });
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id varchar PRIMARY KEY,subscription_tier varchar,trial_expires_at timestamp,updated_at timestamp DEFAULT now()
  ); CREATE TABLE IF NOT EXISTS transactions (
    id serial PRIMARY KEY,user_id varchar NOT NULL,amount integer NOT NULL,currency varchar DEFAULT 'IDR',
    status varchar DEFAULT 'pending',payment_method varchar DEFAULT '12pay',gateway_transaction_id varchar,
    metadata jsonb,updated_at timestamp DEFAULT now()
  );`);
});
beforeEach(async () => { if (url) await pool.query("TRUNCATE transactions,users RESTART IDENTITY"); });
after(async () => { if (pool) await pool.end(); });
async function seed(order = "test-order", user = "test-user", tier = "lite", amount = 88000) {
  await pool.query("INSERT INTO users(id,subscription_tier,trial_expires_at) VALUES($1,'trial',NULL) ON CONFLICT DO NOTHING", [user]);
  await pool.query("INSERT INTO transactions(user_id,amount,gateway_transaction_id,metadata) VALUES($1,$2,$3,$4)", [user, amount, order, JSON.stringify({ tier })]);
}
async function state() {
  return {
    user: (await pool.query("SELECT * FROM users ORDER BY id")).rows[0],
    txs: (await pool.query("SELECT status FROM transactions ORDER BY id")).rows,
  };
}
function apply(overrides: Record<string, unknown> = {}) { return applyPaymentNotification(pool, verifyPaymentNotification(signed(overrides), KEY)); }

test("unknown order is acknowledged without touching any account", integration, async () => {
  assert.equal((await apply()).outcome, "not_found");
  assert.equal((await pool.query("SELECT count(*) FROM users")).rows[0].count, "0");
});

test("amount, currency, method and plan must match the locked local order", integration, async () => {
  await seed();
  await assert.rejects(apply({ gross_amount: "1.00" }), checkError(409));
  await pool.query("UPDATE transactions SET currency='USD'");
  await assert.rejects(apply(), checkError(409));
  await pool.query("UPDATE transactions SET currency='IDR',payment_method='another-gateway'");
  await assert.rejects(apply(), checkError(409));
  await pool.query(`UPDATE transactions SET payment_method='12pay',metadata='{"tier":"unknown"}'`);
  await assert.rejects(apply(), checkError(409));
  await pool.query(`UPDATE transactions SET metadata='{"tier":"pro"}'`);
  await assert.rejects(apply(), checkError(409));
  assert.equal((await state()).user.subscription_tier, "trial");
  assert.equal((await state()).txs[0].status, "pending");
});

test("settlement grants once and retries preserve the original expiry", integration, async () => {
  await seed();
  assert.equal((await apply()).outcome, "completed");
  const first = await state();
  assert.equal(first.user.subscription_tier, "lite");
  assert.equal(first.txs[0].status, "completed");
  assert.equal((await apply()).outcome, "duplicate");
  assert.equal((await state()).user.trial_expires_at.getTime(), first.user.trial_expires_at.getTime());
});

test("concurrent notification deliveries grant only once", integration, async () => {
  await seed();
  await pool.query("UPDATE users SET trial_expires_at='2030-12-31T00:00:00Z'");
  const result = await Promise.all(Array.from({length:12}, () => apply()));
  assert.equal(result.filter(x => x.outcome === "completed").length, 1);
  assert.equal((await state()).user.trial_expires_at.toISOString(), "2031-01-31T00:00:00.000Z");
});

test("late failure cannot replace completed payment or revoke the paid plan", integration, async () => {
  await seed();await apply();
  const before = await state();
  assert.equal((await apply({ transaction_status: "expire" })).outcome, "duplicate");
  const after = await state();
  assert.equal(after.txs[0].status, "completed");
  assert.equal(after.user.trial_expires_at.getTime(), before.user.trial_expires_at.getTime());
});

test("failed orders stay final and pending or challenged events do not grant access", integration, async () => {
  await seed();
  assert.equal((await apply({ fraud_status: "challenge" })).outcome, "ignored");
  assert.equal((await state()).user.subscription_tier, "trial");
  assert.equal((await apply({ transaction_status: "deny" })).outcome, "failed");
  assert.equal((await apply()).outcome, "duplicate");
  assert.equal((await state()).user.subscription_tier, "trial");
  assert.equal((await state()).txs[0].status, "failed");
});

test("transaction and user changes roll back together if final status cannot be stored", integration, async () => {
  await seed();
  await pool.query("ALTER TABLE transactions ADD CONSTRAINT payment_test_reject CHECK (status <> 'completed')");
  try {
    await assert.rejects(apply());
    const result = await state();
    assert.equal(result.user.subscription_tier, "trial");
    assert.equal(result.user.trial_expires_at, null);
    assert.equal(result.txs[0].status, "pending");
  } finally { await pool.query("ALTER TABLE transactions DROP CONSTRAINT payment_test_reject"); }
});

test("ambiguous orders or missing account fail closed", integration, async () => {
  await seed();await seed();
  await assert.rejects(apply(), checkError(409));
  assert.equal((await state()).user.subscription_tier, "trial");
  await pool.query("DELETE FROM transactions WHERE id=2; DELETE FROM users");
  await assert.rejects(apply(), checkError(409));
  assert.equal((await state()).txs[0].status, "pending");
});

test("separate paid orders renew active expiry atomically without losing a month", integration, async () => {
  await seed();await seed("second-order");
  await pool.query("UPDATE users SET trial_expires_at='2030-12-31T00:00:00Z'");
  await Promise.all([apply(), apply({order_id:"second-order"})]);
  assert.equal((await state()).user.trial_expires_at.toISOString(), "2031-02-28T00:00:00.000Z");
  assert.deepEqual((await state()).txs.map(x => x.status), ["completed","completed"]);
});
