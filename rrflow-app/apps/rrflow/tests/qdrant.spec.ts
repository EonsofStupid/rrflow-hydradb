import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { qdrantDestinations, qdrantImportSchema, type QdrantSnapshot, type QdrantSourcePoint } from '../src/lib/qdrant-contracts';

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
  expect(crossSite.ok()).toBeFalsy();
  expect((await crossSite.json()).receipts).toEqual([]);
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
