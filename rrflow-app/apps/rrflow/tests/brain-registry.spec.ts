import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { resolveDatabaseAssignments } from '../src/lib/databases-contracts';
import { brainRegistrationSchema, brainRegistryActionSchema, planBrainRegistryChange, resolveRegisteredBrain, validateBrainRegistry, type BrainRegistryAction, type BrainRegistrySnapshot } from '../src/lib/brain-registry-contracts';

const now = '2026-10-24T22:00:00.000Z';
const firstId = 'brain-11111111-1111-4111-8111-111111111111';
const nextId = 'brain-22222222-2222-4222-8222-222222222222';
const empty = (): BrainRegistrySnapshot => ({ workspace: 'personal', revision: 0, brains: [], checkedAt: now, receipts: [] });
const register = (changes: Record<string, unknown> = {}) => brainRegistryActionSchema.parse({ action: 'register', workspace: 'personal', expectedRevision: 0, projectId: null, projectSlug: 'shared', purpose: 'knowledge', displayName: 'Personal sources', database: 'default-tenant', collection: 'gmail', ...changes });

test('brain registry preserves identity and binding through renames and rejects aliases, stale revisions and conflicting projects', () => {
  const first = planBrainRegistryChange(empty(), register(), firstId, now);
  const snapshot = { ...empty(), revision: 1, brains: first.brains };
  const rename = brainRegistryActionSchema.parse({ action: 'rename', workspace: 'personal', expectedRevision: 1, brainId: firstId, displayName: 'Life library', projectSlug: 'shared', purpose: 'catalog' });
  const renamed = planBrainRegistryChange(snapshot, rename, nextId, now);
  expect(renamed.brain).toMatchObject({ id: firstId, database: 'default-tenant', collection: 'gmail', revision: 2, aliases: ['personal/shared/knowledge'], canonicalName: 'personal/shared/catalog', createdAt: now });
  const final = { ...empty(), revision: 2, brains: renamed.brains };
  expect(resolveRegisteredBrain(final, 'personal/shared/knowledge')).toEqual({ brain: renamed.brain, matchedAlias: true });
  expect(resolveRegisteredBrain(final, 'personal/shared/catalog').matchedAlias).toBe(false);
  expect(() => resolveRegisteredBrain(final, 'work/shared/catalog')).toThrow(/not registered/);
  expect(() => planBrainRegistryChange(final, register({ expectedRevision: 2, collection: 'github' }), nextId, now)).toThrow(/alias/);
  expect(() => planBrainRegistryChange(final, register({ expectedRevision: 2, purpose: 'intake' }), nextId, now)).toThrow(/already have a registered/);
  expect(() => planBrainRegistryChange(final, rename, nextId, now)).toThrow(/registry changed/);
  expect(() => planBrainRegistryChange(empty(), register({ projectSlug: 'project-without-id' }), firstId, now)).toThrow(/saved project/);
  expect(() => validateBrainRegistry('personal', [renamed.brain, renamed.brain])).toThrow(/Duplicate/);
  expect(() => validateBrainRegistry('shippin', [renamed.brain])).toThrow(/inconsistent/);
  expect(brainRegistryActionSchema.safeParse({ ...rename, database: 'shippin_cloud' }).success).toBe(false);
  expect(brainRegistryActionSchema.safeParse({ ...register(), brainId: firstId }).success).toBe(false);
  expect(resolveDatabaseAssignments(['rrflow_registry'], [], [{ name: 'rrflow_registry', workspace: 'personal' }]).databases[0]).toMatchObject({ workspace: null, available: false });
  const linked = planBrainRegistryChange(empty(), register({ projectId: `project-${'a'.repeat(24)}`, projectSlug: 'my-project' }), firstId, now);
  expect(() => planBrainRegistryChange({ ...empty(), revision: 1, brains: linked.brains }, register({ expectedRevision: 1, collection: 'github', projectId: `project-${'b'.repeat(24)}`, projectSlug: 'my-project', purpose: 'catalog' }), nextId, now)).toThrow(/project slug conflicts/);
});

const loadServer = () => {
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  const runtimeRequire = createRequire(resolve('package.json'));
  const load = (filename: string): Record<string, unknown> => {
    const file = filename.endsWith('.ts') ? filename : `${filename}.ts`;
    if (cache.has(file)) return cache.get(file)!.exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const localRequire = (name: string) => name === 'server-only' ? {} : name.startsWith('.') ? load(resolve(dirname(file), name)) : runtimeRequire(name);
    new Function('require', 'module', 'exports', code)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  };
  return load(resolve('src/lib/brain-registry.ts')) as typeof import('../src/lib/brain-registry');
};

