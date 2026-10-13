import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';
import { once } from 'node:events';

const password = 'fixture-owner-password-only';
const publicOrigin = 'https://rrflow-access.example';
const demoExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const publicEnvironment = { RRFLOW_ACCESS_MODE: 'public', RRFLOW_PUBLIC_ORIGIN: publicOrigin, RRFLOW_WORKSPACE_PASSWORD: password, RRFLOW_SESSION_SECRET: 'fixture-session-secret-with-at-least-32-characters', RRFLOW_DEMO_EXPIRES_AT: demoExpiresAt };
const publicHeaders = { host: 'rrflow-access.example', 'x-forwarded-proto': 'https' };
const mutationHeaders = { ...publicHeaders, origin: publicOrigin };

// Load the actual TypeScript boundary/handlers in an isolated process. Only the
// framework's server-only marker is replaced; NextRequest/NextResponse and its
// official proxy matcher run unchanged. No app process or live key is reused.
const fixtureScript = `
  require('next/dist/server/node-environment-baseline');
  const fs = require('node:fs'); const path = require('node:path');
  const http = require('node:http'); const ts = require('typescript');
  const { NextRequest } = require('next/server');
  // Next 16.1 ships the native matcher under its earlier middleware name.
  const { unstable_doesMiddlewareMatch: doesProxyMatch } = require('next/experimental/testing/server');
  const root = ${JSON.stringify(resolve('src'))}; const cache = new Map();
  function load(file) {
    if (!file.endsWith('.ts')) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const localRequire = name => name === 'server-only' ? {} : name.startsWith('@/') ? load(path.join(root, name.slice(2))) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name);
    new Function('require', 'module', 'exports', '__filename', '__dirname', source)(localRequire, module, module.exports, file, path.dirname(file));
    return module.exports;
  }
  const boundary = load(path.join(root, 'proxy.ts'));
  const session = load(path.join(root, 'app/api/session/route.ts'));
  const access = load(path.join(root, 'lib/access.ts'));
  const guarded = load(path.join(root, 'lib/http.ts'));
  const cutoff = Date.parse('2026-10-14T00:00:00.000Z');
  const cutoffEnvironment = { ...process.env, RRFLOW_ACCESS_MODE: 'public', RRFLOW_DEMO_EXPIRES_AT: '2026-10-14T00:00:00.000Z' };
  const demoBoundaries = [access.publicDemoWindow(cutoffEnvironment, cutoff - 1).open, access.publicDemoWindow(cutoffEnvironment, cutoff).open, access.publicDemoWindow(cutoffEnvironment, cutoff + 1).open, access.publicDemoWindow({ RRFLOW_ACCESS_MODE: 'public' }, cutoff).open, access.publicDemoWindow({ ...cutoffEnvironment, RRFLOW_DEMO_EXPIRES_AT: '2026-02-30T00:00:00Z' }, cutoff).open, access.publicDemoWindow({}, cutoff).open];
  const secureRequest = new Request('https://rrflow-access.example/api/session', { method: 'POST', headers: { host: 'rrflow-access.example', origin: 'https://rrflow-access.example' } });
  let expiredToken = null; let rotatedRejected = null;
  if (process.env.RRFLOW_SESSION_SECRET && (process.env.RRFLOW_PUBLIC_ORIGIN || process.env.SITE_URL) === 'https://rrflow-access.example') {
    expiredToken = access.createWorkspaceSession(secureRequest, process.env.RRFLOW_WORKSPACE_PASSWORD, process.env, Date.now() - 9 * 60 * 60 * 1000).token;
    const token = access.createWorkspaceSession(secureRequest, process.env.RRFLOW_WORKSPACE_PASSWORD).token;
    rotatedRejected = access.verifyWorkspaceSession(token, { ...process.env, RRFLOW_WORKSPACE_PASSWORD: 'a-new-fixture-password' }) === null;
  }
  const server = http.createServer(async (incoming, outgoing) => {
    try {
      const chunks = []; for await (const chunk of incoming) chunks.push(chunk);
      const url = 'http://127.0.0.1:' + server.address().port + incoming.url;
      const req = new NextRequest(url, { method: incoming.method, headers: incoming.headers, ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Buffer.concat(chunks), duplex: 'half' } : {}) });
      const pathname = new URL(url).pathname;
      let response;
      if (doesProxyMatch({ config: boundary.config, nextConfig: {}, url })) response = boundary.proxy(req);
      if (!response || response.headers.get('x-middleware-next') === '1') {
        if (pathname === '/api/session') response = session[incoming.method] ? await session[incoming.method](req) : new Response('', { status: 405 });
        else if (pathname === '/api/demo' && ['GET', 'HEAD'].includes(incoming.method)) response = Response.json({ curated: true });
        else if (pathname.startsWith('/api/')) { guarded.checkLocalRequest(req); response = Response.json({ private: true }); }
        else response = Response.json({ public: pathname === '/' || pathname === '/demo', private: pathname !== '/' && pathname !== '/demo' });
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { outgoing.writeHead(error.status || 500, { 'content-type': 'application/json' }); outgoing.end(JSON.stringify({ error: error.message })); }
  });
  server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ url: 'http://127.0.0.1:' + server.address().port, expiredToken, rotatedRejected, demoBoundaries, liveCredentials: !!(process.env.HYDRA_DB_API_KEY || process.env.RAINDROP_WRITE_KEY), matches: ['/api/workspace', '/api/demo/private', '/workspace', '/workspace/nested', '/explore', '/live', '/demo', '/'].map(url => doesProxyMatch({ config: boundary.config, nextConfig: {}, url })) })));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
`;

