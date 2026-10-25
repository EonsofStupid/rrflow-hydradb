import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { brainNamePlanSchema, plannedBrainName } from '../src/lib/source-atlas-contracts';

const now = '2026-10-24T21:00:00.000Z';
const databases = [
  { name: 'default-tenant', workspace: 'personal', ready: true, status: 'Ready' },
  { name: 'rrflow_specialist', workspace: 'shippin', ready: true, status: 'Ready' },
  { name: 'seniordev', workspace: 'practice', ready: null, status: 'Unknown' },
  { name: 'unassigned-native', workspace: null, ready: true, status: 'Ready' },
];
const connector = { id: 'fixture-gmail', name: 'Personal Gmail', provider: 'gmail', database: 'default-tenant', workspace: 'personal', collection: 'gmail', lifecycle: 'active', syncStatus: 'idle', lastAttempt: now, lastSuccess: now, resources: 2, needsAttention: false };
const item = (collection: string, kind = 'knowledge') => ({ id: `${collection}-${kind}`, title: `Fixture ${collection} ${kind}`, kind, collection, timestamp: now, description: 'Original source description.', metadata: {}, additionalMetadata: {} });
const project = (workspace: string) => ({ id: `project-${'a'.repeat(24)}`, workspace, kind: 'github', name: `${workspace} project`, location: `${workspace}/project`, revision: 'fixture-revision', loadedAt: now, stack: ['typescript'] });
const sync = { version: 1, repository: 'EonsofStupid/rrflow-hydradb', database: 'rrflow_specialist', commit: 'a'.repeat(40), sourceAt: now, startedAt: now, updatedAt: now, finishedAt: now, phase: 'searchable', total: 10, changed: 2, accepted: 2, searchable: 10, completed: 8, failed: 0, removed: 0, deleted: 0, error: null, lastSuccessfulAt: now, lastSuccessfulCommit: 'a'.repeat(40), runUrl: 'https://github.com/EonsofStupid/rrflow-hydradb/actions/runs/1234', raindrop: { status: 'accepted', eventId: 'fixture-sync' }, requestIds: ['fixture-native-sync'] };

const setup = async (page: Page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/workspace', route => route.fulfill({ json: { connected: true, checkedAt: now, brains: [], edges: [], runs: [] } }));
  await page.route('**/api/brain-registry?*', route => route.fulfill({ json: { workspace: new URL(route.request().url()).searchParams.get('workspace'), revision: 0, brains: [], checkedAt: now, receipts: [] } }));
  await page.route('**/api/databases', route => route.fulfill({ json: { databases, checkedAt: now, receipts: [] } }));
  await page.route('**/api/connections', route => route.fulfill({ json: { overview: { connectors: [connector], unassigned: [], connectorListAvailable: true, warnings: [], checkedAt: now }, receipts: [] } }));
  await page.route('**/api/repository-sync', route => route.fulfill({ json: { state: sync, checkedAt: now, receipts: [] } }));
  await page.route('**/api/project-context?*', route => route.fulfill({ json: { projects: [project(new URL(route.request().url()).searchParams.get('workspace')!)], receipts: [] } }));
  await page.route('**/api/explore/*/collections', route => route.fulfill({ json: { collections: ['gmail', 'github'], requestId: 'fixture-collections' } }));
  await page.route('**/api/explore/*/items?*', route => {
    const url = new URL(route.request().url()); const query = url.searchParams;
    return route.fulfill({ json: { database: url.pathname.split('/')[3], collection: query.get('collection') || null, kind: query.get('kind'), items: [item(query.get('collection') || '', query.get('kind') || 'knowledge')], total: 20, requestId: 'fixture-list' } });
  });
  await page.route('**/api/explore/*/items/*?*', route => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: { id: url.pathname.split('/').at(-1), database: url.pathname.split('/')[3], collection: url.searchParams.get('collection') || null, kind: url.searchParams.get('kind'), content: 'Real fixture source body, not inferred text.', inferredContent: null, requestIds: ['fixture-inspect'], failures: [] } });
  });
};
const openAtlas = async (page: Page) => {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Connectome', exact: true }).click();
  await page.getByRole('button', { name: 'Source Atlas', exact: true }).click();
  return page.getByRole('region', { name: 'Source Atlas', exact: true });
};