test('brain registry server rechecks native destinations and performs one revision-guarded statement per accepted save', async () => {
  const api = loadServer();
  const savedFetch = globalThis.fetch, savedKey = process.env.HYDRA_DB_API_KEY;
  process.env.HYDRA_DB_API_KEY = 'fixture-not-a-live-key';
  let state = empty(), corrupt = false;
  const writes: Record<string, unknown>[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); const body = init?.body ? JSON.parse(String(init.body)) : {};
    const envelope = (data: unknown) => Response.json({ success: true, data, meta: { request_id: 'fixture-registry-request' } });
    if (url.pathname === '/databases') return envelope({ databases: ['default-tenant', 'rrflow_specialist', 'personal'], failed_databases: [] });
    if (url.pathname === '/databases/collections') return envelope({ collections: ['gmail', 'github'] });
    if (body.query?.includes('DatabaseWorkspace')) return envelope([]);
    if (body.query?.includes('HAS_CONTEXT')) return envelope([]);
    expect(url.pathname).toBe('/byog/query'); expect(body.database).toBe('rrflow_registry');
    if (body.collection === 'work') return envelope([]);
    expect(body.collection).toBe('personal');
    if (body.query.startsWith('MATCH')) {
      if (corrupt) return envelope([{ anchorId: 1, registryRevision: state.revision, id: null }, { anchorId: 2, registryRevision: state.revision, id: null }]);
      return envelope(state.brains.length ? state.brains.map(brain => ({ anchorId: 1, registryRevision: state.revision, ...brain })) : state.revision ? [{ anchorId: 1, registryRevision: state.revision, id: null }] : []);
    }
    writes.push(body);
    expect(body.query).toContain('WITH r WHERE r.revision = $expected');
    expect(body.query).toContain('CREATE (e:BrainRegistryRevision');
    expect(body.query).toContain('SET r.revision = $next');
    if (state.revision !== body.params.expected) return envelope([]);
    const fields = Object.fromEntries(Object.keys(brainRegistrationSchema.shape).map(key => [key, body.params[key]]));
    const brain = brainRegistrationSchema.parse(fields);
    state = { ...state, revision: body.params.next, brains: [...state.brains.filter(item => item.id !== brain.id), brain] };
    return envelope([{ registryRevision: state.revision, ...brain }]);
  };
  try {
    for (const action of [register({ database: 'personal' }), register({ database: 'rrflow_specialist' }), register({ collection: 'missing' }), register({ projectId: `project-${'a'.repeat(24)}`, projectSlug: 'missing-project' })]) await expect(api.changeBrainRegistry(action, [])).rejects.toThrow();
    expect(writes).toHaveLength(0);
    const results = await Promise.allSettled([api.changeBrainRegistry(register(), []), api.changeBrainRegistry(register({ purpose: 'catalog', collection: 'github' }), [])]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(state.brains).toHaveLength(1); expect(state.revision).toBe(1);
    const first = state.brains[0];
    expect((await api.readBrainRegistry('shippin', [])).brains).toEqual([]);
    const renamed = await api.changeBrainRegistry({ action: 'rename', workspace: 'personal', expectedRevision: 1, brainId: first.id, projectSlug: 'shared', purpose: 'intake', displayName: 'Renamed' }, []);
    expect(renamed.brain).toMatchObject({ id: first.id, database: first.database, collection: first.collection, aliases: [first.canonicalName], revision: 2 });
    const writeCount = writes.length;
    await expect(api.changeBrainRegistry(register(), [])).rejects.toThrow(/registry changed/);
    corrupt = true;
    await expect(api.changeBrainRegistry(register({ expectedRevision: 2 }), [])).rejects.toThrow(/anchors/);
    expect(writes).toHaveLength(writeCount);
  } finally { globalThis.fetch = savedFetch; if (savedKey === undefined) delete process.env.HYDRA_DB_API_KEY; else process.env.HYDRA_DB_API_KEY = savedKey; }
});

