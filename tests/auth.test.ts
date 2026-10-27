import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import type { Server } from "node:http";
import { hashPassword, hashToken, newToken, verifyPassword } from "../server/auth-crypto";

const PASSWORD = "Correct test password 2026!";

test("password hashes are salted and fail closed for wrong or malformed values", async () => {
  const first = await hashPassword(PASSWORD);
  const second = await hashPassword(PASSWORD);
  assert.notEqual(first, second);
  assert.equal(first.includes(PASSWORD), false);
  assert.equal(await verifyPassword(PASSWORD, first), true);
  assert.equal(await verifyPassword("Wrong test password", first), false);
  assert.equal(await verifyPassword(PASSWORD, null), false);
  assert.equal(await verifyPassword(PASSWORD, "scrypt-v1$bad$bad"), false);
  await assert.rejects(hashPassword("too short"));
});

const testUrl = process.env.AUTH_TEST_DATABASE_URL;
let auth: typeof import("../server/auth");
let pool: typeof import("../server/db")["pool"];
let server: Server;
let origin: string;
let backendFailure: unknown;

before(async () => {
  if (!testUrl) return;
  const parsed = new URL(testUrl);
  assert.ok(["127.0.0.1", "localhost"].includes(parsed.hostname), "Auth tests must use an isolated local Postgres");
  assert.equal(parsed.pathname, "/moodboard_auth_test");
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = "production";
  delete process.env.RESEND_API_KEY;
  auth = await import("../server/auth");
  pool = (await import("../server/db")).pool;
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id varchar PRIMARY KEY,email varchar UNIQUE,first_name varchar,last_name varchar,profile_image_url varchar,
    subscription_tier varchar DEFAULT 'trial',trial_expires_at timestamp,whatsapp_number varchar,company_name varchar,
    created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now()
  ); CREATE TABLE IF NOT EXISTS test_projects(id integer PRIMARY KEY,user_id varchar REFERENCES users(id),title text);`);
  await auth.initializeAuthSchema();
  const app = express();
  app.use(auth.sameOriginGuard);
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", auth.loadSession);
  auth.registerAuthRoutes(app);
  const { requireAuth } = await import("../server/middlewares/requireAuth");
  app.get("/api/me", requireAuth, (req, res) => { res.json(req.dbUser); });
  app.get("/api/projects", requireAuth, async (req, res) => {
    res.json((await pool.query("SELECT id,title FROM test_projects WHERE user_id=$1", [req.dbUser!.id])).rows);
  });
  app.post("/api/limited-test", auth.authRateLimit("test", 2, 60000), (_req, res) => { res.json({ok:true}); });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    backendFailure = error;
    res.status(500).json({ message: "Unexpected test backend failure" });
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
});

beforeEach(async () => {
  if (!testUrl) return;
  backendFailure = undefined;
  await pool.query("TRUNCATE auth_rate_limits,auth_reset_tokens,auth_sessions,auth_credentials,test_projects,users CASCADE");
});
after(async () => { if (testUrl) { await new Promise<void>((resolve) => server.close(() => resolve())); await pool.end(); } });

async function request(path: string, body?: unknown, cookie?: string, headers: Record<string,string> = {}) {
  const response = await fetch(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? {Cookie:cookie} : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json();
  assert.equal(backendFailure, undefined, String(backendFailure));
  return { status: response.status, json, cookie: response.headers.get("set-cookie"), response };
}
function cookieValue(setCookie: string | null) { assert.ok(setCookie); return setCookie.split(";")[0]; }
async function register(email = "new@example.com") { return request("/api/auth/register", {email,password:PASSWORD,firstName:"Test"}); }
async function seed(id: string, email: string | null) {
  await pool.query("INSERT INTO users(id,email) VALUES($1,$2)", [id,email]);
  await pool.query("INSERT INTO test_projects(id,user_id,title) VALUES(1,$1,'Original owner project')", [id]);
}
function rawToken(url: string) { return new URLSearchParams(new URL(url).hash.slice(1)).get("token")!; }
const integration = {skip: !testUrl};

test("registration cannot claim an existing legacy email, regardless of case", integration, async () => {
  await seed("original-replit-user", "Legacy@Example.com");
  const result = await register(" legacy@example.com ");
  assert.equal(result.status, 409);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM users")).rows[0].count, 1);
  assert.equal((await pool.query("SELECT user_id FROM test_projects")).rows[0].user_id, "original-replit-user");
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM auth_credentials")).rows[0].count, 0);
});

test("new registration uses a normalized email and hashed revocable Secure session", integration, async () => {
  const created = await register(" NEW@Example.com ");
  assert.equal(created.status, 201);
  assert.equal(created.json.email, "new@example.com");
  assert.equal("password_hash" in created.json, false);
  assert.match(created.cookie!, /HttpOnly/);
  assert.match(created.cookie!, /Secure/);
  assert.match(created.cookie!, /SameSite=Lax/);
  const cookie = cookieValue(created.cookie);
  const token = cookie.split("=")[1];
  const stored = (await pool.query("SELECT token_hash FROM auth_sessions")).rows[0].token_hash;
  assert.notEqual(stored, token);
  assert.equal(stored, hashToken(token));
  assert.equal((await request("/api/me")).status, 401);
  assert.equal((await request("/api/me", undefined, cookie)).json.id, created.json.id);
  assert.equal((await request("/api/me", undefined, `mb_session=${newToken()}`)).status, 401);
  assert.equal((await request("/api/auth/logout", {}, cookie)).status, 200);
  assert.equal((await request("/api/me", undefined, cookie)).status, 401);
});

test("login rotates the supplied session and wrong passwords fail", integration, async () => {
  const created = await register();
  const first = cookieValue(created.cookie);
  assert.equal((await request("/api/auth/login", {email:"new@example.com",password:"Incorrect password 2026!"})).status, 401);
  const login = await request("/api/auth/login", {email:"NEW@example.com",password:PASSWORD}, first);
  assert.equal(login.status, 200);
  assert.notEqual(cookieValue(login.cookie), first);
  assert.equal((await request("/api/me", undefined, first)).status, 401);
  const second = cookieValue(login.cookie);
  await pool.query("UPDATE auth_sessions SET expires_at=now()-interval '1 minute'");
  assert.equal((await request("/api/me", undefined, second)).status, 401);
});

test("activation preserves legacy ownership and fills absent email only after redemption", integration, async () => {
  await seed("old-native-clerk-id", null);
  const link = await auth.issueActivationLink("old-native-clerk-id", "Owner@Example.com", "https://moodboard.example");
  assert.equal((await pool.query("SELECT email FROM users")).rows[0].email, null);
  assert.equal(new URL(link.activationUrl).search, "");
  const token = rawToken(link.activationUrl);
  const stored = (await pool.query("SELECT token_hash FROM auth_reset_tokens")).rows[0].token_hash;
  assert.notEqual(stored, token);
  assert.equal(stored, hashToken(token));
  const reset = await request("/api/auth/reset-password", {token,password:PASSWORD});
  assert.equal(reset.status, 200);
  assert.equal(reset.json.id, "old-native-clerk-id");
  assert.equal(reset.json.email, "owner@example.com");
  const projects = await request("/api/projects", undefined, cookieValue(reset.cookie));
  assert.equal(projects.json[0].title, "Original owner project");
  assert.equal((await request("/api/auth/reset-password", {token,password:PASSWORD})).status, 400);
});

test("activation rejects email changes and addresses assigned to another identity", integration, async () => {
  await seed("legacy-owner", "owner@example.com");
  await assert.rejects(auth.issueActivationLink("legacy-owner", "attacker@example.com", "https://moodboard.example"), /cannot be changed/);
  await pool.query("INSERT INTO users(id,email) VALUES('blank-owner',NULL)");
  await assert.rejects(auth.issueActivationLink("blank-owner", "OWNER@example.com", "https://moodboard.example"), /another account/);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM auth_reset_tokens")).rows[0].count, 0);
});

test("password resets are single-use, revoke all old sessions, and serialize concurrent redemption", integration, async () => {
  const created = await register();
  const first = cookieValue(created.cookie);
  const second = cookieValue((await request("/api/auth/login", {email:"new@example.com",password:PASSWORD})).cookie);
  const link = await auth.issueActivationLink(created.json.id, undefined, "https://moodboard.example");
  const token = rawToken(link.activationUrl);
  const resets = await Promise.all([
    request("/api/auth/reset-password", {token,password:"Brand new secure password 2026!"}),
    request("/api/auth/reset-password", {token,password:"Brand new secure password 2026!"}),
  ]);
  assert.deepEqual(resets.map(r => r.status).sort(), [200,400]);
  assert.equal((await request("/api/me", undefined, first)).status, 401);
  assert.equal((await request("/api/me", undefined, second)).status, 401);
  assert.equal((await request("/api/auth/login", {email:"new@example.com",password:PASSWORD})).status, 401);
  assert.equal((await request("/api/auth/login", {email:"new@example.com",password:"Brand new secure password 2026!"})).status, 200);
});

test("expired and superseded activation links cannot change credentials", integration, async () => {
  await seed("legacy-owner", "owner@example.com");
  const older = await auth.issueActivationLink("legacy-owner", undefined, "https://moodboard.example");
  const newer = await auth.issueActivationLink("legacy-owner", undefined, "https://moodboard.example");
  assert.equal((await request("/api/auth/reset-password", {token:rawToken(older.activationUrl),password:PASSWORD})).status, 400);
  await pool.query("UPDATE auth_reset_tokens SET expires_at=now()-interval '1 minute'");
  assert.equal((await request("/api/auth/reset-password", {token:rawToken(newer.activationUrl),password:PASSWORD})).status, 400);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM auth_credentials")).rows[0].count, 0);
});

test("same-origin protections reject attacker forms, null origins and cross-site JSON", integration, async () => {
  assert.equal((await request("/api/auth/register", {email:"test@example.com",password:PASSWORD}, undefined, {Origin:"https://attacker.example"})).status, 403);
  assert.equal((await request("/api/auth/register", {email:"test@example.com",password:PASSWORD}, undefined, {Origin:"null"})).status, 403);
  assert.equal((await request("/api/auth/register", {email:"test@example.com",password:PASSWORD}, undefined, {"Sec-Fetch-Site":"cross-site"})).status, 403);
  assert.equal((await request("/API/auth/logout", {}, undefined, {Origin:"https://attacker.example"})).status, 403);
  const form = await fetch(origin + "/api/auth/login", {method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"email=test@example.com&password=ignored"});
  assert.equal(form.status, 415);
  assert.equal((await register()).status, 201);
});

test("DB-backed throttling returns 429 and optional email recovery fails clearly when unconfigured", integration, async () => {
  assert.equal((await request("/api/limited-test", {})).status, 200);
  assert.equal((await request("/api/limited-test", {})).status, 200);
  const limited = await request("/api/limited-test", {});
  assert.equal(limited.status, 429);
  assert.ok(limited.response.headers.get("retry-after"));
  const forgot = await request("/api/auth/forgot-password", {email:"nobody@example.com"});
  assert.equal(forgot.status, 503);
  assert.match(forgot.json.message, /administrator/);
});

test("concurrent registrations and legacy email activation cannot allocate the same email twice", integration, async () => {
  await seed("missing-email-owner", null);
  const link = await auth.issueActivationLink("missing-email-owner", "race@example.com", "https://moodboard.example");
  const results = await Promise.all([
    register("race@example.com"),
    request("/api/auth/reset-password", {token:rawToken(link.activationUrl),password:PASSWORD}),
  ]);
  assert.equal(results.filter(r => r.status === 201 || r.status === 200).length, 1);
  assert.equal(results.filter(r => r.status === 409).length, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM users WHERE lower(email)='race@example.com'")).rows[0].count, 1);
  assert.equal((await pool.query("SELECT user_id FROM test_projects")).rows[0].user_id, "missing-email-owner");
});
