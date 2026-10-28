import { createHash, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";

export class PaymentWebhookError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export interface PaymentNotification {
  orderId: string;
  amountMinor: bigint;
  currency: "IDR";
  outcome: "completed" | "failed" | "pending";
}
export interface PaymentDatabase {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

function amountMinor(raw: unknown): bigint {
  const value = typeof raw === "number" && Number.isSafeInteger(raw) ? String(raw) : raw;
  if (typeof value !== "string" || !/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) {
    throw new PaymentWebhookError(400, "Invalid payment amount");
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

/** Preserve the configured gateway's existing SHA512 notification contract. */
export function verifyPaymentNotification(payload: unknown, serverKey: string | null | undefined): PaymentNotification {
  if (!serverKey?.trim()) throw new PaymentWebhookError(503, "Payment gateway is not configured");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new PaymentWebhookError(400, "Invalid payment notification");
  const p = payload as Record<string, unknown>;
  if (typeof p.order_id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(p.order_id)) {
    throw new PaymentWebhookError(400, "Invalid payment order");
  }
  const statusCode = typeof p.status_code === "number" ? String(p.status_code) : p.status_code;
  if (typeof statusCode !== "string" || !/^[2-5]\d{2}$/.test(statusCode)) throw new PaymentWebhookError(400, "Invalid payment status code");
  const amount = amountMinor(p.gross_amount);
  if (amount <= 0n) throw new PaymentWebhookError(400, "Invalid payment amount");
  if (typeof p.signature_key !== "string" || !/^[a-f\d]{128}$/i.test(p.signature_key)) {
    throw new PaymentWebhookError(403, "Invalid payment signature");
  }
  const expected = createHash("sha512").update(`${p.order_id}${statusCode}${p.gross_amount}${serverKey}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(p.signature_key, "hex"))) throw new PaymentWebhookError(403, "Invalid payment signature");
  if (p.currency !== undefined && p.currency !== "IDR") throw new PaymentWebhookError(400, "Unsupported payment currency");
  if (typeof p.transaction_status !== "string") throw new PaymentWebhookError(400, "Invalid payment status");
  const known = ["pending", "authorize", "settlement", "capture", "success", "deny", "cancel", "expire", "failure", "refund", "partial_refund", "chargeback", "partial_chargeback"];
  if (!known.includes(p.transaction_status)) throw new PaymentWebhookError(400, "Invalid payment status");
  if (p.fraud_status !== undefined && !["accept", "challenge", "deny"].includes(String(p.fraud_status))) {
    throw new PaymentWebhookError(400, "Invalid fraud status");
  }
  const failed = ["deny", "cancel", "expire", "failure"].includes(p.transaction_status) || p.fraud_status === "deny";
  const success = ["settlement", "success"].includes(p.transaction_status) || p.transaction_status === "capture" && p.fraud_status === "accept";
  if (success && statusCode !== "200") throw new PaymentWebhookError(400, "Inconsistent payment status");
  return {
    orderId: p.order_id, amountMinor: amount, currency: "IDR",
    outcome: failed ? "failed" : success && p.fraud_status !== "challenge" ? "completed" : "pending",
  };
}

interface LockedTransaction {
  id: number; user_id: string; amount: number; currency: string | null;
  payment_method: string | null; status: string | null; metadata: { tier?: unknown } | null;
}

/** A locked transaction row is the idempotency key; grant and final status commit together. */
export async function applyPaymentNotification(database: PaymentDatabase, notification: PaymentNotification) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<LockedTransaction>(
      "SELECT id,user_id,amount,currency,payment_method,status,metadata FROM transactions WHERE gateway_transaction_id=$1 ORDER BY id FOR UPDATE",
      [notification.orderId],
    );
    if (rows.length === 0) { await client.query("COMMIT"); return { received: true, outcome: "not_found" }; }
    if (rows.length !== 1) throw new PaymentWebhookError(409, "Ambiguous payment order");
    const tx = rows[0];
    if (tx.payment_method !== "12pay" || tx.currency !== notification.currency || !Number.isSafeInteger(tx.amount) || BigInt(tx.amount) * 100n !== notification.amountMinor) {
      throw new PaymentWebhookError(409, "Payment order does not match");
    }
    if (tx.status === "completed" || tx.status === "failed") {
      await client.query("COMMIT"); return { received: true, outcome: "duplicate" };
    }
    if (tx.status !== "pending") throw new PaymentWebhookError(409, "Payment is not pending");
    if (notification.outcome === "pending") { await client.query("COMMIT"); return { received: true, outcome: "ignored" }; }
    if (notification.outcome === "completed") {
      const tier = tx.metadata?.tier;
      if (tier !== "lite" && tier !== "pro") throw new PaymentWebhookError(409, "Payment plan does not match");
      const expectedAmount = tier === "lite" ? 88000 : 176000;
      if (tx.amount !== expectedAmount) throw new PaymentWebhookError(409, "Payment plan amount does not match");
      const user = await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [tx.user_id]);
      if (user.rows.length !== 1) throw new PaymentWebhookError(409, "Payment account is unavailable");
      // Renew from the existing expiry when still active, so buying again never shortens it.
      await client.query(`UPDATE users SET subscription_tier=$1,
        trial_expires_at=GREATEST(COALESCE(trial_expires_at,NOW()),NOW())+INTERVAL '1 month',updated_at=NOW()
        WHERE id=$2`, [tier, tx.user_id]);
    }
    await client.query("UPDATE transactions SET status=$1,updated_at=NOW() WHERE id=$2", [notification.outcome, tx.id]);
    await client.query("COMMIT");
    return { received: true, outcome: notification.outcome };
  } catch (error) {
    await client.query("ROLLBACK"); throw error;
  } finally { client.release(); }
}
