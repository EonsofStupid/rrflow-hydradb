import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe.configure({ mode: 'serial' });

test('research imports from the UI, stays traceable, and reimports without duplicate brains', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByText('HydraDB connected', { exact: true })).toBeVisible();
  const before = await (await request.get('/api/workspace')).json();
  if (!before.brains.length) await page.getByRole('button', { name: 'Import research into HydraDB' }).click();
  else {
    await page.getByRole('button', { name: 'Connections', exact: true }).click();
    await page.getByRole('button', { name: 'Reimport research' }).click();
  }
  await expect(page.getByRole('status')).toContainText('Your research is connected', { timeout: 110_000 });
  const after = await (await request.get('/api/workspace')).json();
  expect(after.brains).toHaveLength(6);
  expect(new Set(after.brains.map((brain: { id: string }) => brain.id)).size).toBe(6);
  expect(after.edges).toHaveLength(7);
  if (before.brains.length) expect(after.brains).toEqual(before.brains);
  await page.getByRole('button', { name: 'Engineering disciplines', exact: false }).click();
  await page.getByRole('button', { name: 'Explore Rust', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Ownership, Borrowing, Lifetimes');
  await expect(page.getByRole('link', { name: 'Open original research' })).toHaveAttribute('href', /docs.google.com/);
  await page.getByText('Ownership, Borrowing, Lifetimes', { exact: false }).click();
  await expect(page.getByRole('dialog')).toContainText('Is the owner of every value clear');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a brain' }).fill('TypeScript');
  await expect(page.getByRole('button', { name: 'Explore TypeScript', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore Rust', exact: true })).toHaveCount(0);
});

test('a UI-created plan reloads from HydraDB and keeps unverified steps pending', async ({ page, request }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a review', exact: true }).click();
  const goal = `Playwright verification: review the Shippin dashboard ${Date.now()}`;
  await page.getByLabel('The work to review').fill(goal);
  await page.getByLabel('Which specialist should lead?').selectOption('nextjs');
  await page.getByRole('button', { name: 'Create review plan' }).click();
  await expect(page.getByRole('dialog')).toContainText('Your review plan');
  await expect(page.getByRole('dialog')).toContainText('No code execution, AI assessment, or automated improvement has run.');
  const workspace = await (await request.get('/api/workspace')).json();
  const saved = workspace.runs.find((run: { goal: string }) => run.goal === goal);
  expect(saved.brainIds).toEqual(['core', 'nextjs', 'typescript']);
  expect(saved.status).toBe('needs_evidence');
  expect(saved.questionCount).toBeGreaterThan(100);
  const replay = await request.post('/api/reviews', { data: { id: saved.id, goal, stack: 'nextjs' } });
  expect(replay.ok()).toBeTruthy();
  expect(await replay.json()).toEqual(saved);
  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(goal) })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(goal) }).click();
  await page.getByRole('button', { name: 'Delete plan', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(goal) })).toHaveCount(0);
});

test('theme persists, mobile layout fits, and core views are accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('HydraDB connected', { exact: true })).toBeVisible();
  if (await page.getByRole('button', { name: 'Switch to light mode' }).count()) await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/light/);
  await expect(page.getByRole('button', { name: 'Explore Rust', exact: true })).toBeVisible();
  await expect(page.getByText('Loading from HydraDB…', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/workspace-light.png', fullPage: true, animations: 'disabled' });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.screenshot({ path: 'test-results/workspace-dark.png', fullPage: true, animations: 'disabled' });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your infrastructure' })).toBeVisible();
  await expect(page.locator('.sidebar')).not.toHaveClass(/is-open/);
  await expect.poll(() => page.locator('.sidebar').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/workspace-mobile.png', fullPage: true, animations: 'disabled' });
});

test('invalid inputs and cross-site writes fail without changing the graph', async ({ request }) => {
  const bad = await request.post('/api/reviews', { data: { id: 'bad', goal: 'x', stack: 'untrusted' } });
  expect(bad.status()).toBe(400);
  const crossSite = await request.post('/api/research/import', { headers: { Origin: 'https://untrusted.example' } });
  expect(crossSite.status()).toBe(403);
  expect((await request.get('/api/brains/not-a-brain')).status()).toBe(404);
});