test('brain registry UI saves, reloads, renames, searches aliases and keeps Personal separate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let state = empty(); let stale = false;
  const actions: BrainRegistryAction[] = [];
  await page.route('**/api/workspace', route => route.fulfill({ json: { connected: true, checkedAt: now, brains: [], edges: [], runs: [] } }));
  await page.route('**/api/databases', route => route.fulfill({ json: { databases: [{ name: 'default-tenant', workspace: 'personal', ready: true, status: 'Ready' }, { name: 'rrflow_specialist', workspace: 'shippin', ready: true, status: 'Ready' }], checkedAt: now, receipts: [] } }));
  await page.route('**/api/project-context?*', route => route.fulfill({ json: { projects: [], receipts: [] } }));
  await page.route('**/api/explore/*/collections', route => route.fulfill({ json: { collections: ['gmail', 'github'] } }));
  await page.route('**/api/brain-registry*', route => {
    if (route.request().method() === 'POST') {
      const action = brainRegistryActionSchema.parse(route.request().postDataJSON()); actions.push(action);
      if (stale) return route.fulfill({ status: 409, json: { error: 'The registry changed. Refresh and review before saving.' } });
      const next = planBrainRegistryChange(state, action, firstId, now);
      state = { ...state, revision: next.nextRevision, brains: next.brains };
      return route.fulfill({ json: { ...state, brain: next.brain, message: 'Saved in HydraDB.' } });
    }
    const scope = new URL(route.request().url()).searchParams.get('workspace');
    return route.fulfill({ json: scope === 'personal' ? state : { ...empty(), workspace: 'shippin' } });
  });
  const open = async () => { await page.goto('/workspace'); await page.getByRole('button', { name: 'Connectome', exact: true }).click(); await page.getByRole('button', { name: 'Source Atlas', exact: true }).click(); };
  await open();
  const registry = page.getByRole('region', { name: 'Registered brains', exact: true });
  await registry.getByRole('button', { name: 'Register a brain', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Brain display name').fill('Personal sources');
  await dialog.getByLabel('Bind existing database').selectOption('default-tenant');
  await dialog.getByLabel('Bind source collection').selectOption('gmail');
  await dialog.getByRole('button', { name: 'Save brain registration' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(registry.getByText('personal/shared/knowledge', { exact: true })).toBeVisible();
  await open();
  await expect(registry.getByText('personal/shared/knowledge', { exact: true })).toBeVisible();
  await registry.getByRole('button', { name: 'Rename Personal sources' }).click();
  await dialog.getByLabel('Brain display name').fill('Life library');
  await dialog.getByLabel('Registered purpose').selectOption('catalog');
  await dialog.getByRole('button', { name: 'Save brain name' }).click();
  await expect(registry.getByText('personal/shared/catalog', { exact: true })).toBeVisible();
  await registry.getByLabel('Find a registered name or alias').fill('personal/shared/knowledge');
  await expect(registry.getByRole('button', { name: 'Rename Life library' })).toBeVisible();
  await registry.getByText('Identity & previous names').click();
  await expect(registry).toContainText(firstId);
  expect(actions[1]).not.toHaveProperty('database');
  stale = true;
  await registry.getByRole('button', { name: 'Rename Life library' }).click();
  await dialog.getByLabel('Brain display name').fill('Unsaved draft');
  await dialog.getByRole('button', { name: 'Save brain name' }).click();
  await expect(dialog.getByRole('alert')).toContainText('registry changed');
  await expect(dialog.getByLabel('Brain display name')).toHaveValue('Unsaved draft');
  await page.keyboard.press('Escape');
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: `Switch to ${theme} mode` }); if (await toggle.count()) await toggle.click();
    expect((await new AxeBuilder({ page }).include('section[aria-label="Registered brains"]').analyze()).violations).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: /Shippin work Products/ }).click();
  await expect(registry.getByText('No logical brains are registered yet.', { exact: false })).toBeVisible();
  await expect(registry).not.toContainText('Life library');
});

test('brain registry API rejects invalid identity edits and cross-site access before native writes', async ({ request }) => {
  const url = '/api/brain-registry';
  expect((await request.post(url, { data: { ...register(), brainId: firstId } })).status()).toBe(400);
  expect((await request.post(url, { data: register(), headers: { origin: 'https://foreign.example' } })).status()).toBe(403);
  expect((await request.get(`${url}?workspace=personal&workspace=shippin`)).status()).toBe(400);
  expect((await request.get(`${url}?workspace=practice`)).status()).toBe(400);
  expect((await request.post(url, { data: 'invalid-json', headers: { 'Content-Type': 'application/json' } })).status()).toBe(400);
});
