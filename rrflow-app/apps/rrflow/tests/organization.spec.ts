import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { suggestOrganization, type OrganizationItem, type OrganizationSnapshot } from '../src/lib/organization-contracts';

const makeItem = (key: string, destination: OrganizationItem['destination'], title: string): OrganizationItem => ({
  key: key.repeat(64), sourceVersion: 'e'.repeat(64), source: { id: key, title, kind: 'knowledge', collection: 'gmail', type: 'email', timestamp: '2026-10-12T20:00:00Z', description: null, metadata: {}, additionalMetadata: {} },
  provider: 'Gmail', suggested: destination, destination, reason: 'Fixture: explicit routing evidence for this source.', matchedProject: null, decision: null, changedSinceReview: false,
});
const makeSnapshot = (): OrganizationSnapshot => ({ database: 'default-tenant', items: [makeItem('a', 'personal', 'Fixture: personal growth plan'), makeItem('b', 'shippin', 'Fixture: shippin.cloud launch'), makeItem('c', 'review', 'Fixture: an ambiguous repository')], checkedAt: '2026-10-12T21:00:00Z', errors: [], requestIds: ['fixture-native-read'], decisionsAvailable: true, sampleLimit: 40 });

test('context organization explains, corrects and persists a placement with accessible private titles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const snapshot = makeSnapshot(); const writes: Record<string, unknown>[] = [];
  await page.route('**/api/organization**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: snapshot });
    const input = route.request().postDataJSON(); writes.push(input);
    const item = snapshot.items.find(item => item.key === input.key)!;
    item.destination = input.destination;
    item.decision = { key: item.key, destination: input.destination, sourceVersion: item.sourceVersion, note: input.note, updatedAt: new Date().toISOString() };
    return route.fulfill({ json: { decision: item.decision, telemetry: { status: 'accepted' } } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Context inbox', exact: true }).click();
  const inbox = page.getByRole('region', { name: 'Context organization' });
  await expect(inbox.getByText('3 items in this sample · 0 reviewed by you')).toBeVisible();
  await expect(inbox.getByText('Fixture: personal growth plan', { exact: true })).toHaveCount(0);
  await inbox.getByRole('button', { name: 'Show source titles' }).click();
  await inbox.getByRole('button').filter({ hasText: 'Fixture: an ambiguous repository' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Personal', exact: true }).check();
  await dialog.getByRole('textbox').fill('My learning project, separate from Shippin.');
  await dialog.getByRole('button', { name: 'Save placement', exact: true }).click();
  await expect(inbox.getByRole('status')).toContainText('Confirmed as Personal. Saved in HydraDB. Raindrop accepted');
  expect(writes).toEqual([expect.objectContaining({ database: 'default-tenant', key: 'c'.repeat(64), destination: 'personal', expectedUpdatedAt: null, note: 'My learning project, separate from Shippin.' })]);
  await page.reload(); await page.getByRole('button', { name: 'Context inbox', exact: true }).click();
  await expect(inbox.getByText('3 items in this sample · 1 reviewed by you')).toBeVisible();
  await expect(inbox.getByText('Your decision', { exact: true })).toBeVisible();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.classList.toggle('dark', value === 'dark'); }, theme);
    expect((await new AxeBuilder({ page }).include('section[aria-label="Context organization"]').analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/context-inbox-${theme}.png`, animations: 'disabled' });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/context-inbox-mobile.png', animations: 'disabled' });
});

test('context organization keeps failed saves open and discards late results from another workspace', async ({ page }) => {
  let fail = false;
  await page.route('**/api/organization**', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 409, json: { error: 'Another review changed this placement.' } });
    const database = new URL(route.request().url()).searchParams.get('database');
    const snapshot = makeSnapshot();
    if (database === 'shippin_cloud') { snapshot.database = 'shippin_cloud'; snapshot.items = [makeItem('d', 'shippin', 'Fixture: cloud only')]; }
    if (fail && database === 'default-tenant') await new Promise(resolve => setTimeout(resolve, 700));
    await route.fulfill({ json: snapshot });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Context inbox', exact: true }).click();
  const inbox = page.getByRole('region', { name: 'Context organization' });
  await inbox.getByRole('button', { name: 'Show source titles' }).click();
  await inbox.getByRole('button').filter({ hasText: 'Fixture: personal growth plan' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save placement' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Another review changed this placement.');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  fail = true;
  await inbox.getByRole('button', { name: 'Refresh context inbox' }).click();
  await inbox.getByLabel('Source workspace').selectOption('shippin_cloud');
  await expect(inbox.getByText('1 items in this sample · 0 reviewed by you')).toBeVisible();
  await inbox.getByRole('button', { name: 'Show source titles' }).click();
  await expect(inbox.getByText('Fixture: cloud only', { exact: true })).toBeVisible();
  await expect(inbox.getByText('Fixture: personal growth plan', { exact: true })).toHaveCount(0);
});

test('context organization conservatively routes signals and rejects invalid writes before provider calls', async ({ request }) => {
  const source = makeItem('a', 'review', 'A note about something').source;
  expect(suggestOrganization(source, 'default-tenant').destination).toBe('review');
  expect(suggestOrganization({ ...source, title: 'A shippin.cloud launch' }, 'default-tenant').destination).toBe('shippin');
  expect(suggestOrganization({ ...source, title: 'notshippin.cloud.evil.com' }, 'default-tenant').destination).toBe('review');
  expect(suggestOrganization({ ...source, title: 'shippin.ai and shipping.buzz' }, 'default-tenant').destination).toBe('review');
  expect(suggestOrganization({ ...source, metadata: { workspace: 'personal' }, additionalMetadata: { workspace: 'work' } }, 'default-tenant').destination).toBe('review');
  expect(suggestOrganization({ ...source, metadata: { workspace: 'personal' } }, 'shippin_cloud').destination).toBe('personal');
  for (const body of [{ database: 'private_other' }, { database: 'default-tenant', key: 'a'.repeat(64), sourceVersion: 'e'.repeat(64), destination: 'everyone', expectedUpdatedAt: null }]) expect((await request.post('/api/organization', { data: body })).status()).toBe(400);
  expect((await request.post('/api/organization', { headers: { origin: 'https://unrelated.example' }, data: {} })).ok()).toBeFalsy();
});
