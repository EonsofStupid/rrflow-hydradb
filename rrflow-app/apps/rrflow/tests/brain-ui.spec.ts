import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { applyBrainUiMessage, BRAIN_UI_CATALOG, readBrainUiStream, type BrainUiMessage, type BrainUiModel, type BrainUiSurface } from '../src/lib/brain-ui-contracts';

const eventId = '00000000-0000-4000-8000-000000000002';
const model = (): BrainUiModel => ({
  eventId, goal: 'Fixture: accessible Next.js dashboard', stack: 'nextjs', database: 'seniordev', collection: 'rrflow', startedAt: new Date().toISOString(),
  status: { phase: 'partial', completed: 3, total: 3, message: 'Some knowledge is available. Retry to load the missing specialists.' },
  brains: [], avenues: [], failures: [{ brainId: 'nextjs', message: 'HydraDB answered 503.' }], receipts: [], observation: { status: 'failed', error: 'Raindrop delivery timed out.' },
});
const fixtureMessages = (data: BrainUiModel): BrainUiMessage[] => [
  { version: 'v0.9.1', createSurface: { surfaceId: eventId, catalogId: BRAIN_UI_CATALOG } },
  { version: 'v0.9.1', updateDataModel: { surfaceId: eventId, path: '/', value: data } },
  { version: 'v0.9.1', updateComponents: { surfaceId: eventId, components: [{ id: 'root', component: 'Column', children: ['status', 'observation'] }, { id: 'status', component: 'WorkflowStatus', path: '/status' }, { id: 'observation', component: 'Observation', path: '/observation' }] } },
];