type Fixture = { child: ChildProcessWithoutNullStreams; client: APIRequestContext; expiredToken: string | null; rotatedRejected: boolean | null; matches: boolean[]; demoBoundaries: boolean[]; close: () => Promise<void> };
const startFixture = async (environment: Record<string, string> = publicEnvironment): Promise<Fixture> => {
  const child = spawn(process.execPath, ['-e', fixtureScript], { cwd: process.cwd(), env: { PATH: process.env.PATH, NODE_ENV: 'test', ...environment }, stdio: 'pipe' });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  const info = await new Promise<{ url: string; expiredToken: string | null; rotatedRejected: boolean | null; liveCredentials: boolean; matches: boolean[]; demoBoundaries: boolean[] }>((resolve, reject) => {
    let stdout = '';
    // Cold Next imports on the Windows-mounted WSL checkout can take over 30s.
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`Access fixture did not start: ${stderr}`)); }, 60_000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); if (!stdout.includes('\n')) reject(new Error(`Access fixture exited (${code}): ${stderr}`)); });
    child.stdout.on('data', chunk => { stdout += String(chunk); const newline = stdout.indexOf('\n'); if (newline >= 0) { clearTimeout(timeout); try { resolve(JSON.parse(stdout.slice(0, newline))); } catch (error) { child.kill(); reject(error); } } });
  });
  expect(info.liveCredentials).toBe(false);
  const client = await playwrightRequest.newContext({ baseURL: info.url });
  return { child, client, expiredToken: info.expiredToken, rotatedRejected: info.rotatedRejected, matches: info.matches, demoBoundaries: info.demoBoundaries, close: async () => { await client.dispose(); const exited = once(child, 'exit'); child.kill(); await exited; } };
};

