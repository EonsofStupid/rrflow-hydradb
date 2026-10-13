import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { z } from 'zod';
import * as crypto from 'node:crypto';
import * as contracts from '../src/lib/public-demo-contracts';
import { publicDemoSnapshotSchema, type PublicDemoResponse } from '../src/lib/public-demo-contracts';

test('curated demo accepts only bounded examples and exact public evidence, with no extra metadata', async () => {
  const seedModule = await import(pathToFileURL(resolve('../../scripts/seed-public-demo.mjs')).href);
  const snapshot = publicDemoSnapshotSchema.parse(seedModule.createPublicDemoSnapshot());
  expect(snapshot.sources).toHaveLength(6);
  expect(snapshot.sources.filter(source => source.scope === 'personal').every(source => source.kind === 'illustrative' && source.sourceUrl === null)).toBeTruthy();
  expect(snapshot.sources.filter(source => source.scope === 'shippin')).toHaveLength(3);
  expect(publicDemoSnapshotSchema.safeParse({ ...snapshot, privateNotes: 'unapproved' }).success).toBeFalsy();
  const extra = structuredClone(snapshot); Object.assign(extra.sources[0], { rawBody: 'unapproved' });
  expect(publicDemoSnapshotSchema.safeParse(extra).success).toBeFalsy();
  const foreign = structuredClone(snapshot); foreign.sources[3].sourceUrl = 'https://example.com/private';
  expect(publicDemoSnapshotSchema.safeParse(foreign).success).toBeFalsy();
  const mutable = structuredClone(snapshot); mutable.sources[3].sourceUrl = mutable.sources[3].sourceUrl!.replace(/[a-f0-9]{40}/, 'main');
  expect(publicDemoSnapshotSchema.safeParse(mutable).success).toBeFalsy();
  const personalLink = structuredClone(snapshot); personalLink.sources[0].sourceUrl = snapshot.sources[3].sourceUrl;
  expect(publicDemoSnapshotSchema.safeParse(personalLink).success).toBeFalsy();
  const duplicate = structuredClone(snapshot); duplicate.sources[1] = duplicate.sources[0];
  expect(publicDemoSnapshotSchema.safeParse(duplicate).success).toBeFalsy();
  const unrelatedRun = structuredClone(snapshot); unrelatedRun.learning.failureRunUrl = unrelatedRun.learning.passingRunUrl as typeof unrelatedRun.learning.failureRunUrl;
  expect(publicDemoSnapshotSchema.safeParse(unrelatedRun).success).toBeFalsy();
});

