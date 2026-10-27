import type { Express, Request, RequestHandler, Response } from "express";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "./db";
import { users } from "@shared/schema";
import { getResendClient } from "./resend-client";
import { hashPassword, hashToken, newToken, validPassword, validToken, verifyPassword } from "./auth-crypto";

const COOKIE = "mb_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_MS = 30 * 60 * 1000;
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(12).max(128);
const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema });
const registrationSchema = credentialsSchema.extend({ firstName: z.string().trim().max(100).optional(), lastName: z.string().trim().max(100).optional() });
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" });

export class AuthError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await work(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function initializeAuthSchema(): Promise<void> {
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(73195021)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_credentials (
        user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        password_hash text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash varchar(64) PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
      CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS auth_reset_tokens (
        token_hash varchar(64) PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email varchar NOT NULL, expires_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS auth_reset_user_idx ON auth_reset_tokens(user_id);
      CREATE TABLE IF NOT EXISTS auth_rate_limits (
        bucket varchar(64) PRIMARY KEY, attempts integer NOT NULL, resets_at timestamptz NOT NULL
      );
    `);
    await client.query("DELETE FROM auth_sessions WHERE expires_at <= now()");
    await client.query("DELETE FROM auth_reset_tokens WHERE expires_at <= now()");
    await client.query("DELETE FROM auth_rate_limits WHERE resets_at <= now()");
  });
}

async function consumeLimit(key: string, maximum: number, windowMs: number): Promise<boolean> {
  const { rows } = await pool.query(`
    INSERT INTO auth_rate_limits(bucket,attempts,resets_at) VALUES($1,1,now()+$2::double precision*interval '1 millisecond')
    ON CONFLICT(bucket) DO UPDATE SET
      attempts=CASE WHEN auth_rate_limits.resets_at<=now() THEN 1 ELSE auth_rate_limits.attempts+1 END,
      resets_at=CASE WHEN auth_rate_limits.resets_at<=now() THEN EXCLUDED.resets_at ELSE auth_rate_limits.resets_at END
    RETURNING attempts`, [hashToken(key), windowMs]);
  return rows[0].attempts <= maximum;
}
/** Independent IP and account buckets also limit distributed password guessing. */
export function authRateLimit(scope: string, maximum = 40, windowMs = 15 * 60 * 1000): RequestHandler {
  return async (req, res, next) => {
    try {
      const ipAllowed = await consumeLimit(`${scope}:ip:${req.ip || req.socket.remoteAddress}`, maximum, windowMs);
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
      const accountAllowed = ipAllowed && (!email || await consumeLimit(`${scope}:email:${email}`, Math.min(maximum, 10), windowMs));
      if (!ipAllowed || !accountAllowed) {
        res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
        return res.status(429).json({ message: "Too many attempts. Please try again later." });
      }
      next();
    } catch (error) { next(error); }
  };
}

/** Cookie-based application mutations must originate at this application. */
export const sameOriginGuard: RequestHandler = (req, res, next) => {
  const requestPath = req.path.toLowerCase();
  if (!requestPath.startsWith("/api/") || ["GET", "HEAD", "OPTIONS"].includes(req.method) || requestPath === "/api/payment/webhook") return next();
  const origin = req.get("origin");
  const reject = () => res.status(403).json({ message: "Cross-site request rejected" });
  if (req.get("sec-fetch-site") === "cross-site") return reject();
  if (origin) {
    try {
      const parsed = new URL(origin);
      const currentOrigin = `${req.protocol}://${req.get("host")}`;
      if (parsed.origin !== currentOrigin && parsed.origin !== new URL(process.env.SITE_URL || currentOrigin).origin) return reject();
      if (!/^https?:$/.test(parsed.protocol)) return reject();
    } catch { return reject(); }
  }
  if ((requestPath.startsWith("/api/auth/") || requestPath === "/api/admin/login") && !req.is("application/json")) {
    return res.status(415).json({ message: "Content-Type must be application/json" });
  }
  next();
};

export const loadSession: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[COOKIE];
    if (!validToken(token)) return next();
    const { rows } = await pool.query("SELECT user_id FROM auth_sessions WHERE token_hash=$1 AND expires_at>now()", [hashToken(token)]);
    if (rows[0]) {
      const [user] = await db.select().from(users).where(eq(users.id, rows[0].user_id)).limit(1);
      if (user) req.dbUser = user;
    }
    next();
  } catch (error) { next(error); }
};
async function createSession(client: PoolClient, userId: string, req: Request): Promise<string> {
  const old = req.cookies?.[COOKIE];
  if (validToken(old)) await client.query("DELETE FROM auth_sessions WHERE token_hash=$1", [hashToken(old)]);
  const token = newToken();
  await client.query("INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)", [hashToken(token), userId, new Date(Date.now() + SESSION_MS)]);
  return token;
}
function setSession(res: Response, token: string) { res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MS }); }
async function publicUser(userId: string) { const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1); return user; }
function asyncRoute(work: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    try { await work(req, res); }
    catch (error) {
      if (error instanceof AuthError) return void res.status(error.status).json({ message: error.message });
      if (error instanceof z.ZodError) return void res.status(400).json({ message: error.issues[0]?.message || "Invalid input" });
      next(error);
    }
  };
}
function activationUrl(siteUrl: string, token: string) {
  const url = new URL("/reset-password", siteUrl);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) throw new AuthError(400, "A secure site URL is required");
  url.hash = `token=${token}`;
  return url.href;
}
async function makeResetToken(client: PoolClient, userId: string, email: string, siteUrl: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + RESET_MS);
  await client.query("DELETE FROM auth_reset_tokens WHERE user_id=$1", [userId]);
  await client.query("INSERT INTO auth_reset_tokens(token_hash,user_id,email,expires_at) VALUES($1,$2,$3,$4)", [hashToken(token), userId, email, expiresAt]);
  return { activationUrl: activationUrl(siteUrl, token), expiresAt: expiresAt.toISOString() };
}
/** Caller must require an authenticated administrator and verify the selected old account. */
export async function issueActivationLink(userId: string, email: string | undefined, siteUrl: string) {
  return transaction(async (client) => {
    const { rows } = await client.query("SELECT id,email FROM users WHERE id=$1 FOR UPDATE", [userId]);
    const user = rows[0];
    if (!user) throw new AuthError(404, "User not found");
    const normalized = emailSchema.parse(email || user.email || "");
    if (user.email && normalized !== user.email.trim().toLowerCase()) throw new AuthError(409, "An existing account email cannot be changed through activation");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [normalized]);
    const duplicate = await client.query("SELECT id FROM users WHERE lower(email)=$1 AND id<>$2", [normalized, userId]);
    if (duplicate.rowCount) throw new AuthError(409, "This email belongs to another account");
    return makeResetToken(client, userId, normalized, siteUrl);
  });
}

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/register", authRateLimit("register", 12), asyncRoute(async (req, res) => {
    const body = registrationSchema.parse(req.body);
    const passwordHash = await hashPassword(body.password);
    const result = await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [body.email]);
      const existing = await client.query("SELECT id FROM users WHERE lower(email)=$1", [body.email]);
      if (existing.rowCount) throw new AuthError(409, "This email already has an account. Use password recovery or contact the administrator.");
      const userId = randomUUID();
      await client.query("INSERT INTO users(id,email,first_name,last_name) VALUES($1,$2,$3,$4)", [userId, body.email, body.firstName || null, body.lastName || null]);
      await client.query("INSERT INTO auth_credentials(user_id,password_hash) VALUES($1,$2)", [userId, passwordHash]);
      return { userId, token: await createSession(client, userId, req) };
    });
    setSession(res, result.token);
    res.status(201).json(await publicUser(result.userId));
  }));
  app.post("/api/auth/login", authRateLimit("login"), asyncRoute(async (req, res) => {
    const body = credentialsSchema.parse(req.body);
    const { rows } = await pool.query("SELECT u.id,c.password_hash FROM users u JOIN auth_credentials c ON c.user_id=u.id WHERE lower(u.email)=$1 LIMIT 1", [body.email]);
    const row = rows[0];
    if (!await verifyPassword(body.password, row?.password_hash)) throw new AuthError(401, "Email or password is incorrect. Existing users may need account activation.");
    const token = await transaction(async (client) => {
      const current = await client.query("SELECT password_hash FROM auth_credentials WHERE user_id=$1 FOR UPDATE", [row.id]);
      if (current.rows[0]?.password_hash !== row.password_hash) throw new AuthError(401, "Credentials changed. Please sign in again.");
      return createSession(client, row.id, req);
    });
    setSession(res, token);
    res.json(await publicUser(row.id));
  }));
  app.post("/api/auth/logout", asyncRoute(async (req, res) => {
    const token = req.cookies?.[COOKIE];
    if (validToken(token)) await pool.query("DELETE FROM auth_sessions WHERE token_hash=$1", [hashToken(token)]);
    res.clearCookie(COOKIE, cookieOptions());
    res.json({ success: true });
  }));
  app.post("/api/auth/forgot-password", authRateLimit("recovery", 12), asyncRoute(async (req, res) => {
    const email = emailSchema.parse(req.body?.email);
    if (!process.env.RESEND_API_KEY) throw new AuthError(503, "Email recovery is not configured. Please contact the administrator for an account activation link.");
    const { rows } = await pool.query("SELECT id FROM users WHERE lower(email)=$1 LIMIT 1", [email]);
    if (rows[0]) {
      const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;
      const result = await issueActivationLink(rows[0].id, email, siteUrl);
      const { client, fromEmail } = await getResendClient();
      const sent = await client.emails.send({
        from: fromEmail, to: email, subject: "Reset your Moodboard Studio password",
        text: `Use this link to set your Moodboard Studio password: ${result.activationUrl}\n\nThe link expires in 30 minutes and can be used once. If you did not request this, ignore this email.`,
      });
      if (sent.error) throw new AuthError(503, "Email delivery is unavailable. Please contact the administrator.");
    }
    res.json({ success: true, message: "If an account exists for this email, a recovery link has been sent." });
  }));
  app.post("/api/auth/reset-password", authRateLimit("reset", 20), asyncRoute(async (req, res) => {
    const token = req.body?.token;
    const password = req.body?.password;
    if (!validToken(token) || !validPassword(password)) throw new AuthError(400, "A valid link and a password of 12 to 128 characters are required");
    const passwordHash = await hashPassword(password);
    const result = await transaction(async (client) => {
      const identity = await client.query("SELECT user_id FROM auth_reset_tokens WHERE token_hash=$1 AND expires_at>now()", [hashToken(token)]);
      if (!identity.rows[0]) throw new AuthError(400, "This link is invalid or expired. Request a new activation link.");
      const selected = await client.query("SELECT email FROM users WHERE id=$1 FOR UPDATE", [identity.rows[0].user_id]);
      const { rows } = await client.query("SELECT user_id,email FROM auth_reset_tokens WHERE token_hash=$1 AND expires_at>now() FOR UPDATE", [hashToken(token)]);
      const reset = rows[0];
      if (!reset) throw new AuthError(400, "This link is invalid or expired. Request a new activation link.");
      const user = selected.rows[0];
      if (!user) throw new AuthError(400, "Account unavailable");
      if (user.email && user.email.trim().toLowerCase() !== reset.email) throw new AuthError(409, "Account email has changed. Request a new activation link.");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [reset.email]);
      const duplicate = await client.query("SELECT id FROM users WHERE lower(email)=$1 AND id<>$2", [reset.email, reset.user_id]);
      if (duplicate.rowCount) throw new AuthError(409, "This email belongs to another account");
      await client.query("INSERT INTO auth_credentials(user_id,password_hash) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash,updated_at=now()", [reset.user_id, passwordHash]);
      if (!user.email) await client.query("UPDATE users SET email=$1,updated_at=now() WHERE id=$2", [reset.email, reset.user_id]);
      await client.query("DELETE FROM auth_reset_tokens WHERE user_id=$1", [reset.user_id]);
      await client.query("DELETE FROM auth_sessions WHERE user_id=$1", [reset.user_id]);
      return { userId: reset.user_id, token: await createSession(client, reset.user_id, req) };
    });
    setSession(res, result.token);
    res.json(await publicUser(result.userId));
  }));
}