test('access boundary leaves curated entry public and rejects every private route without a session', async () => {
  const fixture = await startFixture();
  try {
    expect(fixture.matches).toEqual([true, true, true, true, true, true, true, false]);
    expect(fixture.demoBoundaries).toEqual([true, false, false, false, false, true]);
    expect((await fixture.client.get('/', { headers: publicHeaders })).ok()).toBe(true);
    expect((await fixture.client.get('/api/demo', { headers: publicHeaders })).ok()).toBe(true);
    expect((await fixture.client.get('/demo', { headers: publicHeaders })).ok()).toBe(true);
    expect((await fixture.client.get('/api/demo', { headers: { ...publicHeaders, host: 'foreign.example' } })).status()).toBe(403);
    for (const url of ['/api/workspace', '/api/unknown', '/api/demo/private']) {
      const response = await fixture.client.get(url, { headers: publicHeaders });
      expect(response.status()).toBe(401); expect(response.headers()['cache-control']).toContain('no-store');
      expect(await response.text()).not.toContain('"private":true');
    }
    for (const url of ['/workspace', '/workspace/nested', '/explore', '/live']) {
      const response = await fixture.client.get(url, { headers: publicHeaders, maxRedirects: 0 });
      expect(response.status()).toBe(307); expect(response.headers().location).toBe(`${publicOrigin}/?access=required`);
    }
    expect((await fixture.client.post('/api/demo', { headers: mutationHeaders, data: {} })).status()).toBe(401);
    await expect((await fixture.client.get('/api/session', { headers: publicHeaders })).json()).resolves.toEqual({ authenticated: false, local: false, configured: true, expiresAt: null, demo: { open: true, expiresAt: demoExpiresAt } });
  } finally { await fixture.close(); }
});

