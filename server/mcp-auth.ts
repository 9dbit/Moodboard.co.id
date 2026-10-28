import type { Express, Response } from "express";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthClientInformationFull, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { InvalidGrantError, InvalidTokenError, InvalidScopeError, InvalidClientMetadataError, InvalidTargetError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { pool } from "./db";
import { hashToken, newToken, validToken } from "./auth-crypto";
import { loadSession, requireWebSession } from "./mcp-web-session";

export const MCP_SCOPES = ["boards:read", "boards:write", "exports:write"];
export function siteOrigin() {
  const url = new URL(process.env.SITE_URL || "http://localhost:5000");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw Error("SITE_URL must use HTTPS");
  return url.origin;
}
export const mcpResource = () => new URL("/mcp", siteOrigin());
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export async function mcpTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query("BEGIN"); const out = await fn(c); await c.query("COMMIT"); return out; }
  catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
}
export async function initializeMcpSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moodboard_oauth_clients(client_id text PRIMARY KEY, data jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS moodboard_oauth_requests(ticket_hash text PRIMARY KEY, client_id text NOT NULL REFERENCES moodboard_oauth_clients,
      params jsonb NOT NULL, expires_at timestamptz NOT NULL, csrf_hash text, user_id varchar REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS moodboard_oauth_codes(code_hash text PRIMARY KEY, client_id text NOT NULL REFERENCES moodboard_oauth_clients,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, params jsonb NOT NULL, expires_at timestamptz NOT NULL, credential_updated_at timestamptz);
    CREATE TABLE IF NOT EXISTS moodboard_oauth_grants(id uuid PRIMARY KEY, client_id text NOT NULL REFERENCES moodboard_oauth_clients,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, scopes text[] NOT NULL, resource text NOT NULL,
      credential_updated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), revoked boolean NOT NULL DEFAULT false);
    CREATE TABLE IF NOT EXISTS moodboard_oauth_tokens(token_hash text PRIMARY KEY, grant_id uuid NOT NULL REFERENCES moodboard_oauth_grants ON DELETE CASCADE,
      kind text NOT NULL, expires_at timestamptz NOT NULL, consumed boolean NOT NULL DEFAULT false);
    CREATE INDEX IF NOT EXISTS moodboard_oauth_grants_owner ON moodboard_oauth_grants(user_id);
    ALTER TABLE moodboard_oauth_codes ADD COLUMN IF NOT EXISTS credential_updated_at timestamptz;
    ALTER TABLE moodboard_oauth_tokens ADD COLUMN IF NOT EXISTS consumed boolean NOT NULL DEFAULT false;
    CREATE TABLE IF NOT EXISTS moodboard_tool_requests(owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, operation text NOT NULL,
      request_key text NOT NULL, input_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(owner_id,operation,request_key));
    DELETE FROM moodboard_oauth_requests WHERE expires_at<=now();
    DELETE FROM moodboard_oauth_codes WHERE expires_at<=now();
    DELETE FROM moodboard_oauth_tokens WHERE expires_at<=now();
  `);
}
function scopesFor(input?: string[]) {
  const scopes = [...new Set(input?.length ? input : ["boards:read"])];
  if (scopes.some(s => !MCP_SCOPES.includes(s))) throw new InvalidScopeError("Unsupported scope");
  return scopes;
}
function checkResource(resource?: URL) {
  if (!resource || resource.href !== mcpResource().href) throw new InvalidTargetError("Use the Moodboard MCP resource URL");
}
function checkRedirect(value: string) {
  const u = new URL(value);
  if (u.hash || u.username || u.password || (u.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && u.protocol === "http:" && ["localhost","127.0.0.1"].includes(u.hostname)))) throw new InvalidClientMetadataError("Redirect URIs must use HTTPS");
}
async function issueTokens(c: PoolClient, grantId: string, scopes: string[]): Promise<OAuthTokens> {
  const access = newToken(), refresh = newToken();
  await c.query(`INSERT INTO moodboard_oauth_tokens(token_hash,grant_id,kind,expires_at) VALUES
    ($1,$3,'access',now()+interval '1 hour'),($2,$3,'refresh',now()+interval '30 days')`, [hashToken(access),hashToken(refresh),grantId]);
  return { access_token: access, token_type: "Bearer", expires_in: 3600, refresh_token: refresh, scope: scopes.join(" ") };
}
export class MoodboardOAuthProvider implements OAuthServerProvider {
  clientsStore = {
    getClient: async (id: string): Promise<OAuthClientInformationFull | undefined> => (await pool.query("SELECT data FROM moodboard_oauth_clients WHERE client_id=$1",[id])).rows[0]?.data,
    registerClient: async (client: Omit<OAuthClientInformationFull,"client_id"|"client_id_issued_at">): Promise<OAuthClientInformationFull> => {
      if (!client.redirect_uris?.length || client.redirect_uris.length > 5) throw new InvalidClientMetadataError("Provide one to five redirect URIs");
      for (const uri of client.redirect_uris) checkRedirect(uri);
      if (!["none","client_secret_post"].includes(client.token_endpoint_auth_method || "client_secret_post")) throw new InvalidClientMetadataError("Unsupported client authentication");
      const stored = { ...client, client_id: randomUUID(), client_id_issued_at: Math.floor(Date.now()/1000), client_secret_expires_at: 0 };
      await pool.query("INSERT INTO moodboard_oauth_clients(client_id,data) VALUES($1,$2)",[stored.client_id,JSON.stringify(stored)]);
      return stored;
    },
  };
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    checkResource(params.resource); checkRedirect(params.redirectUri);
    if (!client.redirect_uris.includes(params.redirectUri) || !/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)) throw new InvalidGrantError("Invalid redirect URI or PKCE challenge");
    const ticket = newToken();
    await pool.query("INSERT INTO moodboard_oauth_requests(ticket_hash,client_id,params,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",
      [hashToken(ticket),client.client_id,JSON.stringify({...params,resource:params.resource!.href,scopes:scopesFor(params.scopes)})]);
    res.redirect(`/oauth/consent?ticket=${ticket}`);
  }
  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string) {
    if (!validToken(code)) throw new InvalidGrantError("Invalid authorization code");
    const row = (await pool.query("SELECT params FROM moodboard_oauth_codes WHERE code_hash=$1 AND client_id=$2 AND expires_at>now()",[hashToken(code),client.client_id])).rows[0];
    if (!row) throw new InvalidGrantError("Invalid or expired authorization code");
    return row.params.codeChallenge as string;
  }
  async exchangeAuthorizationCode(client: OAuthClientInformationFull, code: string, _verifier?: string, redirectUri?: string, resource?: URL) {
    checkResource(resource);
    if (!validToken(code)) throw new InvalidGrantError("Invalid authorization code");
    return mcpTransaction(async c => {
      const row = (await c.query(`SELECT oc.* FROM moodboard_oauth_codes oc JOIN auth_credentials ac ON ac.user_id=oc.user_id
        WHERE code_hash=$1 AND client_id=$2 AND expires_at>now() AND oc.credential_updated_at=ac.updated_at
        FOR UPDATE OF oc FOR SHARE OF ac`,[hashToken(code),client.client_id])).rows[0];
      if (!row || redirectUri !== row.params.redirectUri || resource!.href !== row.params.resource) throw new InvalidGrantError("Invalid code, redirect or resource");
      await c.query("DELETE FROM moodboard_oauth_codes WHERE code_hash=$1",[hashToken(code)]);
      const grantId = randomUUID();
      await c.query(`INSERT INTO moodboard_oauth_grants(id,client_id,user_id,scopes,resource,credential_updated_at)
        SELECT $1,$2,u.id,$4,$5,c.updated_at FROM users u LEFT JOIN auth_credentials c ON c.user_id=u.id WHERE u.id=$3`,[grantId,client.client_id,row.user_id,row.params.scopes,row.params.resource]);
      return issueTokens(c,grantId,row.params.scopes);
    });
  }
  async exchangeRefreshToken(client: OAuthClientInformationFull, token: string, scopes?: string[], resource?: URL) {
    checkResource(resource);
    if (!validToken(token)) throw new InvalidGrantError("Invalid refresh token");
    const result = await mcpTransaction(async c => {
      const row = (await c.query(`SELECT t.token_hash,t.consumed,g.* FROM moodboard_oauth_tokens t JOIN moodboard_oauth_grants g ON g.id=t.grant_id
        LEFT JOIN auth_credentials ac ON ac.user_id=g.user_id WHERE t.token_hash=$1 AND t.kind='refresh' AND t.expires_at>now()
        AND g.client_id=$2 AND NOT g.revoked AND g.credential_updated_at IS NOT DISTINCT FROM ac.updated_at FOR UPDATE OF t,g`,[hashToken(token),client.client_id])).rows[0];
      if (!row || row.resource !== resource!.href) throw new InvalidGrantError("Invalid or expired refresh token");
      if(row.consumed){await c.query("UPDATE moodboard_oauth_grants SET revoked=true WHERE id=$1",[row.id]);return null;}
      if (scopes?.some(s=>!row.scopes.includes(s))) throw new InvalidScopeError("Scopes cannot be increased");
      await c.query("DELETE FROM moodboard_oauth_tokens WHERE grant_id=$1 AND kind='access'",[row.id]);
      await c.query("UPDATE moodboard_oauth_tokens SET consumed=true WHERE token_hash=$1",[hashToken(token)]);
      if (scopes?.length) await c.query("UPDATE moodboard_oauth_grants SET scopes=$2 WHERE id=$1",[row.id,scopes]);
      return issueTokens(c,row.id,scopes?.length ? scopes : row.scopes);
    });
    if(!result)throw new InvalidGrantError("Refresh token was reused. Reconnect the account.");
    return result;
  }
  async verifyAccessToken(token: string) {
    if (!validToken(token)) throw new InvalidTokenError("Invalid access token");
    const row = (await pool.query(`SELECT g.*,t.expires_at FROM moodboard_oauth_tokens t JOIN moodboard_oauth_grants g ON g.id=t.grant_id
      LEFT JOIN auth_credentials ac ON ac.user_id=g.user_id WHERE t.token_hash=$1 AND t.kind='access' AND t.expires_at>now()
      AND NOT g.revoked AND g.credential_updated_at IS NOT DISTINCT FROM ac.updated_at`,[hashToken(token)])).rows[0];
    if (!row || row.resource !== mcpResource().href) throw new InvalidTokenError("Access revoked or expired");
    return { token,clientId:row.client_id,scopes:row.scopes as string[],expiresAt:Math.floor(new Date(row.expires_at).getTime()/1000),resource:new URL(row.resource),extra:{userId:row.user_id,grantId:row.id} };
  }
  async revokeToken(client: OAuthClientInformationFull, request: {token: string}) {
    if (!validToken(request.token)) return;
    await pool.query(`UPDATE moodboard_oauth_grants g SET revoked=true FROM moodboard_oauth_tokens t
      WHERE t.grant_id=g.id AND t.token_hash=$1 AND g.client_id=$2`,[hashToken(request.token),client.client_id]);
  }
}
function page(res: Response, body: string) {
  res.set({"Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"});
  res.type("html").send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Connect Moodboard Studio</title><style>body{font:16px system-ui;background:#faf8f5;color:#222;margin:0;padding:48px 20px}main{max-width:540px;margin:auto;background:white;padding:32px;border-radius:20px}button,a{padding:12px;display:inline-block}button{background:#ec7710;color:white;border:0;border-radius:8px;font:inherit}li{margin:12px 0}small{color:#555}</style><main>${body}</main></html>`);
}
export function registerMcpAuth(app: Express, provider: MoodboardOAuthProvider) {
  app.post('/token',(req,res,next)=>{
    if(req.body?.grant_type==='authorization_code' && (typeof req.body.code_verifier!=='string'||! /^[A-Za-z0-9._~-]{43,128}$/.test(req.body.code_verifier))) return void res.status(400).json({error:'invalid_grant',error_description:'A valid S256 PKCE verifier is required'});
    next();
  });
  app.use(mcpAuthRouter({provider,issuerUrl:new URL(siteOrigin()),resourceServerUrl:mcpResource(),scopesSupported:MCP_SCOPES,
    resourceName:"Moodboard Studio",serviceDocumentationUrl:new URL("/chatgpt",siteOrigin()),clientRegistrationOptions:{clientSecretExpirySeconds:0}}));
  app.use("/oauth/consent",loadSession);
  app.get("/oauth/consent",async(req,res,next)=>{try {
    const ticket = typeof req.query.ticket === "string" ? req.query.ticket : "";
    if (!validToken(ticket)) return void res.status(400).send("Invalid connection request");
    const row = (await pool.query("SELECT r.*,c.data FROM moodboard_oauth_requests r JOIN moodboard_oauth_clients c USING(client_id) WHERE ticket_hash=$1 AND expires_at>now()",[hashToken(ticket)])).rows[0];
    if (!row) return void res.status(400).send("Connection request expired. Start again from ChatGPT.");
    if (!req.dbUser) return page(res,`<h1>Connect your Moodboard account</h1><p>Sign in on Moodboard to choose what this connection can access.</p><a href="/sign-in?returnTo=${encodeURIComponent('/oauth/consent?ticket='+ticket)}">Sign in to continue</a>`);
    const csrf = newToken();
    await pool.query("UPDATE moodboard_oauth_requests SET csrf_hash=$2,user_id=$3 WHERE ticket_hash=$1",[hashToken(ticket),hashToken(csrf),req.dbUser.id]);
    const labels: Record<string,string> = {"boards:read":"Read your moodboards and reference images","boards:write":"Create and edit your moodboards","exports:write":"Generate PDF exports of your moodboards"};
    page(res,`<h1>Connect Moodboard Studio</h1><p>Application: <strong>${escape(String(row.data.client_name || 'MCP client'))}</strong></p><small>Return address: ${escape(new URL(row.params.redirectUri).origin)}</small><p>Signed in as ${escape(req.dbUser.email || 'your Moodboard account')}.</p><ul>${row.params.scopes.map((s:string)=>`<li>${escape(labels[s]||s)}</li>`).join('')}</ul><p>You can revoke this access from your profile. Your password is never shared with this application.</p><form method="post"><input type="hidden" name="ticket" value="${ticket}"><input type="hidden" name="csrf" value="${csrf}"><button name="decision" value="allow">Allow connection</button> <button name="decision" value="deny">Cancel</button></form>`);
  }catch(e){next(e);}});
  app.post("/oauth/consent",async(req,res,next)=>{try {
    if (!req.dbUser || req.get("origin") !== siteOrigin() || req.get("sec-fetch-site")==="cross-site") return void res.status(403).send("Sign in and approve from Moodboard");
    const {ticket,csrf,decision}=req.body||{};
    if (!validToken(ticket)||!validToken(csrf)||!["allow","deny"].includes(decision)) return void res.status(400).send("Invalid approval");
    const redirect = await mcpTransaction(async c=>{
      const credential=await c.query("SELECT user_id FROM auth_credentials WHERE user_id=$1 FOR SHARE",[req.dbUser!.id]);
      if(!credential.rows.length)throw new InvalidGrantError("Activate your account before connecting");
      const row=(await c.query("DELETE FROM moodboard_oauth_requests WHERE ticket_hash=$1 AND csrf_hash=$2 AND user_id=$3 AND expires_at>now() RETURNING *",[hashToken(ticket),hashToken(csrf),req.dbUser!.id])).rows[0];
      if(!row)throw new InvalidGrantError("Approval expired. Start again from ChatGPT.");
      const url=new URL(row.params.redirectUri);
      if(row.params.state)url.searchParams.set("state",row.params.state);
      if(decision==="deny")url.searchParams.set("error","access_denied");
      else {const code=newToken();await c.query(`INSERT INTO moodboard_oauth_codes(code_hash,client_id,user_id,params,expires_at,credential_updated_at)
        SELECT $1::text,$2::text,$3::varchar,$4::jsonb,now()+interval '2 minutes',updated_at FROM auth_credentials WHERE user_id=$3::varchar`,[hashToken(code),row.client_id,req.dbUser!.id,row.params]);url.searchParams.set("code",code);}
      return url.href;
    });
    res.set("Referrer-Policy","no-referrer").redirect(redirect);
  }catch(e){next(e);}});
  app.get("/api/connections",requireWebSession,async(req,res,next)=>{try{res.json((await pool.query(`SELECT g.id,g.scopes,g.created_at,c.data->>'client_name' AS name FROM moodboard_oauth_grants g JOIN moodboard_oauth_clients c USING(client_id) WHERE user_id=$1 AND NOT revoked ORDER BY created_at DESC`,[req.dbUser!.id])).rows);}catch(e){next(e);}});
  app.delete("/api/connections/:id",requireWebSession,async(req,res,next)=>{try{if(!/^[a-f0-9-]{36}$/.test(String(req.params.id)))return void res.sendStatus(400);await pool.query("UPDATE moodboard_oauth_grants SET revoked=true WHERE id=$1 AND user_id=$2",[req.params.id,req.dbUser!.id]);res.json({success:true});}catch(e){next(e);}});
}