test('Source Atlas naming contract rejects ambiguous addresses without normalizing identities', () => {
  expect(plannedBrainName({ workspace: 'work', project: 'shippin-cloud', purpose: 'knowledge' })).toBe('work/shippin-cloud/knowledge');
  expect(plannedBrainName({ workspace: 'personal', project: 'shared', purpose: 'catalog' })).toBe('personal/shared/catalog');
  for (const slug of ['', 'Shippin', 'shippin_cloud', ' shippin', '../personal', 'work/personal', 'a--b', '-a', 'a-', 'a'.repeat(49)]) {
    expect(brainNamePlanSchema.safeParse({ workspace: 'work', project: slug, purpose: 'knowledge' }).success).toBe(false);
  }
  expect(brainNamePlanSchema.safeParse({ workspace: 'practice', project: 'shared', purpose: 'knowledge' }).success).toBe(false);
  expect(brainNamePlanSchema.safeParse({ workspace: 'work', project: 'shared', purpose: 'vision' }).success).toBe(false);
  expect(() => plannedBrainName({ workspace: 'work', project: 'shared', purpose: 'knowledge', database: 'default-tenant' })).toThrow();
});

test('Source Atlas explains scope, real records, project gaps and sync evidence in both themes', async ({ page }) => {
  await setup(page);
  const mutations: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/') && request.method() !== 'GET') mutations.push(request.url()); });
  const atlas = await openAtlas(page);
  await expect(atlas.getByRole('button', { name: 'Refresh Atlas', exact: true })).toBeEnabled();
  await expect(atlas.getByRole('button', { name: 'Inspect Personal knowledge' })).toBeVisible();
  await expect(atlas.getByRole('button', { name: 'Inspect Company brain' })).toHaveCount(0);
  await expect(atlas.getByText('unassigned-native', { exact: true })).toBeVisible();
  await atlas.locator('summary').filter({ hasText: 'personal project' }).click();
  await expect(atlas).toContainText('Not recorded by the current project registry');
  await atlas.getByRole('button', { name: 'Inspect Personal knowledge' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Last successful sync');
  await dialog.getByLabel('Atlas source collection').selectOption('gmail');
  await dialog.getByRole('button', { name: /Fixture gmail knowledge/ }).click();
  await expect(dialog.getByRole('region', { name: 'Atlas record evidence' })).toContainText('Real fixture source body, not inferred text.');
  await expect(dialog).toContainText('fixture-inspect');
  await expect(dialog).toContainText('first page, at most 12');
  await page.keyboard.press('Escape');
  await expect(atlas.getByRole('button', { name: 'Inspect Personal knowledge' })).toBeFocused();
  await atlas.getByRole('button', { name: /Shippin work Products/ }).click();
  await expect(atlas.getByRole('button', { name: 'Inspect Company brain' })).toBeVisible();
  await expect(atlas.getByRole('button', { name: 'Inspect Personal knowledge' })).toHaveCount(0);
  await expect(atlas.locator('summary').filter({ hasText: 'personal project' })).toHaveCount(0);
  await expect(atlas.locator('summary').filter({ hasText: 'shippin project' })).toBeVisible();
  const lifecycle = atlas.getByRole('region', { name: 'Development lifecycle evidence' });
  await expect(lifecycle).toContainText('10 / 10');
  await expect(lifecycle.locator('dl > div').filter({ hasText: 'Processing completed' })).toContainText('8');
  await expect(lifecycle).toContainText('automatic rule promotion is not active');
  await atlas.getByText('Plan a readable brain name', { exact: true }).click();
  await atlas.getByLabel('Project slug').fill('shippin-cloud');
  await expect(atlas.getByRole('status')).toContainText('work/shippin-cloud/knowledge');
  await atlas.getByLabel('Project slug').fill('../personal');
  await expect(atlas.getByLabel('Project slug')).toHaveAttribute('aria-invalid', 'true');
  await expect(atlas.getByRole('status')).not.toContainText('work/../personal');
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: `Switch to ${theme} mode` });
    if (await toggle.count()) await toggle.click();
    expect((await new AxeBuilder({ page }).include('section[aria-label="Source Atlas"]').analyze()).violations).toEqual([]);
    await atlas.screenshot({ path: `test-results/source-atlas-${theme}.png`, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include('section[aria-label="Source Atlas"]').analyze()).violations).toEqual([]);
  expect(mutations).toEqual([]);
});

