import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import * as qdrantContracts from '../src/lib/qdrant-contracts';
import { qdrantDestinations, qdrantImportSchema, resolveQdrantConnection, type QdrantSnapshot, type QdrantSourcePoint } from '../src/lib/qdrant-contracts';

test('Qdrant connection configuration keeps hosted sources explicit and credentials server-owned', () => {
  expect(resolveQdrantConnection({ scope: 'personal', hosted: false, hasApiKey: false }).endpoint).toBe('http://127.0.0.1:6333');
  expect(resolveQdrantConnection({ scope: 'work', hosted: false, hasApiKey: false }).endpoint).toBe('http://127.0.0.1:6335');
  const disabled = resolveQdrantConnection({ scope: 'personal', hosted: true, hasApiKey: false });
  expect(disabled.endpoint).toBeNull();
  expect(disabled.error).toContain('Previously imported knowledge remains available');
  for (const url of ['http://qdrant.example', 'https://user:password@qdrant.example', 'https://qdrant.example/path', 'https://qdrant.example?api-key=secret', 'https://localhost', 'https://127.0.0.1:6333']) {
    expect(resolveQdrantConnection({ scope: 'work', hosted: true, url, hasApiKey: true }).endpoint).toBeNull();
  }
  expect(resolveQdrantConnection({ scope: 'work', hosted: true, url: 'https://work.qdrant.example:6333', hasApiKey: false }).endpoint).toBeNull();
  const external = resolveQdrantConnection({ scope: 'work', hosted: true, url: 'https://work.qdrant.example:6333/', hasApiKey: true });
  expect(external.endpoint).toBe('https://work.qdrant.example:6333');
  expect(external.location).toBe('external');
  expect(external.displayEndpoint).not.toContain('work.qdrant.example');
  expect(external.collection).toBe('rrflow_sources');
  const shared = { scope: 'personal' as const, hosted: true, url: 'https://shared.qdrant.example:6333', hasApiKey: true, otherUrl: 'https://shared.qdrant.example:6333/', collection: 'rrflow_personal_sources', otherCollection: 'rrflow_shippin_sources' };
  expect(resolveQdrantConnection(shared).endpoint).toBe(shared.url);
  expect(resolveQdrantConnection({ ...shared, otherCollection: shared.collection }).endpoint).toBeNull();
  expect(resolveQdrantConnection({ ...shared, collection: undefined, otherCollection: undefined }).endpoint).toBeNull();
  for (const collection of ['', '../personal', 'private/points', 'space name', 'name?key=x', 'a'.repeat(129)]) expect(resolveQdrantConnection({ ...shared, collection }).endpoint).toBeNull();
  const env = { NODE_ENV: 'test' as const, PATH: process.env.PATH, PORT: '3000', RRFLOW_PUBLIC_ORIGIN: 'https://fixture.rrflow.example', RRFLOW_DEMO_EXPIRES_AT: new Date(Date.now() + 86_400_000).toISOString(), RRFLOW_WORKSPACE_PASSWORD: 'fixture-workspace-password', RRFLOW_SESSION_SECRET: 'fixture-session-secret-at-least-32-characters', HYDRA_DB_API_KEY: 'fixture-hydra', RAINDROP_WRITE_KEY: 'fixture-raindrop', QDRANT_PERSONAL_URL: shared.url, QDRANT_WORK_URL: shared.url, QDRANT_PERSONAL_API_KEY: 'fixture-personal', QDRANT_WORK_API_KEY: 'fixture-work', QDRANT_PERSONAL_COLLECTION: shared.collection, QDRANT_WORK_COLLECTION: shared.otherCollection };
  const preflight = (values: typeof env) => spawnSync(process.execPath, [resolve('../../scripts/modelence-validate.mjs'), '--runtime'], { env: values, encoding: 'utf8' });
  expect(preflight(env).status).toBe(0);
  const collision = preflight({ ...env, QDRANT_WORK_COLLECTION: shared.collection });
  expect(collision.status).toBe(1); expect(collision.stderr).toContain('distinct collections');
});