test('Overview generates HydraDB context and records alignment feedback without leaving the dashboard', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-rrflow-verification': 'playwright' });
  await page.goto('/');
  const dashboard = page.getByRole('region', { name: 'Live context and quality' });
  await expect(dashboard.getByRole('region', { name: 'Live figures' })).toBeVisible();
  const reporting = dashboard.getByRole('region', { name: 'Quality monitoring · Raindrop' });
  await expect(reporting).toContainText('Reporting to project rrflow-hydradb');
  await dashboard.getByRole('button', { name: 'Build my workspace', exact: true }).click();
  const alignment = dashboard.getByRole('region', { name: 'Raindrop quality' });
  await expect(alignment).toContainText('Event accepted by Raindrop');
  await expect(alignment).toContainText('Engineering core + Next.js + TypeScript');
  await alignment.getByText('Inspect the context behind this feedback', { exact: true }).click();
  await expect(alignment).toContainText('6 HydraDB requests');
  await alignment.getByRole('button', { name: 'This helps', exact: true }).click();
  await expect(alignment).toContainText('Marked helpful.');
  await expect(reporting.locator('dl > div').filter({ hasText: 'Events accepted' }).locator('dd')).toHaveText('1');
  await expect(reporting.locator('dl > div').filter({ hasText: 'Verdicts accepted' }).locator('dd')).toHaveText('1');
  await expect(reporting.locator('dl > div').filter({ hasText: 'Failed deliveries' }).locator('dd')).toHaveText('0');
  await alignment.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/dashboard-context-alignment.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('brain knowledge drives A2UI tooltips, dialogs, quality feedback and responsive themes', async ({ page }, testInfo) => {
  await page.setExtraHTTPHeaders({ 'x-rrflow-verification': 'playwright' });
  // Inspect the same streaming response the UI consumes. Chromium can discard
  // streamed response bodies from its DevTools network buffer after delivery.
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    const capture = window as Window & { brainUiCapture?: Promise<string> };
    window.fetch = async (...args) => {
      const response = await fetch(...args);
      if (args[0] === '/api/brain-ui') capture.brainUiCapture = response.clone().text();
      return response;
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Brain workspace', exact: true }).click();
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/brain-ui') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Build my workspace', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Orchestration status' })).toContainText('Engineering checks pending');
  await expect(page.getByText('Event accepted by Raindrop', { exact: true })).toBeVisible();
  const response = await responsePromise;
  expect(response.headers()['content-type']).toContain('application/a2ui+json');
  const body = await page.evaluate(() => (window as Window & { brainUiCapture?: Promise<string> }).brainUiCapture);
  expect(body).toBeTruthy();
  const messages = body!.trim().split('\n').map(line => JSON.parse(line) as BrainUiMessage);
  let surface: BrainUiSurface | null = null;
  for (const message of messages) surface = applyBrainUiMessage(surface, message);
  const generated = surface!.model!;
  expect(generated.brains.map(item => item.brain.id)).toEqual(['core', 'nextjs', 'typescript']);
  expect(generated.avenues.length).toBeGreaterThan(0);
  expect(generated.receipts.filter(receipt => receipt.service === 'HydraDB')).toHaveLength(6);
  expect(generated.receipts.every(receipt => receipt.outcome === 'ok')).toBeTruthy();
  expect(generated.brains.every(item => item.requestIds.length === 2)).toBeTruthy();
  const updates = messages.filter(message => 'updateDataModel' in message).map(message => message.updateDataModel.value);
  expect(updates.some(update => update.brains.length > 0 && update.observation.status === 'waiting')).toBeTruthy();
  expect(updates.some(update => update.avenues.length > 0 && update.observation.status === 'pending')).toBeTruthy();
  await expect(page.getByTestId('first-evidence')).toBeVisible();
  const first = generated.avenues[0];
  const tooltipButton = page.getByRole('button', { name: `Why ${first.title}?`, exact: true });
  await tooltipButton.focus();
  await expect(page.getByRole('tooltip').filter({ hasText: first.selection })).toContainText(first.sourceTitle);
  await tooltipButton.press('Escape');
  await expect(page.getByRole('tooltip').filter({ hasText: first.selection })).not.toBeVisible();
  await tooltipButton.press('Enter');
  await expect(page.getByRole('dialog')).toContainText(first.questions[0].text);
  await expect(page.getByRole('dialog')).toContainText(first.revision);
  await expect(page.getByRole('dialog')).toContainText('Not checked');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(tooltipButton).toBeFocused();
  const feedbackPromise = page.waitForResponse(response => response.url().endsWith('/api/brain-ui/feedback'));
  await page.getByRole('button', { name: 'This helps', exact: true }).click();
  expect((await (await feedbackPromise).json()).status).toBe('accepted');
  await expect(page.getByText('Marked helpful.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect real requests', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('/byog/query');
  await expect(page.getByRole('dialog')).toContainText('Raindrop');
  await page.keyboard.press('Escape');
  if (await page.getByRole('button', { name: 'Switch to light mode' }).count()) await page.getByRole('button', { name: 'Switch to light mode' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'test-results/brain-workspace-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'test-results/brain-workspace-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await expect.poll(() => page.locator('.sidebar').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/brain-workspace-mobile.png', fullPage: true, animations: 'disabled' });
  await testInfo.attach('brain-ui-live-evidence', { body: JSON.stringify({ eventId: generated.eventId, eventUrl: generated.observation.eventUrl, requestIds: generated.brains.flatMap(item => item.requestIds), firstEvidence: await page.getByTestId('first-evidence').textContent(), revisions: generated.brains.map(item => item.brain.revision) }), contentType: 'application/json' });
});

test('partial reads, interrupted streams and telemetry failures remain visible and retryable', async ({ page }) => {
  await page.route('**/api/brain-ui', route => route.fulfill({ status: 200, contentType: 'application/a2ui+json', body: fixtureMessages(model()).map(message => JSON.stringify(message)).join('\n') + '\n' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Brain workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Build my workspace', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'HydraDB answered 503' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Raindrop quality' })).toContainText('Raindrop delivery timed out.');
  await expect(page.getByRole('button', { name: 'This helps', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh knowledge', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Inspect real requests', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Had a failure');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Inspect real requests', exact: true })).toBeFocused();
  await page.unroute('**/api/brain-ui');
  const interrupted = model(); interrupted.status.phase = 'loading'; interrupted.observation.status = 'waiting';
  await page.route('**/api/brain-ui', route => route.fulfill({ status: 200, contentType: 'application/a2ui+json', body: fixtureMessages(interrupted).map(message => JSON.stringify(message)).join('\n') + '\n' }));
  await page.getByRole('button', { name: 'Refresh knowledge', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'connection ended before all status updates' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
});

test('stream parser renders before completion and rejects unsafe, mismatched and incomplete messages', async () => {
  const encoder = new TextEncoder();
  let streamController!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { streamController = controller; } });
  const received: BrainUiMessage[] = [];
  const reading = readBrainUiStream(new Response(stream), message => received.push(message));
  const create = JSON.stringify(fixtureMessages(model())[0]) + '\n';
  streamController.enqueue(encoder.encode(create.slice(0, 21)));
  streamController.enqueue(encoder.encode(create.slice(21)));
  await expect.poll(() => received.length).toBe(1);
  streamController.enqueue(encoder.encode(JSON.stringify(fixtureMessages(model())[1]) + '\n'));
  await expect.poll(() => received.length).toBe(2);
  streamController.close(); await reading;
  const surface = applyBrainUiMessage(null, received[0]);
  expect(() => applyBrainUiMessage(surface, { version: 'v0.9.1', updateComponents: { surfaceId: eventId, components: [{ id: 'root', component: 'Script', code: 'alert(1)' }] } })).toThrow();
  expect(() => applyBrainUiMessage(surface, { version: 'v0.9.1', updateComponents: { surfaceId: eventId, components: [{ id: 'root', component: 'Column', children: ['root'] }] } })).toThrow(/circular/);
  expect(() => applyBrainUiMessage(surface, { version: 'v0.9.1', deleteSurface: { surfaceId: '00000000-0000-4000-8000-000000000003' } })).toThrow(/different request/);
  await expect(readBrainUiStream(new Response(create.trim()), () => undefined)).rejects.toThrow(/last message/);
});

test('brain UI boundaries reject invalid goals and cross-site access before retrieval', async ({ request }) => {
  const catalog = await request.get('/api/brain-ui/catalog');
  expect(catalog.ok()).toBeTruthy();
  expect((await catalog.json()).$id).toBe(BRAIN_UI_CATALOG);
  expect((await request.post('/api/brain-ui', { data: { stack: 'nextjs', goal: 'x' } })).status()).toBe(400);
  expect((await request.post('/api/brain-ui', { headers: { Origin: 'https://untrusted.example' }, data: { stack: 'nextjs', goal: 'Review the dashboard' } })).status()).toBe(403);
  expect((await request.post('/api/brain-ui/feedback', { data: { eventId: 'invalid', verdict: 'helpful' } })).status()).toBe(400);
});

test('Verify with HydraDB exposes native receipts in the shared activity panel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Specialist brains', exact: true }).click();
  await page.getByRole('button', { name: 'Verify with HydraDB', exact: true }).click();
  await expect(page.getByRole('region', { name: /HydraDB verified: 5 of 5 brains/ })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('/databases');
  await expect(page.getByRole('dialog')).toContainText('HTTP 200');
});