test('Source Atlas discards late personal responses and clears records on collection and type changes', async ({ page }) => {
  await setup(page);
  let finishProject!: () => void;
  const delayedProject = new Promise<void>(resolve => { finishProject = resolve; });
  await page.route('**/api/project-context?workspace=personal', async route => { await delayedProject; await route.fulfill({ json: { projects: [project('personal')], receipts: [] } }).catch(() => {}); });
  const atlas = await openAtlas(page);
  await atlas.getByRole('button', { name: /Shippin work Products/ }).click();
  await expect(atlas.locator('summary').filter({ hasText: 'shippin project' })).toBeVisible();
  finishProject();
  await atlas.getByRole('button', { name: 'Inspect Company brain' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Atlas source collection').selectOption('gmail');
  let finishDetail!: () => void;
  const delayedDetail = new Promise<void>(resolve => { finishDetail = resolve; });
  await page.route('**/items/gmail-knowledge?*', async route => { await delayedDetail; await route.fulfill({ json: { id: 'gmail-knowledge', database: 'rrflow_specialist', collection: 'gmail', kind: 'knowledge', content: 'Late old content must not appear', inferredContent: null, requestIds: [], failures: [] } }).catch(() => {}); });
  await dialog.getByRole('button', { name: /Fixture gmail knowledge/ }).click();
  await expect(dialog.getByText('Reading record content…')).toBeVisible();
  await dialog.getByLabel('Atlas source collection').selectOption('github');
  finishDetail();
  await expect(dialog.getByRole('button', { name: /Fixture github knowledge/ })).toBeVisible();
  await expect(dialog).not.toContainText('Late old content');
  await expect(dialog).not.toContainText('Fixture gmail knowledge');
  await dialog.getByRole('button', { name: 'Stored memories', exact: true }).click();
  await expect(dialog.getByRole('button', { name: /Fixture github memory/ })).toBeVisible();
  await expect(dialog).not.toContainText('Fixture github knowledge');
  await page.route('**/items/github-memory?*', route => route.fulfill({ json: { id: 'github-memory', database: 'default-tenant', collection: 'github', kind: 'memory', content: 'Wrong database content must stay hidden', inferredContent: null, requestIds: [], failures: [] } }));
  await dialog.getByRole('button', { name: /Fixture github memory/ }).click();
  await expect(dialog.getByRole('alert')).toContainText('does not match this selection');
  await expect(dialog).not.toContainText('Wrong database content');
  await page.keyboard.press('Escape');
  await expect(atlas).not.toContainText('personal project');
});

test('Source Atlas refresh discovers new assignments and shows unavailable inventories without stale success', async ({ page }) => {
  await setup(page);
  const atlas = await openAtlas(page);
  await expect(atlas.getByRole('button', { name: 'Refresh Atlas', exact: true })).toBeEnabled();
  await page.route('**/api/databases', route => route.fulfill({ json: { databases: [...databases, { name: 'personal-growth', workspace: 'personal', ready: true, status: 'Ready' }], checkedAt: now, receipts: [] } }));
  await page.route('**/api/connections', route => route.fulfill({ json: { overview: { connectors: [], unassigned: [], connectorListAvailable: false, warnings: [], checkedAt: now }, receipts: [] } }));
  await page.route('**/api/project-context?workspace=personal', route => route.fulfill({ status: 503, json: { error: 'Saved project inventory unavailable' } }));
  await atlas.getByRole('button', { name: 'Refresh Atlas', exact: true }).click();
  await expect(atlas.getByRole('button', { name: 'Inspect personal-growth' })).toBeVisible();
  await expect(atlas.getByRole('alert').filter({ hasText: 'Connector inventory is unavailable' })).toBeVisible();
  await expect(atlas.getByRole('alert').filter({ hasText: 'Saved project inventory unavailable' })).toBeVisible();
  await expect(atlas.locator('summary').filter({ hasText: 'personal project' })).toHaveCount(0);
  await expect(atlas).not.toContainText('No connector defaults point here');
  await page.route('**/api/databases', route => route.fulfill({ json: { databases: 'malformed' } }));
  await atlas.getByRole('button', { name: 'Refresh Atlas', exact: true }).click();
  await expect(atlas.getByRole('alert').filter({ hasText: 'Database assignments: This source returned an unexpected response' })).toBeVisible();
  await expect(atlas.getByRole('button', { name: 'Inspect personal-growth' })).toHaveCount(0);
  await expect(atlas).not.toContainText('No unassigned databases were returned');
});

test('live Atlas reads existing Personal sources without configuring or moving them', async ({ page }) => {
  const atlas = await openAtlas(page);
  await expect(atlas.getByRole('button', { name: 'Inspect Personal knowledge' })).toBeVisible({ timeout: 45_000 });
  await atlas.getByRole('button', { name: 'Inspect Personal knowledge' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Atlas source collection')).toBeVisible({ timeout: 30_000 });
  await dialog.getByLabel('Atlas source collection').selectOption('gmail');
  await expect(dialog.getByRole('button', { name: 'Stored sources', exact: true })).toBeVisible();
  await expect(dialog.getByText(/first page, at most 12/)).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole('button', { name: /Synced to HydraDB:/ }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await atlas.getByRole('button', { name: /Shippin work Products/ }).click();
  await expect(atlas.getByRole('region', { name: 'Development lifecycle evidence' })).toContainText('EonsofStupid/rrflow-hydradb');
  await page.screenshot({ path: 'test-results/source-atlas-live-work.png', fullPage: true, animations: 'disabled' });
});
