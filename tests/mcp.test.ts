import assert from 'node:assert/strict';
import {before,beforeEach,after,test} from 'node:test';
import {createHash} from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import pg from 'pg';

const url=process.env.AUTH_TEST_DATABASE_URL;
const enabled={skip:!url};
let pool:any,server:any,base:string,provider:any;
before(async()=>{
  if(!url)return;
  const u=new URL(url);assert.ok(['localhost','127.0.0.1'].includes(u.hostname));assert.equal(u.pathname,'/moodboard_auth_test');
  const bootstrap=new pg.Pool({connectionString:url});await bootstrap.query('CREATE SCHEMA IF NOT EXISTS moodboard_mcp_test');await bootstrap.end();
  const isolated=new URL(url);isolated.searchParams.set('options','-c search_path=moodboard_mcp_test');
  process.env.DATABASE_URL=isolated.href;process.env.NODE_ENV='test';
  pool=(await import('../server/db')).pool;
  await pool.query(`CREATE TABLE IF NOT EXISTS users(id varchar PRIMARY KEY,email varchar UNIQUE,first_name varchar,last_name varchar,profile_image_url varchar,subscription_tier varchar DEFAULT 'trial',trial_expires_at timestamp,whatsapp_number varchar,company_name varchar,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
    CREATE TABLE IF NOT EXISTS projects(id serial PRIMARY KEY,user_id varchar REFERENCES users(id),title text,description_raw text,studio_name text,designer_name text,paper_size text DEFAULT 'A3',orientation text DEFAULT 'horizontal',image_layout text DEFAULT 'original',grid_columns integer DEFAULT 3,canvas_background text DEFAULT '#ffffff',show_cover boolean DEFAULT true,show_footer boolean DEFAULT true,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
    CREATE TABLE IF NOT EXISTS pins(id serial PRIMARY KEY,project_id integer REFERENCES projects(id),title text,description_final text,description_ai text,width integer,height integer,position integer,source_url text);
    ALTER TABLE pins ADD COLUMN IF NOT EXISTS description_custom_input text;
    ALTER TABLE pins ADD COLUMN IF NOT EXISTS description_enabled boolean DEFAULT true;`);
  const auth=await import('../server/auth');await auth.initializeAuthSchema();
  const oauth=await import('../server/mcp-auth');await oauth.initializeMcpSchema();
  const app=express();app.use(express.json());app.use(express.urlencoded({extended:false}));app.use(cookieParser());app.use('/api',auth.loadSession);auth.registerAuthRoutes(app);
  server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;process.env.SITE_URL=base;
  (await import('../server/mcp')).registerMcpRoutes(app);provider=new oauth.MoodboardOAuthProvider();
  app.use((e:any,_req:any,res:any,_next:any)=>{res.status(500).json({message:e.message});});
});
beforeEach(async()=>{if(!url)return;await pool.query('TRUNCATE moodboard_tool_requests,moodboard_oauth_tokens,moodboard_oauth_grants,moodboard_oauth_codes,moodboard_oauth_requests,moodboard_oauth_clients,auth_rate_limits,auth_reset_tokens,auth_sessions,auth_credentials,pins,projects,users RESTART IDENTITY CASCADE');});
after(async()=>{if(server){server.closeAllConnections();await new Promise<void>(r=>server.close(r));}if(pool)await pool.end();});
async function account(name:string){const r=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:name+'@example.com',password:'Isolated test password 2026!'})});assert.equal(r.status,201);return {user:await r.json(),cookie:r.headers.get('set-cookie')!.split(';')[0]};}
async function client(){const r=await fetch(base+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'Review ChatGPT fixture',redirect_uris:['https://callback.example.invalid/callback'],token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']})});assert.equal(r.status,201);return r.json();}
async function approved(cookie:string,scopes='boards:read boards:write exports:write'){
  const c=await client(),verifier='a'.repeat(64),challenge=createHash('sha256').update(verifier).digest('base64url');
  const q=new URLSearchParams({client_id:c.client_id,response_type:'code',redirect_uri:c.redirect_uris[0],code_challenge:challenge,code_challenge_method:'S256',resource:base+'/mcp',scope:scopes,state:'fixture-state'});
  const r=await fetch(base+'/authorize?'+q,{redirect:'manual'});assert.equal(r.status,302);
  const consent=new URL(r.headers.get('location')!,base);
  const page=await fetch(consent,{headers:{Cookie:cookie}});assert.equal(page.status,200);const html=await page.text();
  const csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)![1];
  const approval=await fetch(consent,{method:'POST',redirect:'manual',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({ticket:consent.searchParams.get('ticket')!,csrf,decision:'allow'})});
  assert.equal(approval.status,302,await approval.text());const redirect=new URL(approval.headers.get('location')!);assert.equal(redirect.searchParams.get('state'),'fixture-state');
  return {client:c,code:redirect.searchParams.get('code')!,verifier};
}
async function exchange(a:any,extra:Record<string,string>={}){return fetch(base+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:a.client.client_id,code:a.code,code_verifier:a.verifier,redirect_uri:a.client.redirect_uris[0],resource:base+'/mcp',...extra})});}
async function linked(cookie:string,scope?:string){const a=await approved(cookie,scope);const r=await exchange(a);assert.equal(r.status,200);return {...a,tokens:await r.json()};}
async function rpc(token:string|undefined,method:string,params:any={}){
  const r=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});return {status:r.status,data:await r.json(),headers:r.headers};
}
test('MCP discovery advertises S256/resource and anonymous calls require bearer authentication',enabled,async()=>{
  const metadata=await(await fetch(base+'/.well-known/oauth-authorization-server')).json();assert.ok(metadata.code_challenge_methods_supported.includes('S256'));
  const resource=await(await fetch(base+'/.well-known/oauth-protected-resource/mcp')).json();assert.equal(resource.resource,base+'/mcp');
  const r=await rpc(undefined,'tools/list');assert.equal(r.status,401);assert.match(r.headers.get('www-authenticate')!,/resource_metadata/);
});
test('OAuth enforces PKCE, redirect, resource, single-use code and password-reset boundaries',enabled,async()=>{
  const a=await account('owner');const c=await approved(a.cookie);
  assert.equal((await exchange(c,{code_verifier:'bad'})).status,400);
  assert.equal((await exchange(c,{code_verifier:'b'.repeat(64)})).status,400);
  assert.equal((await exchange(c,{resource:base+'/other'})).status,400);
  assert.equal((await exchange(c,{redirect_uri:'https://elsewhere.example.invalid'})).status,400);
  assert.equal((await exchange(c)).status,200);assert.equal((await exchange(c)).status,400);
  const stale=await approved(a.cookie);await pool.query("UPDATE auth_credentials SET updated_at=updated_at+interval '1 second' WHERE user_id=$1",[a.user.id]);assert.equal((await exchange(stale)).status,400);
});
test('OAuth consent rejects cross-site approval and requires the matching signed-in user',enabled,async()=>{
  const a=await account('owner'),b=await account('other'),c=await client();
  const q=new URLSearchParams({client_id:c.client_id,response_type:'code',redirect_uri:c.redirect_uris[0],code_challenge:createHash('sha256').update('a'.repeat(64)).digest('base64url'),code_challenge_method:'S256',resource:base+'/mcp'});
  const r=await fetch(base+'/authorize?'+q,{redirect:'manual'}),consent=new URL(r.headers.get('location')!,base);
  const html=await(await fetch(consent,{headers:{Cookie:a.cookie}})).text(),csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)![1];
  for(const [cookie,origin]of [[a.cookie,'https://attacker.example.invalid'],[b.cookie,base]]){
    const out=await fetch(consent,{method:'POST',redirect:'manual',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({ticket:consent.searchParams.get('ticket')!,csrf,decision:'allow'})});assert.notEqual(out.status,302);
  }
});
test('MCP tools preserve ownership, enforce scopes and make create retries idempotent',enabled,async()=>{
  const a=await account('owner'),b=await account('other'),one=await linked(a.cookie),two=await linked(b.cookie);
  const list=await rpc(one.tokens.access_token,'tools/list');assert.equal(list.status,200);assert.equal(list.data.result.tools.length,9);assert.ok(list.data.result.tools.every((t:any)=>t.securitySchemes[0].type==='oauth2'));
  const input={name:'create_moodboard',arguments:{idempotency_key:'review-create-1',title:'Warm living room'}};
  const made=await rpc(one.tokens.access_token,'tools/call',input);assert.equal(made.data.result.isError,undefined);const id=made.data.result.structuredContent.board.id;
  const again=await rpc(one.tokens.access_token,'tools/call',input);assert.equal(again.data.result.structuredContent.board.id,id);
  const denied=await rpc(two.tokens.access_token,'tools/call',{name:'get_moodboard',arguments:{project_id:id}});assert.equal(denied.data.result.isError,true);
  const readonly=await linked(a.cookie,'boards:read');const write=await rpc(readonly.tokens.access_token,'tools/call',{name:'create_moodboard',arguments:{idempotency_key:'readonly-attempt',title:'Denied'}});assert.equal(write.data.result.isError,true);
  const current=await rpc(one.tokens.access_token,'tools/call',{name:'get_moodboard',arguments:{project_id:id}}),version=current.data.result.structuredContent.board.updatedAt;
  const edit={name:'update_moodboard',arguments:{project_id:id,expected_version:version,changes:{title:'Saved title'}}};assert.equal((await rpc(one.tokens.access_token,'tools/call',edit)).data.result.isError,undefined);assert.equal((await rpc(one.tokens.access_token,'tools/call',edit)).data.result.isError,true);
});
test('refresh rotation detects reuse and profile revocation disables an access token',enabled,async()=>{
  const a=await account('owner'),one=await linked(a.cookie);
  const rotate=()=>fetch(base+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:one.client.client_id,refresh_token:one.tokens.refresh_token,resource:base+'/mcp'})});
  const r=await rotate();assert.equal(r.status,200);const rotated=await r.json();assert.equal((await rpc(one.tokens.access_token,'tools/list')).status,401);
  assert.equal((await rotate()).status,400);assert.equal((await rpc(rotated.access_token,'tools/list')).status,401);
  const other=await linked(a.cookie);const links=await(await fetch(base+'/api/connections',{headers:{Cookie:a.cookie}})).json();assert.equal(links.length,1);
  await fetch(base+'/api/connections/'+links[0].id,{method:'DELETE',headers:{Cookie:a.cookie,Origin:base}});await assert.rejects(provider.verifyAccessToken(other.tokens.access_token));
});
