import { test, expect } from '@playwright/test';

test('connectome discovers named Gmail and GitHub collections and clears old source cards', async ({ page }) => {
  await page.route('**/api/explore/default-tenant/collections', route => route.fulfill({ json: { collections: ['gmail', 'github'], requestId: 'fixture-collections' } }));
  await page.route('**/api/explore/default-tenant/items?**', route => {
    const params = new URL(route.request().url()).searchParams;
    const collection = params.get('collection');
    return route.fulfill({ json: { items: params.get('kind') === 'memory' ? [] : [{ id: collection, kind: 'knowledge', collection, title: `Fixture ${collection} source`, type: collection, timestamp: null, description: null, metadata: {}, additionalMetadata: {} }], total: 1, requestId: 'fixture-read' } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Connectome', exact: true }).click();
  const map = page.getByRole('region', { name: 'Living connectome' });
  await expect(map.getByRole('button').filter({ hasText: 'Fixture gmail source' })).toBeVisible();
  await map.getByLabel('Source collection', { exact: true }).selectOption('github');
  await expect(map.getByRole('button').filter({ hasText: 'Fixture github source' })).toBeVisible();
  await expect(map.getByRole('button').filter({ hasText: 'Fixture gmail source' })).toHaveCount(0);
});
import AxeBuilder from '@axe-core/playwright';

test('connectome opens native TypeScript avenues and typed memories with visible evidence', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByText('HydraDB connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Connectome', exact: true }).click();
  const map = page.getByRole('region', { name: 'Living connectome' });
  await map.getByRole('button', { name: 'Shippin context', exact: true }).click();
  await expect(map.getByRole('button', { name: 'Refresh context', exact: true })).toBeEnabled();
  await expect(map.getByRole('link', { name: /Digo app-starter/ })).toHaveAttribute('href', 'https://github.com/digohq/app-starter');
  await expect(map.getByRole('link', { name: /HydraDB graph/ })).toHaveAttribute('href', 'https://dashboard.hydradb.com/graph');
  await map.getByRole('button', { name: 'Open TypeScript avenues', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('TypeScript');
  await expect(page.getByRole('link', { name: 'Open original research' })).toBeVisible();
  await expect(page.getByRole('dialog').locator('.avenue-list details')).not.toHaveCount(0);
  await page.keyboard.press('Escape');
  const memories = await (await request.get('/api/explore/seniordev/items?kind=memory&pageSize=100')).json();
  const lesson = memories.items.find((item: { metadata: { kind?: string } }) => item.metadata.kind === 'quirk');
  expect(lesson).toBeTruthy();
  await map.getByRole('button', { name: /^Tool lesson\s*\d+/ }).click();
  const memoryButton = map.getByRole('button').filter({ hasText: lesson.title });
  await memoryButton.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: lesson.title, exact: true })).toBeVisible();
  await expect(dialog).toContainText(lesson.additionalMetadata.evidence);
  // Native relationship reads have a 20-second deadline; observe their final UI state.
  await expect(dialog.getByRole('heading', { name: 'How it connects' })).toBeVisible({ timeout: 30_000 });
  await dialog.getByText('Source and retrieval evidence', { exact: true }).click();
  await expect(dialog).toContainText(lesson.id);
  await page.keyboard.press('Escape');
  await expect(memoryButton).toBeFocused();
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: `Switch to ${theme} mode` });
    if (await toggle.count()) await toggle.click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/connectome-${theme}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/connectome-mobile.png', fullPage: true, animations: 'disabled' });
});

test('context refresh shows newly returned memories and reports failed source reads', async ({ page }) => {
  let revision = 0;
  await page.route('**/api/explore/seniordev/items?*', route => route.fulfill({ json: { items: [{ id: 'fixture-memory', kind: 'memory', title: revision ? 'Corrected memory' : 'First memory', timestamp: '2026-10-12T20:00:00Z', metadata: {}, additionalMetadata: {} }] } }));
  await page.route('**/api/explore/rrflow_specialist/items?*', route => revision ? route.fulfill({ status: 503, json: { error: 'Source service unavailable' } }) : route.fulfill({ json: { items: [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Connectome', exact: true }).click();
  const map = page.getByRole('region', { name: 'Living connectome' });
  await map.getByRole('button', { name: 'Shippin context', exact: true }).click();
  await expect(map.getByRole('button').filter({ hasText: 'First memory' })).toBeVisible();
  revision++;
  await map.getByRole('button', { name: 'Refresh context', exact: true }).click();
  await expect(map.getByRole('button').filter({ hasText: 'Corrected memory' })).toBeVisible();
  await expect(map.getByRole('alert').filter({ hasText: 'Source service unavailable' })).toBeVisible();
  await expect(map.getByRole('button').filter({ hasText: 'First memory' })).toHaveCount(0);
});

test('Personal uses default-tenant and keeps its records separate when switching databases', async ({ page }) => {
  await page.route('**/api/databases', route => route.fulfill({ json: { databases: [
    { name: 'default-tenant', workspace: 'personal', ready: true, status: 'ready' },
    { name: 'personal-growth', workspace: 'personal', ready: true, status: 'ready' },
    { name: 'rrflow_specialist', workspace: 'shippin', ready: true, status: 'ready' },
  ], checkedAt: '2026-10-12T22:00:00Z', receipts: [] } }));
  await page.route('**/api/explore/*/items?*', route => {
    const url = new URL(route.request().url());
    const database = url.pathname.split('/')[3];
    return route.fulfill({ json: { items: url.searchParams.get('kind') === 'memory' ? [] : [{ id: database, kind: 'knowledge', title: `${database} source`, timestamp: '2026-10-12T22:00:00Z', metadata: {}, additionalMetadata: {} }] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Connectome', exact: true }).click();
  const map = page.getByRole('region', { name: 'Living connectome' });
  await expect(map.getByLabel('Knowledge database')).toHaveValue('default-tenant');
  await expect(map.getByRole('button').filter({ hasText: 'default-tenant source' })).toBeVisible();
  await map.getByRole('button', { name: 'Personal context', exact: true }).click();
  await expect(map.getByRole('button').filter({ hasText: 'default-tenant source' })).toBeVisible();
  await map.getByLabel('Knowledge database').selectOption('personal-growth');
  await expect(map.getByRole('button').filter({ hasText: 'personal-growth source' })).toBeVisible();
  await expect(map.getByRole('button').filter({ hasText: 'default-tenant source' })).toHaveCount(0);
  await map.getByRole('button', { name: 'Shippin context', exact: true }).click();
  await expect(map.getByLabel('Knowledge database')).toHaveValue('rrflow_specialist');
  await expect(map.getByRole('button').filter({ hasText: 'rrflow_specialist source' })).toBeVisible();
  await expect(map.getByRole('button').filter({ hasText: 'personal-growth source' })).toHaveCount(0);
  await expect(map.getByLabel('Knowledge database').getByRole('option', { name: 'personal-growth' })).toHaveCount(0);
});
