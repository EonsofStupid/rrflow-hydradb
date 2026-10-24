import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
import { connectionsActionSchema, publicWebhookUrl, type ConnectionsOverview } from '../src/lib/connections-contracts';
import * as databaseContracts from '../src/lib/databases-contracts';

const destinations: ConnectionsOverview['destinations'] = [
  { name: 'default-tenant', workspace: 'personal', label: 'Personal life · default-tenant' },
  { name: 'rrflow_specialist', workspace: 'shippin', label: 'Shippin work · rrflow_specialist' },
];

test('connector setup selects a brain and sources before sync, and webhooks require explicit organization consent', async ({ page }) => {
  const now = new Date().toISOString();
  const connector = { id: 'test_connector', name: 'RRFLOW GitHub', provider: 'github', database: 'rrflow_specialist', workspace: 'shippin', collection: 'connected-sources', lifecycle: 'pending_setup', syncStatus: 'idle', lastAttempt: null, lastSuccess: null, nextSync: null, dispatched: 0, resources: 0, needsAttention: false };
  let created = false; let registered = false;
  const actions: Record<string, unknown>[] = [];
  await page.route('**/api/connections*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    let body: Record<string, unknown>;
    if (request.method() === 'POST') {
      const action = request.postDataJSON(); actions.push(action);
      if (action.action === 'create') { created = true; body = { connector, message: 'Account connected. Choose sources.' }; }
      else if (action.action === 'configure') body = { message: 'Sources selected. HydraDB has started ingestion.' };
      else if (action.action === 'register-webhook') { registered = true; body = { message: 'Indexing notifications are registered.', signingSecret: 'fixture-generated-secret-not-a-real-key' }; }
      else if (action.action === 'test-webhook') body = { delivered: true, receiverStatus: 204, message: 'The receiver accepted the test notification.' };
      else body = { message: 'Sync requested. This confirms the request, not that indexing has finished.' };
    } else if (url.searchParams.get('view') === 'provider') body = { provider: { id: 'github', objectTypes: ['issues', 'issue_comments'], fields: [{ name: 'access_token', description: 'GitHub token with repository and issues read access.', type: 'string', required: true }], complexCredentials: false, setup: null, scopes: [] } };
    else if (url.searchParams.get('view') === 'discover') body = { connector, discovery: { resources: [{ id: 'repo-1', name: 'eonsofstupid/rrflow-hydradb', type: 'repo' }], nextCursor: null } };
    else if (url.searchParams.get('view') === 'connector') body = { detail: { connector: { ...connector, lifecycle: 'ingesting', resources: 1 }, health: 'checking', resources: [{ id: 'repo-1', name: 'rrflow-hydradb', status: 'pending', rows: null }] } };
    else body = { overview: { providers: [{ id: 'github', category: 'development', webhook: false, beta: false }], destinations, unassigned: [], connectorListAvailable: true, connectors: created ? [connector] : [], webhook: { registered, url: registered ? 'https://hooks.example.com/hydradb' : null, signing: registered, events: ['indexing.status_changed'] }, deliveries: [], warnings: [], checkedAt: now } };
    await route.fulfill({ json: { ...body, receipts: [] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  const console = page.getByRole('region', { name: 'Knowledge connections' });
  await expect(console.getByText('No connections with verified workspace assignments were returned.')).toBeVisible();
  await expect(console.getByText('This native connector indexes GitHub issues and their comments.', { exact: false })).toBeVisible();
  await console.getByLabel('Account or organization').fill('eonsofstupid');
  await console.getByLabel('access token').fill('fixture-token-not-a-real-key');
  await console.getByRole('button', { name: 'Connect account', exact: true }).click();
  await expect(console.getByLabel('access token')).toHaveValue('');
  await console.getByRole('checkbox', { name: 'eonsofstupid/rrflow-hydradb' }).check();
  await console.getByRole('button', { name: 'Start learning from 1 sources' }).click();
  await expect(console.getByText('Health: checking', { exact: false })).toBeVisible();
  expect(actions.map(item => item.action)).toEqual(['create', 'configure']);
  expect(actions[0].database).toBe('rrflow_specialist');
  expect(actions[1].resources).toEqual([{ id: 'repo-1', name: 'eonsofstupid/rrflow-hydradb', type: 'repo' }]);
  await console.getByLabel('Public receiver URL').fill('https://hooks.example.com/hydradb');
  await expect(console.getByRole('button', { name: 'Save indexing webhook' })).toBeDisabled();
  await console.getByRole('checkbox', { name: 'I understand this updates' }).check();
  await console.getByRole('button', { name: 'Save indexing webhook' }).click();
  await expect(console.getByText('Signing secret returned once')).toBeVisible();
  await expect(console).not.toContainText('fixture-generated-secret-not-a-real-key');
  await console.getByRole('button', { name: 'Send test notification' }).click();
  await expect(console.getByRole('status')).toContainText('Receiver HTTP 204');
  await console.getByRole('button', { name: 'Dismiss secret' }).click();
  await expect(console.getByText('Signing secret returned once')).not.toBeVisible();
  expect((await new AxeBuilder({ page }).include('section[aria-label="Knowledge connections"]').analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await console.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
});

test('connection inputs validate destination syntax, local webhooks and unexpected fields before native writes', async ({ request }) => {
  for (const value of ['http://example.com/hook', 'https://localhost/hook', 'https://example.com/hook?key=hidden', 'https://user:pass@example.com/hook']) expect(publicWebhookUrl.safeParse(value).success).toBeFalsy();
  for (const database of ['default-tenant', 'new_project']) expect(connectionsActionSchema.safeParse({ action: 'create', provider: 'github', name: 'Valid syntax', database, account: '', credentials: {} }).success).toBeTruthy();
  expect(connectionsActionSchema.safeParse({ action: 'create', provider: 'github', name: 'Invalid syntax', database: '../outside', account: '', credentials: {} }).success).toBeFalsy();
  expect(connectionsActionSchema.safeParse({ action: 'test-webhook', credentials: { secret: 'unused' } }).success).toBeFalsy();
  const result = await request.post('/api/connections', { data: { action: 'register-webhook', url: 'http://localhost:3100/callback', generateSecret: true, acknowledgeOrganization: true } });
  expect(result.status()).toBe(400);
  expect((await result.json()).receipts).toEqual([]);
  const blocked = await request.post('/api/connections', { headers: { origin: 'https://unrelated.example' }, data: { action: 'test-webhook' } });
  expect(blocked.ok()).toBeFalsy();
  expect(blocked.status()).toBe(403);
  expect(await blocked.json()).toEqual({ error: 'Cross-site workspace access is not allowed.' });
});

test('connector setup shows Personal, discovers newly assigned brains and keeps unresolved destinations visible', async ({ page }) => {
  const personal: ConnectionsOverview['connectors'][number] = { id: 'personal_mail', name: 'Personal Gmail', provider: 'gmail', database: 'default-tenant', workspace: 'personal', collection: 'gmail', lifecycle: 'active', syncStatus: 'idle', lastAttempt: null, lastSuccess: '2026-10-24T19:59:43Z', nextSync: null, dispatched: 12, resources: 2, needsAttention: false };
  const overview: ConnectionsOverview = { providers: [{ id: 'github', category: 'development', webhook: false, beta: false }], destinations: [...destinations], connectors: [personal], unassigned: [{ id: 'unassigned', provider: 'github', database: 'unassigned_db', reason: 'Assign this database to a workspace before connecting sources.' }], connectorListAvailable: true, webhook: null, deliveries: [], warnings: [], checkedAt: new Date().toISOString() };
  await page.route('**/api/connections*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.has('view') ? { receipts: [], provider: { id: 'github', fields: [], objectTypes: ['issues'], scopes: [], setup: null, complexCredentials: false } } : { overview, receipts: [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  const console = page.getByRole('region', { name: 'Knowledge connections' });
  const connected = console.getByRole('region', { name: 'Connected sources', exact: true });
  await expect(connected.getByText('Personal Gmail', { exact: true })).toBeVisible();
  await expect(connected).toContainText('Personal life · default-tenant');
  await expect(connected).toContainText('12 objects sent to indexing');
  const review = console.getByRole('region', { name: 'Connections awaiting assignment' });
  await expect(review).toContainText('unassigned_db');
  await expect(review.getByRole('button')).toHaveCount(0);
  const picker = console.getByLabel('Which brain should learn?');
  overview.destinations.push({ name: 'launch_project', workspace: 'shippin', label: 'Shippin work · launch_project' });
  await console.getByRole('button', { name: 'Refresh connections' }).click();
  await expect(picker.locator('option[value="launch_project"]')).toHaveCount(1);
  await picker.selectOption('launch_project');
  await expect(picker).toHaveValue('launch_project');
  overview.destinations = [...destinations];
  await console.getByRole('button', { name: 'Refresh connections' }).click();
  await expect(picker).toHaveValue('');
  await expect(console.getByRole('button', { name: 'Connect account', exact: true })).toBeDisabled();
  overview.destinations = []; overview.connectors = []; overview.connectorListAvailable = false;
  overview.warnings = ['Database assignments could not load. Connection changes are unavailable until a successful refresh.'];
  await console.getByRole('button', { name: 'Refresh connections' }).click();
  await expect(picker).toBeDisabled();
  await expect(connected).toContainText('Connection inventory is unavailable');
  await expect(connected).not.toContainText('No connections');
  await expect(console.getByRole('button', { name: 'Connect account', exact: true })).toBeDisabled();
});

test('connection inputs resolve explicit assignments without treating names, ghosts or conflicts as permission', () => {
  const { resolveDatabaseAssignments } = databaseContracts;
  const catalog = ['default-tenant', 'rrflow_specialist', 'personal', 'custom_project', 'constructor', 'conflicted'];
  const memberships = [{ name: 'custom_project', workspace: 'shippin' as const }, { name: 'ghost', workspace: 'personal' as const }, { name: 'conflicted', workspace: 'personal' as const }, { name: 'conflicted', workspace: 'shippin' as const }, { name: 'failed_brain', workspace: 'shippin' as const }];
  const result = resolveDatabaseAssignments(catalog, ['failed_brain'], memberships);
  expect(result.databases.filter(item => item.available).map(item => [item.name, item.workspace])).toEqual([['default-tenant', 'personal'], ['rrflow_specialist', 'shippin'], ['custom_project', 'shippin']]);
  expect(result.databases.some(item => item.name === 'ghost')).toBe(false);
  expect(result.databases.find(item => item.name === 'failed_brain')).toMatchObject({ available: false, provisioningFailed: true });
  expect(result.databases.find(item => item.name === 'conflicted')?.issue).toContain('conflict');
  const conflict = resolveDatabaseAssignments(['default-tenant'], [], [{ name: 'default-tenant', workspace: 'shippin' }]);
  expect(conflict.databases[0]).toMatchObject({ available: false, workspace: null });
  const outage = resolveDatabaseAssignments(catalog, [], null);
  expect(outage.databases.filter(item => item.available).map(item => item.name)).toEqual(['default-tenant', 'rrflow_specialist']);
  expect(outage.warnings).toHaveLength(1);
});

// Exercise the real server modules while replacing only network I/O. Playwright remains the test runner.
const loadServerModule = (path: string, dependencies: Record<string, unknown>) => {
  const nativeRequire = createRequire(resolve(path));
  const compiled = ts.transpileModule(readFileSync(resolve(path), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compiled)((name: string) => name === 'server-only' ? {} : Object.hasOwn(dependencies, name) ? dependencies[name] : nativeRequire(name), loaded, loaded.exports);
  return loaded.exports;
};

test('connection inputs enforce live native membership and every resource destination before connector writes', async () => {
  const databases = loadServerModule('src/lib/databases.ts', { './databases-contracts': databaseContracts }) as typeof import('../src/lib/databases');
  const api = loadServerModule('src/lib/connections.ts', { './databases': databases, './databases-contracts': databaseContracts }) as typeof import('../src/lib/connections');
  const savedKey = process.env.HYDRA_DB_API_KEY, savedFetch = globalThis.fetch;
  process.env.HYDRA_DB_API_KEY = 'fixture-not-a-real-key';
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  let memberships: unknown = [{ name: 'launch_project', workspace: 'shippin' }];
  let registryUnavailable = false, catalogUnavailable = false;
  let nativeConnector = { connector_id: 'fixture_connector', name: 'Fixture source', provider: 'github', tenant_id: 'default-tenant', collection: 'sources' };
  let resources: unknown = { resources: [{ resource_id: 'source-1' }] };
  let createDestination: string | null = null;
  let connectorList: unknown = { connectors: [nativeConnector, { ...nativeConnector, connector_id: 'unassigned', tenant_id: 'personal' }] };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)), method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ path: url.pathname, method, body });
    expect(url.origin).toBe('https://api.hydradb.com');
    if (url.pathname === '/databases') return catalogUnavailable ? Response.json({}, { status: 503 }) : Response.json({ success: true, data: { databases: ['default-tenant', 'rrflow_specialist', 'launch_project', 'personal'], failed_databases: [{ database: 'failed_brain' }] } });
    if (url.pathname === '/byog/query') {
      expect(body.query).toMatch(/^MATCH /); // No registry writes during resolution.
      return registryUnavailable ? Response.json({}, { status: 503 }) : Response.json({ success: true, data: memberships });
    }
    if (url.pathname === '/databases/status') return Response.json({ success: true, data: { infra: { ready_for_ingestion: true } } });
    if (url.pathname === '/connectors' && method === 'POST') return Response.json({ ...nativeConnector, tenant_id: createDestination ?? body.database });
    if (url.pathname === '/connectors') return Response.json(connectorList);
    if (url.pathname === '/connectors/providers') return Response.json({ providers: [] });
    if (url.pathname === '/webhooks/indexing') return Response.json({ registered: false });
    if (url.pathname === '/webhooks/indexing/deliveries') return Response.json({ deliveries: [] });
    if (url.pathname === '/connectors/fixture_connector') return Response.json(nativeConnector);
    if (url.pathname === '/connectors/fixture_connector/resources') return Response.json(resources);
    if (/\/connectors\/fixture_connector\/(sync|resume|pause|configure)$/.test(url.pathname)) return Response.json({ success: true });
    throw new Error(`Unexpected native request: ${method} ${url.pathname}`);
  };
  const writes = () => calls.filter(call => call.method === 'POST' && call.path !== '/byog/query');
  const create = (database: string) => api.changeConnections(connectionsActionSchema.parse({ action: 'create', provider: 'github', name: 'Fixture', database, account: '', credentials: {} }), []);
  const sync = (action: 'sync' | 'resume' = 'sync') => api.changeConnections({ action, connectorId: 'fixture_connector' }, []);
  const configure = () => api.changeConnections({ action: 'configure', connectorId: 'fixture_connector', lookbackDays: 30, resources: [{ id: 'new-source', name: 'New source', type: 'repo' }] }, []);
  try {
    const overview = (await api.readConnections({ view: 'overview' }, [])).overview!;
    expect(overview.connectors.map(item => [item.id, item.workspace])).toEqual([['fixture_connector', 'personal']]);
    expect(overview.unassigned).toMatchObject([{ id: 'unassigned', database: 'personal' }]);
    expect(overview.destinations.map(item => item.name)).toEqual(['default-tenant', 'rrflow_specialist', 'launch_project']);
    const snapshot = await databases.listDatabases([]);
    expect(snapshot.databases.find(item => item.name === 'failed_brain')).toMatchObject({ ready: false, status: 'Database creation failed' });
    for (const name of ['personal', 'unknown_brain', 'failed_brain']) await expect(create(name)).rejects.toBeInstanceOf(api.ConnectionScopeError);
    expect(writes()).toHaveLength(0);
    for (const name of ['default-tenant', 'launch_project']) expect((await create(name)).connector?.database).toBe(name);
    expect(writes().map(call => call.body.database)).toEqual(['default-tenant', 'launch_project']);
    calls.length = 0;
    for (const sourceList of [undefined, [null], [{}], [{ resource_id: 'r', database: 'launch_project' }], [{ resource_id: 'r', database_override: 'launch_project' }], [{ resource_id: 'r', tenant_id_override: 'launch_project' }], [{ resource_id: 'r', database: 'personal' }], [{ resource_id: 'r', database_override: 'default-tenant', tenant_id_override: 'launch_project' }], [{ resource_id: 'r', database: 'default-tenant', tenant_id: 'launch_project' }]]) {
      resources = { resources: sourceList };
      await expect(sync()).rejects.toBeInstanceOf(api.ConnectionScopeError);
      await expect(sync('resume')).rejects.toBeInstanceOf(api.ConnectionScopeError);
      await expect(configure()).rejects.toBeInstanceOf(api.ConnectionScopeError);
    }
    for (const paging of [{ has_more: true }, { next_cursor: 'page-2' }]) {
      resources = { resources: [{ resource_id: 'r' }], ...paging };
      await expect(sync()).rejects.toBeInstanceOf(api.ConnectionScopeError);
    }
    expect(writes()).toHaveLength(0);
    resources = { resources: [] }; // First configuration has no existing resources.
    await configure();
    expect(writes()[0].body.resources).toEqual([{ resource_id: 'new-source', resource_type: 'repo', name: 'New source', database: 'default-tenant', collection: 'sources' }]);
    calls.length = 0;
    resources = { resources: [{ resource_id: 'r', database: 'default-tenant' }] };
    await sync();
    expect(writes().map(call => call.path)).toEqual(['/connectors/fixture_connector/sync']);
    nativeConnector = { ...nativeConnector, tenant_id: 'rrflow_specialist' };
    resources = { resources: [{ resource_id: 'r', database_override: 'launch_project', tenant_id_override: 'launch_project' }] };
    await sync('resume'); // An explicitly assigned destination in the same workspace is permitted.
    calls.length = 0;
    memberships = []; // Fresh resolution on every action, even if a previous UI read allowed it.
    await expect(sync()).rejects.toBeInstanceOf(api.ConnectionScopeError);
    await expect(create('launch_project')).rejects.toBeInstanceOf(api.ConnectionScopeError);
    memberships = [{ name: 'launch_project', workspace: 'shippin' }]; registryUnavailable = true;
    await expect(create('launch_project')).rejects.toBeInstanceOf(api.ConnectionScopeError);
    expect(writes()).toHaveLength(0);
    expect((await create('default-tenant')).connector?.workspace).toBe('personal');
    registryUnavailable = false; createDestination = 'rrflow_specialist';
    await expect(create('default-tenant')).rejects.toThrow('unexpected connector destination');
    createDestination = null; nativeConnector = { ...nativeConnector, connector_id: 'wrong_id' }; calls.length = 0;
    await expect(sync()).rejects.toBeInstanceOf(api.ConnectionScopeError);
    expect(writes()).toHaveLength(0);
    connectorList = {}; const malformed = (await api.readConnections({ view: 'overview' }, [])).overview!;
    expect(malformed.connectorListAvailable).toBe(false); expect(malformed.warnings.join(' ')).toContain('unexpected response');
    catalogUnavailable = true;
    const unavailable = (await api.readConnections({ view: 'overview' }, [])).overview!;
    expect(unavailable.destinations).toEqual([]);
    await expect(create('default-tenant')).rejects.toThrow();
    expect(writes()).toHaveLength(0);
  } finally {
    globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.HYDRA_DB_API_KEY; else process.env.HYDRA_DB_API_KEY = savedKey;
  }
});
