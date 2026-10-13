import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const snapshot = { version: 1, updatedAt: '2026-10-13T01:00:00Z', sources: [
  { id: 'life', title: 'Illustrative: learning a new skill', scope: 'personal', kind: 'illustrative', summary: 'A fictional learning goal used to show personal context.', reason: 'The example is explicitly personal.', sourceUrl: null },
  { id: 'work', title: 'Public: project documentation', scope: 'shippin', kind: 'public-repository', summary: 'Already public project knowledge.', reason: 'This document belongs to the Shippin project.', sourceUrl: 'https://github.com/EonsofStupid/rrflow-hydradb' },
  { id: 'ambiguous', title: 'Illustrative: an ambiguous note', scope: 'review', kind: 'illustrative', summary: 'A fictional note that needs a person to decide.', reason: 'The available labels do not establish a destination.', sourceUrl: null },
], learning: { failureRunUrl: 'https://github.com/EonsofStupid/rrflow-hydradb/actions/runs/38321136137', passingRunUrl: 'https://github.com/EonsofStupid/rrflow-hydradb/actions/runs/38322254472', ruleUrl: 'https://github.com/EonsofStupid/rrflow-hydradb', cause: 'Two alerts made the broad locator ambiguous.', correction: 'The reviewed correction scopes the intended alert.', practice: 'Check the intended error message in the credentialless environment.' } };

test('public demo opens without authentication, labels curated data and keeps preview corrections local', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const privateReads: string[] = []; const writes: string[] = [];
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/') && !['/api/session', '/api/demo'].includes(url.pathname)) privateReads.push(url.pathname); if (request.method() !== 'GET') writes.push(url.pathname); });
  await page.route('**/api/session', route => route.fulfill({ json: { authenticated: false, local: false, configured: true, expiresAt: null, demo: { open: true, expiresAt: new Date(Date.now() + 86400000).toISOString() } } }));
  await page.route('**/api/demo', route => route.fulfill({ json: { snapshot, checkedAt: '2026-10-13T01:01:00Z', requestId: 'fixture-public-only', storage: 'HydraDB' } }));
  await page.goto('/'); await page.getByRole('link', { name: 'Explore the demo' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText('You are exploring curated data.')).toBeVisible();
  await page.getByRole('button', { name: '03 Learn from development' }).click();
  await expect(page.getByRole('button', { name: '03 Learn from development' })).toHaveAttribute('aria-current', 'step');
  await page.getByRole('region', { name: 'Needs your judgment', exact: true }).getByRole('button').filter({ hasText: 'Illustrative: an ambiguous note' }).click();
  await expect(page.getByRole('dialog').getByText('The available labels do not establish a destination.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Personal life', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Preview moved to Personal life');
  await expect(page.getByRole('region', { name: 'Personal life', exact: true }).getByRole('button').filter({ hasText: 'Illustrative: an ambiguous note' })).toBeVisible();
  expect(privateReads).toEqual([]); expect(writes).toEqual([]);
  for (const theme of ['light', 'dark']) { await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme); expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]); }
  await page.setViewportSize({ width: 390, height: 844 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('published event ends one-click access while retaining the password entrance', async ({ page }) => {
  const demoReads: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/demo') demoReads.push(request.url()); });
  await page.route('**/api/session', route => route.fulfill({ json: { authenticated: false, local: false, configured: true, expiresAt: null, demo: { open: false, expiresAt: '2020-01-01T00:00:00Z' } } }));
  await page.goto('/');
  await expect(page.getByText('The public event is closed. Sign in to explore.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore the demo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in to explore' }).click();
  await expect(page.getByRole('dialog').getByLabel('Workspace password')).toBeVisible();
  expect(demoReads).toEqual([]);
});

test('private entry keeps rejected passwords out of URLs and shows the sign-in failure', async ({ page }) => {
  await page.route('**/api/session', route => route.request().method() === 'GET' ? route.fulfill({ json: { authenticated: false, local: false, configured: true, expiresAt: null, demo: { open: true, expiresAt: new Date(Date.now() + 86400000).toISOString() } } }) : route.fulfill({ status: 401, json: { error: 'The password was not accepted.' } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Unlock my workspace' }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('Workspace password').fill('fixture-incorrect-password'); await dialog.getByRole('button', { name: 'Unlock workspace', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('The password was not accepted.'); expect(page.url()).not.toContain('password'); await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('fixture-incorrect-password');
});