test('Qdrant shared-cluster reads and imports use scoped collection paths and distinct provenance IDs', async () => {
  const nativeRequire = createRequire(resolve('src/lib/qdrant.ts'));
  const compiled = ts.transpileModule(readFileSync(resolve('src/lib/qdrant.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compiled)((name: string) => name === 'server-only' ? {} : name === './qdrant-contracts' ? qdrantContracts : nativeRequire(name), loaded, loaded.exports);
  const api = loaded.exports as typeof import('../src/lib/qdrant');
  const variables = { RRFLOW_ACCESS_MODE: 'public', RRFLOW_PUBLIC_ORIGIN: '', SITE_URL: '', QDRANT_PERSONAL_URL: 'https://fixture.qdrant.example:6333', QDRANT_WORK_URL: 'https://fixture.qdrant.example:6333', QDRANT_PERSONAL_API_KEY: 'fixture-personal-key', QDRANT_WORK_API_KEY: 'fixture-work-key', QDRANT_PERSONAL_COLLECTION: 'rrflow_personal_sources', QDRANT_WORK_COLLECTION: 'rrflow_shippin_sources', HYDRA_DB_API_KEY: 'fixture-hydra-key' };
  const previous = new Map(Object.keys(variables).map(name => [name, process.env[name]]));
  const previousFetch = globalThis.fetch;
  const calls: string[] = [], ingested: { database: string; metadata: { qdrant_collection: string; workspace: string }; id: string }[] = [];
  const point = (scope: string) => ({ id: '11111111-1111-4111-8111-111111111111', payload: { scope, title: 'Fixture source', text: 'Explicit fixture context', sourceKind: 'fixture', provenance: 'Fixture test only' } });
  Object.assign(process.env, variables);
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); calls.push(url.pathname);
    if (url.hostname === 'api.hydradb.com') {
      if (url.pathname === '/context/ingest') {
        const form = init!.body as FormData;
        const items = JSON.parse(String(form.get('app_knowledge')));
        for (const item of items) ingested.push({ database: String(form.get('database')), metadata: item.additional_metadata, id: item.id });
        return Response.json({ success: true, data: { results: items.map((item: { id: string }) => ({ id: item.id, status: 'queued' })) } });
      }
      return Response.json({ success: true, data: [{ count: 1 }] });
    }
    expect(['fixture.qdrant.example', '127.0.0.1']).toContain(url.hostname);
    const scope = url.pathname.includes('personal') || url.port === '6333' && url.hostname === '127.0.0.1' ? 'personal' : 'work';
    expect(new Headers(init?.headers).get('api-key')).toBe(scope === 'personal' ? 'fixture-personal-key' : 'fixture-work-key');
    const result = url.pathname === '/collections' ? { collections: ['rrflow_personal_sources', 'rrflow_shippin_sources', 'rrflow_sources'].map(name => ({ name })) }
      : url.pathname.endsWith('/points/scroll') ? { points: [point(scope), point(scope === 'personal' ? 'work' : 'personal')], next_page_offset: null }
      : url.pathname.endsWith('/points') ? [point(scope)] : { points_count: 2 };
    return Response.json({ status: 'ok', result });
  };
  try {
    // Catalog calls have no scope in the path, so check credentials only on actual source reads.
    const fetchSource = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      if (new URL(String(input)).pathname === '/collections') { calls.push('/collections'); return Response.json({ status: 'ok', result: { collections: [process.env.QDRANT_PERSONAL_COLLECTION, process.env.QDRANT_WORK_COLLECTION, 'rrflow_sources'].filter(Boolean).map(name => ({ name })) } }); }
      return fetchSource(input, init);
    };
    const snapshot = await api.readQdrantSources(undefined, false);
    expect(snapshot.sources.map(source => [source.scope, source.collection, source.points.length])).toEqual([['personal', 'rrflow_personal_sources', 1], ['work', 'rrflow_shippin_sources', 1]]);
    for (const source of snapshot.sources) {
      expect(source.warnings.join(' ')).toContain('different scope');
      expect(source.points[0].hydraId).toBe(`qdrant:${source.scope}:${source.collection}:${source.points[0].id}`);
      await api.importQdrantSources({ scope: source.scope, points: source.points.map(({ id, version }) => ({ id, version })) }, [], []);
    }
    expect(ingested.map(item => [item.database, item.metadata.qdrant_collection, item.metadata.workspace])).toEqual([['default-tenant', 'rrflow_personal_sources', 'personal'], ['rrflow_specialist', 'rrflow_shippin_sources', 'shippin']]);
    expect(calls).toContain('/collections/rrflow_personal_sources/points');
    expect(calls).toContain('/collections/rrflow_shippin_sources/points');
    const before = calls.length;
    process.env.QDRANT_WORK_COLLECTION = process.env.QDRANT_PERSONAL_COLLECTION;
    const blocked = await api.readQdrantSources(undefined, false);
    expect(blocked.sources.every(source => !source.connected && source.error?.includes('different collections'))).toBe(true);
    expect(calls).toHaveLength(before);
    process.env.QDRANT_PERSONAL_COLLECTION = 'personal_' + 'x'.repeat(119);
    const longName = await api.readQdrantSources('personal', false);
    const longId = longName.sources[0].points[0].hydraId;
    expect(longId).toMatch(/^qdrant:personal:sha256:[a-f0-9]{64}$/);
    expect(Buffer.byteLength(longId)).toBeLessThanOrEqual(100);
    expect(longName.sources[0].collection).toHaveLength(128);
    process.env.QDRANT_PERSONAL_COLLECTION = 'personal_' + 'y'.repeat(119);
    expect((await api.readQdrantSources('personal', false)).sources[0].points[0].hydraId).not.toBe(longId);
    delete process.env.RRFLOW_ACCESS_MODE;
    delete process.env.QDRANT_PERSONAL_URL; delete process.env.QDRANT_WORK_URL;
    delete process.env.QDRANT_PERSONAL_COLLECTION; delete process.env.QDRANT_WORK_COLLECTION;
    const local = await api.readQdrantSources('personal', false);
    expect(local.sources[0].points[0].hydraId).toBe('qdrant:personal:rrflow_sources:11111111-1111-4111-8111-111111111111');
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of previous) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});

