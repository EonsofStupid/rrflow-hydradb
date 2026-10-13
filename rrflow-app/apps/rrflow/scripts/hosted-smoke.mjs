import assert from 'node:assert/strict';
import { chromium, request } from '@playwright/test';

const origin = process.env.RRFLOW_SMOKE_ORIGIN || 'http://localhost:3000';
const password = process.env.RRFLOW_WORKSPACE_PASSWORD;
assert(password && password.length >= 16, 'Provide the server-side workspace password through the environment.');
const client = await request.newContext({ baseURL: origin });
const browser = await chromium.launch({ headless: true });
try {
  for (const path of ['/api/workspace', '/api/mesh', '/api/organization', '/api/qdrant', '/api/learning']) {
    assert.equal((await client.get(path)).status(), 401, `${path} must require a session.`);
  }
  assert.equal((await client.get('/workspace', { maxRedirects: 0 })).status(), 307);
  assert.equal((await client.get('/api/workspace', { headers: { host: 'unexpected.example' } })).status(), 403);
  const demo = await client.get('/api/demo');
  assert.equal(demo.status(), 200);
  const curated = await demo.json();
  assert.equal(curated.snapshot.sources.length, 6);
  assert.equal(curated.storage, 'HydraDB');
  assert(curated.requestId, 'The demo must include an actual native receipt.');
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(origin);
  await page.getByRole('button', { name: 'Unlock my workspace' }).click();
  await page.getByLabel('Workspace password').fill(password);
  await page.getByRole('button', { name: 'Unlock workspace', exact: true }).click();
  await page.waitForURL(`${origin}/workspace`);
  const status = await context.request.get(`${origin}/api/session`);
  assert.equal((await status.json()).authenticated, true);
  const workspace = await context.request.get(`${origin}/api/workspace`);
  assert.equal(workspace.status(), 200);
  const cookies = await context.cookies();
  const cookie = cookies.find(item => item.name === '__Host-rrflow_session');
  assert(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Strict');
  assert.equal((await context.request.post(`${origin}/api/session`, { headers: { origin: 'https://cross-site.example' }, data: { password } })).status(), 403);
  await page.getByRole('button', { name: 'Sign out of private workspace' }).click();
  await page.waitForURL(`${origin}/`);
  assert.equal((await context.request.get(`${origin}/api/workspace`)).status(), 401);
  console.log(JSON.stringify({ passed: true, origin, publicSources: curated.snapshot.sources.length, nativeRequestId: curated.requestId, checks: ['anonymous protection', 'host validation', 'native curated read', 'real browser login', 'secure cookie', 'authenticated workspace', 'cross-site rejection', 'logout'] }));
  await context.close();
} finally { await browser.close(); await client.dispose(); }