test('public demo reads only its fixed native node and fails closed for missing, private or failed responses', async () => {
  const seedModule = await import(pathToFileURL(resolve('../../scripts/seed-public-demo.mjs')).href);
  const snapshot = publicDemoSnapshotSchema.parse(seedModule.createPublicDemoSnapshot());
  const program = transpileModule(readFileSync(resolve('src/lib/public-demo.ts'), 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  let reply = () => Response.json({ success: true, data: [{ snapshot: JSON.stringify(snapshot) }], meta: { request_id: 'fixture-public-native-read' } });
  const moduleExports: { getPublicDemo?: () => Promise<PublicDemoResponse> } = {};
  runInNewContext(program, {
    exports: moduleExports, AbortSignal, Date,
    process: { env: { HYDRA_DB_API_KEY: 'fixture-public-key', HYDRA_DB_DATABASE: 'private-workspace', HYDRA_DB_COLLECTION: 'private-collection' } },
    require: (name: string) => {
      if (name === 'server-only') return {};
      if (name === 'zod') return { z };
      if (name === './public-demo-contracts') return contracts;
      throw new Error(`Unexpected public demo module: ${name}`);
    },
    fetch: async (url: string, options: RequestInit) => {
      requests.push({ url, body: JSON.parse(String(options.body)) });
      return reply();
    },
  });
  const read = moduleExports.getPublicDemo!;
  const valid = await read();
  expect(valid.snapshot).toEqual(snapshot);
  expect(valid.requestId).toBe('fixture-public-native-read');
  expect(requests).toEqual([{ url: 'https://api.hydradb.com/byog/query', body: {
    database: 'rrflow_public_demo', collection: 'rrflow_demo', query: 'MATCH (s:PublicDemoSnapshot {ext_id: $id}) RETURN s.snapshot AS snapshot LIMIT 1', params: { id: 'v1' },
  } }]);
  for (const invalid of [
    { success: true, data: [] },
    { success: true, data: [{ snapshot: JSON.stringify({ ...snapshot, privateNotes: 'must never be published' }) }] },
    { success: true, data: [{ snapshot: '{malformed' }] },
  ]) {
    reply = () => Response.json(invalid);
    const result = await read();
    expect(result.snapshot).toBeNull();
    expect(result.error).toContain('could not be read');
    expect(JSON.stringify(result)).not.toContain('must never be published');
  }
  reply = () => Response.json({ error: 'Private upstream detail' }, { status: 503 });
  const unavailable = await read();
  expect(unavailable.snapshot).toBeNull();
  expect(JSON.stringify(unavailable)).not.toContain('Private upstream detail');
  expect(requests.every(request => request.body.database === 'rrflow_public_demo')).toBeTruthy();
  expect(requests).toHaveLength(5);
});

test('demo route requires a session after expiry and validates the host before every native read', async () => {
  const seedModule = await import(pathToFileURL(resolve('../../scripts/seed-public-demo.mjs')).href);
  const snapshot = publicDemoSnapshotSchema.parse(seedModule.createPublicDemoSnapshot());
  const environment: Record<string, string | undefined> = {
    RRFLOW_ACCESS_MODE: 'public', RRFLOW_PUBLIC_ORIGIN: 'https://rrflow-demo.example',
    RRFLOW_WORKSPACE_PASSWORD: 'fixture-public-demo-password', RRFLOW_SESSION_SECRET: 'fixture-demo-session-secret-at-least-32-characters',
    RRFLOW_DEMO_EXPIRES_AT: new Date(Date.now() + 86_400_000).toISOString(),
  };
  const compile = (path: string) => transpileModule(readFileSync(resolve(path), 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
  const accessExports: { createWorkspaceSession?: (request: Request, password: string) => { token: string | null } } = {};
  runInNewContext(compile('src/lib/access.ts'), {
    exports: accessExports, process: { env: environment }, Date, URL, Buffer,
    require: (name: string) => {
      if (name === 'server-only') return {};
      if (name === 'node:crypto') return crypto;
      throw new Error(`Unexpected access module: ${name}`);
    },
  });
  let reads = 0;
  const routeExports: { GET?: (request: Request) => Promise<Response> } = {};
  runInNewContext(compile('src/app/api/demo/route.ts'), {
    exports: routeExports, Date, URL,
    require: (name: string) => {
      if (name === 'next/server') return { NextResponse: { json: Response.json } };
      if (name === '@/lib/access') return accessExports;
      if (name === '@/lib/public-demo') return { getPublicDemo: async () => { reads++; return { snapshot, checkedAt: new Date().toISOString(), requestId: 'fixture-curated', storage: 'HydraDB' }; } };
      throw new Error(`Unexpected demo route module: ${name}`);
    },
  });
  const get = routeExports.GET!;
  const request = (cookie?: string, path = '/api/demo') => new Request(`https://rrflow-demo.example${path}`, { headers: { host: 'rrflow-demo.example', ...(cookie ? { cookie } : {}) } });
  expect((await get(request())).status).toBe(200);
  expect(reads).toBe(1);
  environment.RRFLOW_DEMO_EXPIRES_AT = new Date(Date.now() - 1000).toISOString();
  const expired = await get(request());
  expect(expired.status).toBe(401); expect((await expired.json()).snapshot).toBeNull();
  expect(expired.headers.get('cache-control')).toBe('private, no-store'); expect(expired.headers.get('vary')).toBe('Cookie');
  expect(reads).toBe(1);
  delete environment.RRFLOW_DEMO_EXPIRES_AT;
  expect((await get(request())).status).toBe(401); expect(reads).toBe(1);
  const token = accessExports.createWorkspaceSession!(new Request('https://rrflow-demo.example/api/session', { method: 'POST', headers: { host: 'rrflow-demo.example', origin: 'https://rrflow-demo.example' } }), environment.RRFLOW_WORKSPACE_PASSWORD!).token;
  const signedIn = await get(request(`__Host-rrflow_session=${token}`));
  expect(signedIn.status).toBe(200); expect((await signedIn.json()).snapshot).toEqual(snapshot); expect(reads).toBe(2);
  expect((await get(request(`__Host-rrflow_session=${token}`, '/api/demo?database=private'))).status).toBe(400); expect(reads).toBe(2);
  for (const key of Object.keys(environment)) delete environment[key];
  expect((await get(new Request('http://localhost/api/demo', { headers: { host: 'localhost' } }))).status).toBe(200); expect(reads).toBe(3);
  expect((await get(new Request('https://unconfigured.example/api/demo', { headers: { host: 'unconfigured.example' } }))).status).toBe(503); expect(reads).toBe(3);
});