test('local Qdrant services keep Personal and Work records and vector configuration separate', async ({ request }) => {
  const ids: Record<string, (string | number)[]> = {};
  for (const [scope, port, kind] of [['personal', 6333, 'user-provided-goals'], ['work', 6335, 'public-repository-document']] as const) {
    const base = `http://127.0.0.1:${port}`;
    const response = await request.get(`${base}/collections/rrflow_sources`);
    expect(response.ok()).toBeTruthy();
    const info = (await response.json()).result;
    expect(info.points_count).toBeGreaterThanOrEqual(3);
    expect(info.config.params.vectors).toEqual({});
    const page = await request.post(`${base}/collections/rrflow_sources/points/scroll`, { data: { limit: 100, with_payload: true, with_vector: false } });
    expect(page.ok()).toBeTruthy();
    const points = (await page.json()).result.points;
    expect(points.every((point: { payload: { scope: string } }) => point.payload.scope === scope)).toBeTruthy();
    expect(points.filter((point: { payload: { seedNamespace?: string; sourceKind?: string } }) => point.payload.seedNamespace === 'rrflow-initial-source-v1').every((point: { payload: { sourceKind: string } }) => point.payload.sourceKind === kind)).toBeTruthy();
    ids[scope] = points.map((point: { id: string | number }) => point.id);
  }
  expect(ids.personal.some(id => ids.work.includes(id))).toBeFalsy();
  const wrongScope = await request.post('http://127.0.0.1:6335/collections/rrflow_sources/points', { data: { ids: ids.personal, with_payload: true, with_vector: false } });
  expect((await wrongScope.json()).result).toEqual([]);
});

