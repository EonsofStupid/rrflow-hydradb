import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { builtInDatabaseWorkspace, createDatabaseSchema } from '../src/lib/databases-contracts';

test('database manager separates Personal and Shippin and shows accepted creation before readiness', async ({ page }) => {
  const databases = [
    { name: 'default-tenant', workspace: 'personal', ready: true, status: 'Ready to learn', graph: true, knowledge: true, memories: true },
    { name: 'rrflow_specialist', workspace: 'shippin', ready: true, status: 'Ready to learn' },
    { name: 'seniordev', workspace: 'practice', ready: true, status: 'Ready to learn' },
  ];
  const creates: unknown[] = [];
  await page.route('**/api/databases', async route => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON(); creates.push(input);
      const database = { name: input.name, workspace: input.workspace, ready: false, status: 'Preparing database' };
      databases.push(database);
      await route.fulfill({ status: 201, json: { database, created: true, message: 'Database creation accepted. Its workspace assignment is saved; refresh to check when it is ready to learn.', checkedAt: new Date().toISOString(), receipts: [] } });
    } else await route.fulfill({ json: { databases, checkedAt: new Date().toISOString(), receipts: [], warnings: [] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  const manager = page.getByRole('region', { name: 'Manage brain databases' });
  await expect(manager.getByRole('heading', { name: 'Personal brain' })).toBeVisible();
  await expect(manager.getByText('Engineering practice', { exact: true })).toBeVisible();
  await manager.getByLabel('New database name').fill('default-tenant');
  await expect(manager.getByRole('button', { name: 'Create database', exact: true })).toBeDisabled();
  await manager.getByLabel('New database name').fill('my-learning');
  await manager.getByLabel('Where does this belong?').selectOption('personal');
  await manager.getByRole('button', { name: 'Create database', exact: true }).click();
  await expect(manager.getByRole('status')).toContainText('Database creation accepted');
  await expect(manager.getByRole('heading', { name: 'my-learning', exact: true })).toBeVisible();
  await expect(manager.getByText('Preparing database', { exact: true })).toBeVisible();
  expect(creates).toEqual([{ name: 'my-learning', workspace: 'personal' }]);
  databases.find(item => item.name === 'my-learning')!.ready = true;
  databases.find(item => item.name === 'my-learning')!.status = 'Ready to learn';
  await manager.getByRole('button', { name: 'Refresh databases', exact: true }).click();
  await expect(manager.getByText('It is ready for new knowledge.', { exact: false })).toBeVisible();
  await manager.getByText('What is ready inside this brain?', { exact: true }).first().click();
  await expect(manager.getByText('Connections between knowledge', { exact: true }).first()).toBeVisible();
  expect((await new AxeBuilder({ page }).include('section[aria-label="Manage brain databases"]').analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await manager.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
});

test('database creation rejects invalid names, unsupported scopes and cross-site requests before native calls', async ({ request }) => {
  expect(builtInDatabaseWorkspace('default-tenant')).toBe('personal');
  expect(builtInDatabaseWorkspace('constructor')).toBeNull();
  for (const input of [{ name: '../outside', workspace: 'personal' }, { name: 'valid_name', workspace: 'practice' }, { name: 'valid_name', workspace: 'personal', overwrite: true }]) {
    expect(createDatabaseSchema.safeParse(input).success).toBeFalsy();
    const response = await request.post('/api/databases', { data: input });
    expect(response.status()).toBe(400);
    expect((await response.json()).receipts).toEqual([]);
  }
  const blocked = await request.post('/api/databases', { headers: { origin: 'https://unrelated.example' }, data: { name: 'do_not_create', workspace: 'personal' } });
  expect(blocked.ok()).toBeFalsy();
  expect(blocked.status()).toBe(403);
  expect(await blocked.json()).toEqual({ error: 'Cross-site workspace access is not allowed.' });
});

test('existing Personal database cannot be recreated or reassigned through create', async ({ request }) => {
  const response = await request.post('/api/databases', { data: { name: 'default-tenant', workspace: 'shippin' } });
  expect(response.status()).toBe(409);
  const result = await response.json();
  expect(result.error).toContain('already exists');
  expect(result.receipts).toHaveLength(1);
  expect(result.receipts[0]).toMatchObject({ method: 'GET', endpoint: '/databases', outcome: 'ok' });
  const current = await request.get('/api/databases');
  expect(current.ok()).toBeTruthy();
  expect((await current.json()).databases.find((item: { name: string }) => item.name === 'default-tenant')).toMatchObject({ workspace: 'personal' });
});