test('access login uses a secure expiring cookie and enforces host, origin, expiry, rotation and logout', async () => {
  const fixture = await startFixture();
  try {
    expect((await fixture.client.post('/api/session', { headers: mutationHeaders, data: { password: 'wrong' } })).status()).toBe(401);
    expect((await fixture.client.post('/api/session', { headers: publicHeaders, data: { password } })).status()).toBe(403);
    expect((await fixture.client.post('/api/session', { headers: { ...mutationHeaders, origin: 'https://foreign.example' }, data: { password } })).status()).toBe(403);
    const login = await fixture.client.post('/api/session', { headers: mutationHeaders, data: { password } });
    expect(login.status()).toBe(200);
    const setCookie = login.headers()['set-cookie'];
    expect(setCookie).toContain('__Host-rrflow_session='); expect(setCookie).toMatch(/HttpOnly/i); expect(setCookie).toMatch(/Secure/i); expect(setCookie).toMatch(/SameSite=strict/i); expect(setCookie).toMatch(/Path=\//i); expect(setCookie).not.toMatch(/Domain=/i);
    const cookie = setCookie.split(';')[0];
    expect(await login.text()).not.toContain(password);
    const authenticatedHeaders = { ...mutationHeaders, cookie };
    expect((await fixture.client.get('/api/workspace', { headers: authenticatedHeaders })).status()).toBe(200);
    await expect((await fixture.client.get('/api/session', { headers: authenticatedHeaders })).json()).resolves.toMatchObject({ authenticated: true, local: false });
    expect((await fixture.client.post('/api/workspace', { headers: { ...authenticatedHeaders, origin: 'https://foreign.example' }, data: {} })).status()).toBe(403);
    expect((await fixture.client.get('/api/workspace', { headers: { ...authenticatedHeaders, host: 'evil.example', 'x-forwarded-host': 'rrflow-access.example' } })).status()).toBe(403);
    expect((await fixture.client.get('/api/workspace', { headers: { ...authenticatedHeaders, host: 'localhost' } })).status()).toBe(403);
    const token = cookie.slice(cookie.indexOf('=') + 1); const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    expect((await fixture.client.get('/api/workspace', { headers: { ...publicHeaders, cookie: `__Host-rrflow_session=${tampered}` } })).status()).toBe(401);
    expect((await fixture.client.get('/api/workspace', { headers: { ...publicHeaders, cookie: `__Host-rrflow_session=${fixture.expiredToken}` } })).status()).toBe(401);
    expect((await fixture.client.get('/api/workspace', { headers: { ...publicHeaders, cookie: `${cookie}; ${cookie}` } })).status()).toBe(401);
    expect(fixture.rotatedRejected).toBe(true);
    const logout = await fixture.client.delete('/api/session', { headers: authenticatedHeaders });
    expect(logout.status()).toBe(200); expect(logout.headers()['set-cookie']).toContain('Max-Age=0');
    expect((await fixture.client.get('/api/workspace', { headers: publicHeaders })).status()).toBe(401);
  } finally { await fixture.close(); }
});

test('access fails closed for incomplete public configuration and preserves isolated local use', async () => {
  const locked = await startFixture({ RRFLOW_ACCESS_MODE: 'public' });
  try {
    expect((await locked.client.get('/api/workspace')).status()).toBe(503);
    expect((await locked.client.get('/api/workspace', { headers: publicHeaders })).status()).toBe(503);
    expect((await locked.client.get('/api/demo', { headers: publicHeaders })).status()).toBe(503);
    expect((await locked.client.get('/', { headers: publicHeaders })).ok()).toBe(true);
  } finally { await locked.close(); }
  const local = await startFixture({});
  try {
    expect((await local.client.get('/api/workspace')).status()).toBe(200);
    expect((await local.client.get('/api/demo')).status()).toBe(200);
    expect((await local.client.post('/api/workspace', { data: {} })).status()).toBe(200);
    expect((await local.client.get('/api/workspace', { headers: { host: 'unconfigured.example' } })).status()).toBe(503);
    expect((await local.client.post('/api/workspace', { headers: { origin: 'https://foreign.example' }, data: {} })).status()).toBe(403);
  } finally { await local.close(); }
  const fallback = await startFixture({ SITE_URL: publicOrigin, RRFLOW_WORKSPACE_PASSWORD: password, RRFLOW_SESSION_SECRET: publicEnvironment.RRFLOW_SESSION_SECRET });
  try { expect((await fallback.client.post('/api/session', { headers: mutationHeaders, data: { password } })).status()).toBe(200); }
  finally { await fallback.close(); }
});

test('demo access closes at publication cutoff and remains available to the signed-in owner', async () => {
  for (const cutoff of ['', '2000-01-01T00:00:00.000Z']) {
    const fixture = await startFixture({ ...publicEnvironment, RRFLOW_DEMO_EXPIRES_AT: cutoff });
    try {
      expect((await fixture.client.get('/api/demo', { headers: publicHeaders })).status()).toBe(401);
      expect((await fixture.client.head('/api/demo', { headers: publicHeaders })).status()).toBe(401);
      const page = await fixture.client.get('/demo', { headers: publicHeaders, maxRedirects: 0 });
      expect(page.status()).toBe(307); expect(page.headers().location).toBe(`${publicOrigin}/?access=required`);
      const status = await fixture.client.get('/api/session', { headers: publicHeaders });
      expect(status.status()).toBe(200);
      expect((await status.json()).demo).toEqual({ open: false, expiresAt: cutoff || null });
      const login = await fixture.client.post('/api/session', { headers: mutationHeaders, data: { password } });
      expect(login.status()).toBe(200);
      const cookie = login.headers()['set-cookie'].split(';')[0];
      expect((await fixture.client.get('/api/demo', { headers: { ...publicHeaders, cookie } })).status()).toBe(200);
      expect((await fixture.client.get('/demo', { headers: { ...publicHeaders, cookie } })).status()).toBe(200);
    } finally { await fixture.close(); }
  }
});

test('access rejects oversized sign-ins and bounds repeated password guesses', async () => {
  const fixture = await startFixture();
  try {
    expect((await fixture.client.post('/api/session', { headers: mutationHeaders, data: { password: 'a'.repeat(3000) } })).status()).toBe(413);
    for (let index = 0; index < 20; index++) expect((await fixture.client.post('/api/session', { headers: mutationHeaders, data: { password: 'incorrect' } })).status()).toBe(401);
    const throttled = await fixture.client.post('/api/session', { headers: mutationHeaders, data: { password } });
    expect(throttled.status()).toBe(429); expect(throttled.headers()['retry-after']).toBe('60');
  } finally { await fixture.close(); }
});