test('Qdrant source UI reviews provenance and imports only the selected scope', async ({ page }) => {
  const point = (scope: 'personal' | 'work'): QdrantSourcePoint => ({
    id: scope === 'personal' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222', title: `${scope} fixture source`, text: 'Fixture source body for selection and provenance testing.',
    sourceKind: scope === 'personal' ? 'user-provided-goals' : 'public-repository-document', provenance: 'Explicit fixture provenance', sourceUrl: null, updatedAt: new Date().toISOString(), version: 'a'.repeat(64), hydraId: `qdrant:${scope}:fixture`, importedAt: null, importedVersion: null, indexingStatus: null,
  });
  const snapshot: QdrantSnapshot = { checkedAt: new Date().toISOString(), receipts: [], qdrantReceipts: [], sources: (['personal', 'work'] as const).map(scope => ({ scope, endpoint: scope === 'personal' ? 'http://127.0.0.1:6333' : 'http://127.0.0.1:6335', database: qdrantDestinations[scope], collection: 'rrflow_sources', connected: true, total: 1, collections: ['rrflow_sources'], points: [point(scope)], hasMore: false, warnings: [], checkedAt: new Date().toISOString() })) };
  const actions: unknown[] = [];
  await page.route('**/api/qdrant*', async route => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON(); actions.push(input);
      const selected = snapshot.sources.find(item => item.scope === input.scope)!.points[0];
      selected.importedAt = new Date().toISOString(); selected.importedVersion = selected.version; selected.indexingStatus = 'queued';
      await route.fulfill({ json: { accepted: 1, database: qdrantDestinations[input.scope as 'personal' | 'work'], collection: 'qdrant_sources', ids: [selected.hydraId], importedAt: selected.importedAt, receipts: [], qdrantReceipts: [], message: '1 sources accepted by HydraDB. Indexing runs next; refresh to see their status.' } });
    } else if (new URL(route.request().url()).searchParams.get('evidence') === '0') await route.fulfill({ json: { ...snapshot, sources: snapshot.sources.map(source => ({ ...source, evidencePending: true })) } });
    else await route.fulfill({ json: snapshot });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  const libraries = page.getByRole('region', { name: 'Qdrant source libraries' });
  await expect(libraries.getByRole('heading', { name: 'Personal life', exact: true })).toBeVisible();
  await expect(libraries.getByRole('heading', { name: 'Work · Shippin', exact: true })).toBeVisible();
  await libraries.getByText('Read source and provenance', { exact: true }).first().click();
  await expect(libraries.getByText('Explicit fixture provenance').first()).toBeVisible();
  await libraries.getByRole('checkbox', { name: 'personal fixture source' }).check();
  await libraries.getByRole('button', { name: 'Import 1 Personal sources' }).click();
  await expect(libraries.getByRole('status')).toContainText('accepted by HydraDB');
  await expect(libraries.getByText('HydraDB: queued', { exact: true })).toBeVisible();
  expect(actions).toEqual([{ scope: 'personal', points: [{ id: '11111111-1111-4111-8111-111111111111', version: 'a'.repeat(64) }] }]);
  snapshot.sources[0].points[0].indexingStatus = 'completed';
  await libraries.getByRole('button', { name: 'Refresh source libraries' }).click();
  await expect(libraries.getByText('Indexed in HydraDB', { exact: true })).toBeVisible();
  snapshot.sources[0].points[0].importedVersion = null;
  await libraries.getByRole('button', { name: 'Refresh source libraries' }).click();
  await expect(libraries.getByText('HydraDB source indexed · current version unconfirmed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Connectome', exact: true }).click();
  await page.getByRole('button', { name: 'Qdrant source records', exact: true }).click();
  await expect(libraries.getByRole('checkbox', { name: 'personal fixture source' })).toBeVisible();
  await expect(libraries.getByRole('checkbox', { name: 'work fixture source' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('section[aria-label="Qdrant source libraries"]').analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await libraries.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
});

test('Qdrant imports reject destination overrides and stale reviewed versions before HydraDB writes', async ({ request }) => {
  const input = { scope: 'personal', points: [{ id: '11111111-1111-4111-8111-111111111111', version: 'a'.repeat(64) }], database: 'rrflow_specialist' };
  expect(qdrantImportSchema.safeParse(input).success).toBeFalsy();
  const overridden = await request.post('/api/qdrant', { data: input });
  expect(overridden.status()).toBe(400);
  expect((await overridden.json()).receipts).toEqual([]);
  const response = await request.get('/api/qdrant?scope=personal');
  expect(response.ok()).toBeTruthy();
  const snapshot = await response.json() as QdrantSnapshot;
  expect(snapshot.sources[0].database).toBe('default-tenant');
  expect(snapshot.sources[0].points.length).toBeGreaterThan(0);
  const stale = await request.post('/api/qdrant', { data: { scope: 'personal', points: [{ id: snapshot.sources[0].points[0].id, version: '0'.repeat(64) }] } });
  expect(stale.status()).toBe(409);
  const failure = await stale.json();
  expect(failure.receipts).toEqual([]);
  expect(failure.qdrantReceipts).toHaveLength(1);
  const crossSite = await request.post('/api/qdrant', { headers: { origin: 'https://unrelated.example' }, data: { scope: 'personal', points: [] } });
  expect(crossSite.status()).toBe(403);
  expect((await crossSite.json()).error).toBe('Cross-site workspace access is not allowed.');
});

test('authorized Qdrant seed records import into each correct HydraDB scope', async ({ request }, testInfo) => {
  test.skip(process.env.RRFLOW_QDRANT_LIVE_IMPORT !== '1', 'Run explicitly when verifying the authorized source import.');
  const evidence = [];
  for (const scope of ['personal', 'work'] as const) {
    const before = await request.get(`/api/qdrant?scope=${scope}`);
    const source = (await before.json() as QdrantSnapshot).sources[0];
    expect(source.connected).toBeTruthy();
    const response = await request.post('/api/qdrant', { data: { scope, points: source.points.map(point => ({ id: point.id, version: point.version })) } });
    const result = await response.json();
    expect(response.ok(), JSON.stringify(result)).toBeTruthy();
    expect(result.database).toBe(qdrantDestinations[scope]);
    expect(result.accepted).toBe(source.points.length);
    expect(result.receipts.find((receipt: { endpoint: string }) => receipt.endpoint === '/context/ingest')).toMatchObject({ outcome: 'ok', database: qdrantDestinations[scope] });
    const after = await request.get(`/api/qdrant?scope=${scope}`);
    const updated = (await after.json() as QdrantSnapshot).sources[0];
    expect(updated.points.every(point => point.importedVersion === point.version && !!point.importedAt)).toBeTruthy();
    evidence.push({ scope, database: result.database, count: result.accepted, requestIds: result.receipts.map((receipt: { requestId: string }) => receipt.requestId), statuses: updated.points.map(point => ({ id: point.hydraId, status: point.indexingStatus })) });
  }
  await testInfo.attach('qdrant-native-import-evidence', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
});
