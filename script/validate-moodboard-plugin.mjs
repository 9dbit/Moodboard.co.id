import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../plugins/moodboard-studio');
export const uploadFiles = ['assets/logo.png', 'mcp.json', 'plugin.json'];
const nonempty = (v, label, max = Infinity) => assert.ok(typeof v === 'string' && v.trim() && v.length <= max && !/[\u0000-\u001f\u007f]/u.test(v.replace(/\n/g, '')), label);
const https = (value, label) => { const u = new URL(value); assert.ok(u.protocol === 'https:' && !u.username && !u.password, label); return u; };
const keys = (value, allowed, label) => { assert.ok(value && typeof value === 'object' && !Array.isArray(value), label); for (const k of Object.keys(value)) assert.ok(allowed.includes(k), `${label}: unexpected field ${k}`); };

export function validate({ submission = false } = {}) {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'plugin.json'), 'utf8'));
  const mcp = JSON.parse(readFileSync(join(packageRoot, 'mcp.json'), 'utf8'));
  keys(manifest, ['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions'], 'portable manifest');
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(manifest.name, 'moodboard-studio');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  nonempty(manifest.description, 'description'); nonempty(manifest.author?.name, 'author name', 80);
  https(manifest.homepage, 'homepage');
  const extension = manifest.extensions?.['com.openai'];
  keys(extension, ['interface', 'review', 'publication'], 'OpenAI extension');
  const i = extension.interface;
  keys(i, ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category', 'capabilities', 'websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL', 'defaultPrompt', 'brandColor', 'brandColorDark', 'composerIcon', 'logo'], 'listing');
  for (const [field, max] of [['displayName', 30], ['shortDescription', 30], ['longDescription', 4000], ['developerName', 80]]) nonempty(i[field], field, max);
  for (const [field, value] of Object.entries({ websiteURL: 'https://moodboard.co.id', supportURL: 'https://moodboard.co.id/contact', privacyPolicyURL: 'https://moodboard.co.id/privacy', termsOfServiceURL: 'https://moodboard.co.id/terms' })) {
    assert.equal(i[field], value); https(i[field], field);
  }
  assert.equal(i.category, 'Productivity');
  assert.ok(Array.isArray(i.capabilities) && i.capabilities.length <= 20);
  for (const c of i.capabilities) nonempty(c, 'capability', 120);
  assert.ok(Array.isArray(i.defaultPrompt) && i.defaultPrompt.length >= 1 && i.defaultPrompt.length <= 3);
  assert.equal(new Set(i.defaultPrompt).size, i.defaultPrompt.length);
  for (const prompt of i.defaultPrompt) { nonempty(prompt, 'starter prompt', 128); assert.ok(!prompt.includes('@')); }
  assert.match(i.brandColor, /^#[0-9a-f]{6}$/i);
  for (const field of ['logo', 'composerIcon']) assert.equal(i[field], './assets/logo.png');
  const logo = readFileSync(join(packageRoot, 'assets/logo.png'));
  assert.equal(logo.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(logo.readUInt32BE(16), logo.readUInt32BE(20), 'square logo');
  assert.ok(logo.readUInt32BE(16) >= 48 && logo.readUInt32BE(16) <= 4096 && logo.length <= 5 * 1024 * 1024);
  const cases = extension.review?.test_cases;
  assert.equal(cases?.positive?.length, 5, 'exactly five positive MCP review cases');
  assert.equal(cases?.negative?.length, 3, 'exactly three negative MCP review cases');
  for (const c of [...cases.positive, ...cases.negative]) {
    keys(c, ['description', 'prompt', 'tools_triggered', 'expected_behavior', 'file_attachment_urls', 'expected_output_url'], 'review case');
    nonempty(c.description, 'case description', 4000); nonempty(c.prompt, 'case prompt'); nonempty(c.expected_behavior, 'expected behavior');
  }
  for (const c of cases.positive) nonempty(c.tools_triggered, 'positive-case tools');
  assert.equal(extension.review.commerce, false);
  nonempty(extension.review.commerce_description, 'commerce description');
  nonempty(extension.publication?.release_notes, 'release notes');
  if (extension.review.demo_recording_url) https(extension.review.demo_recording_url, 'walkthrough URL');
  if (submission) assert.ok(extension.review.demo_recording_url, 'Final MCP review requires a real, reviewer-accessible demo_recording_url; no placeholder is accepted');

  keys(mcp, ['$schema', 'mcpServers'], 'MCP document');
  assert.equal(mcp.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
  assert.deepEqual(Object.keys(mcp.mcpServers), ['moodboard-studio']);
  const server = mcp.mcpServers['moodboard-studio'];
  keys(server, ['type', 'url', 'extensions'], 'remote MCP server');
  assert.equal(server.type, 'streamable-http');
  assert.equal(server.url, 'https://moodboard.co.id/mcp');
  const auth = server.extensions?.['com.openai']?.auth;
  keys(auth, ['type', 'client', 'resource', 'defaultScopes'], 'documented OpenAI OAuth settings');
  assert.equal(auth.type, 'oauth'); assert.deepEqual(auth.client, { mode: 'dcr' });
  assert.equal(auth.resource, server.url);
  assert.deepEqual(auth.defaultScopes, ['boards:read', 'boards:write', 'exports:write']);
  const forbidden = /^(?:clientSecret|password|apiKey|accessToken|refreshToken|test_credentials|reviewer_instructions|headers|env|hooks)$/i;
  function checkNoSecrets(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) { assert.ok(!forbidden.test(key), `private credentials or unsupported runtime field: ${key}`); checkNoSecrets(child); }
  }
  checkNoSecrets(manifest); checkNoSecrets(mcp);
  function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const path = join(dir, entry.name); assert.ok(!lstatSync(path).isSymbolicLink(), 'No symlinks in upload');
      return entry.isDirectory() ? walk(path) : [relative(packageRoot, path).replaceAll('\\', '/')];
    });
  }
  assert.deepEqual(walk(packageRoot).sort(), uploadFiles, 'Only the explicit public upload allowlist belongs in the package');
  return { name: manifest.name, version: manifest.version, files: uploadFiles.map(path => ({ path, bytes: readFileSync(join(packageRoot, path)).length, sha256: createHash('sha256').update(readFileSync(join(packageRoot, path))).digest('hex') })), validation: submission ? 'final-manifest-fields' : 'submission-draft', manualRequirements: ['Verified publishing identity and submit permissions', 'Portal domain verification', 'Dedicated reviewer account and secure review instructions', 'Run all five positive and three negative cases with reviewer account', 'Accessible video walkthrough URL', 'OpenAI portal automated checks and review'] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(validate({ submission: process.argv.includes('--submission') }), null, 2));
}