test('unavailable HydraDB is visible and cannot be mistaken for an empty successful workspace', async ({ page }) => {
  await page.route('**/api/workspace', route => route.fulfill({ json: { brains: [], runs: [], edges: [], connected: false, checkedAt: new Date().toISOString(), error: 'HydraDB is temporarily unavailable.' } }));
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: 'temporarily unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start a review', exact: true })).toBeDisabled();
  await expect(page.getByText('HydraDB connected', { exact: true })).toHaveCount(0);
});

test('the live specialist view retrieves actual evidence with a native request ID', async ({ page, request }, testInfo) => {
  const snapshot = await (await request.get('/api/mesh')).json();
  expect(snapshot.connected).toBe(true);
  expect(snapshot.brains).toHaveLength(5);
  await page.goto('/');
  await page.getByRole('button', { name: 'Specialist brains', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ask a brain', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Senior dev practices', exact: true }).focus();
  await page.getByRole('radio', { name: 'Senior dev practices', exact: true }).press('Space');
  await page.getByLabel('Your question', { exact: true }).fill('Why does infisical secrets get fail in Git Bash?');
  const received = page.waitForResponse(response => response.url().endsWith('/api/mesh/recall') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const response = await received;
  expect(response.ok()).toBeTruthy();
  const result = await response.json();
  expect(result.requestId).toBeTruthy();
  expect(result.hits.length).toBeGreaterThan(0);
  expect(result.eventId).toBeTruthy();
  expect(result.mode).toBe('fast');
  expect(result.telemetry.status).toBe('accepted');
  expect(JSON.stringify(result.hits)).toMatch(/Git Bash|MSYS|pathconv/i);
  await expect(page.getByText(/Request ID:/).last()).toBeVisible();
  const feedbackSent = page.waitForResponse(response => response.url().endsWith('/api/mesh/feedback') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  const feedbackResponse = await feedbackSent;
  expect(feedbackResponse.ok()).toBeTruthy();
  expect((await feedbackResponse.json()).isRecorded).toBe(true);
  await testInfo.attach('native-recall-evidence', { body: JSON.stringify({ eventId: result.eventId, requestId: result.requestId, brain: result.brain, mode: result.mode, hitCount: result.hits.length }), contentType: 'application/json' });
  await page.evaluate(() => scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/specialist-brains.png', fullPage: true, animations: 'disabled' });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')].map(element => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })).filter(element => element.right > innerWidth + 1).slice(0, 18));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(overflow)).toBeTruthy();
  await expect.poll(() => page.locator('.sidebar').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/specialist-mobile.png', fullPage: true, animations: 'disabled' });
});

test('partial specialist data and empty retrieval remain distinct from healthy empty data', async ({ page, request }) => {
  const snapshot = await (await request.get('/api/mesh')).json();
  snapshot.brains[0].memories = null;
  snapshot.brains[0].knowledge = null;
  snapshot.brains[0].statsError = 'Statistics are temporarily unavailable.';
  snapshot.learning = [];
  snapshot.learningError = 'Lessons could not be loaded.';
  await page.route('**/api/mesh', route => route.fulfill({ json: snapshot }));
  await page.route('**/api/mesh/recall', route => route.fulfill({ json: {
    eventId: '00000000-0000-4000-8000-000000000001', brain: 'rrflow_specialist', question: 'Fixture question',
    mode: 'fast', hits: [], requestId: 'fixture-empty-retrieval', latencyMs: 12, telemetry: { status: 'not_configured' }, receipts: [],
  } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Specialist brains', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('alert').filter({ hasText: 'Lessons could not be loaded' })).toBeVisible();
  await expect(page.getByText('No lessons recorded yet.', { exact: false })).toHaveCount(0);
  const figures = page.getByRole('region', { name: 'Live figures' });
  await expect(figures.getByText('Memories', { exact: true }).locator('..').locator('..')).toContainText('—');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByText('No matching evidence was returned. Try another question or source.')).toBeVisible();
  await expect(page.getByText(/Request ID: fixture-empty-retrieval/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yes', exact: true })).toHaveCount(0);
});
