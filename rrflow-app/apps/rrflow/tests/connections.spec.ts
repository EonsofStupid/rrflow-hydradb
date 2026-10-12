import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { connectionsActionSchema, publicWebhookUrl } from '../src/lib/connections-contracts';

test('connector setup selects a brain and sources before sync, and webhooks require explicit organization consent', async ({ page }) => {
  const now = new Date().toISOString();
  const connector = { id: 'test_connector', name: 'RRFLOW GitHub', provider: 'github', database: 'rrflow_specialist', collection: 'connected-sources', lifecycle: 'pending_setup', syncStatus: 'idle', lastAttempt: null, lastSuccess: null, nextSync: null, dispatched: 0, resources: 0, needsAttention: false };
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
    else body = { overview: { providers: [{ id: 'github', category: 'development', webhook: false, beta: false }], connectors: created ? [connector] : [], webhook: { registered, url: registered ? 'https://hooks.example.com/hydradb' : null, signing: registered, events: ['indexing.status_changed'] }, deliveries: [], warnings: [], checkedAt: now } };
    await route.fulfill({ json: { ...body, receipts: [] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  const console = page.getByRole('region', { name: 'Knowledge connections' });
  await expect(console.getByText('No connectors in the five managed RRFLOW brains yet.', { exact: false })).toBeVisible();
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

test('connection inputs reject unmanaged scopes, local webhooks and unexpected fields before native writes', async ({ request }) => {
  for (const value of ['http://example.com/hook', 'https://localhost/hook', 'https://example.com/hook?key=hidden', 'https://user:pass@example.com/hook']) expect(publicWebhookUrl.safeParse(value).success).toBeFalsy();
  expect(connectionsActionSchema.safeParse({ action: 'create', provider: 'github', name: 'Wrong scope', database: 'default-tenant', account: '', credentials: {} }).success).toBeFalsy();
  expect(connectionsActionSchema.safeParse({ action: 'test-webhook', credentials: { secret: 'unused' } }).success).toBeFalsy();
  const result = await request.post('/api/connections', { data: { action: 'register-webhook', url: 'http://localhost:3100/callback', generateSecret: true, acknowledgeOrganization: true } });
  expect(result.status()).toBe(400);
  expect((await result.json()).receipts).toEqual([]);
  const blocked = await request.post('/api/connections', { headers: { origin: 'https://unrelated.example' }, data: { action: 'test-webhook' } });
  expect(blocked.ok()).toBeFalsy();
  expect((await blocked.json()).receipts).toEqual([]);
});
