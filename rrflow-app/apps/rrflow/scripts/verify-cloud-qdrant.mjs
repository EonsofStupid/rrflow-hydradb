import assert from 'node:assert/strict';
import { mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

// Authorized live UI verification: no routes are mocked, no trace/video/storage state
// is recorded, and the password is injected into this process only through its env.
const origin = process.env.RRFLOW_SMOKE_ORIGIN || 'http://localhost:3000';
const readOnly = process.argv.includes('--read-only');
let password = process.env.RRFLOW_WORKSPACE_PASSWORD;
delete process.env.RRFLOW_WORKSPACE_PASSWORD;
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const screenshot = path.join(root, 'submission/screenshots/22-qdrant-cloud-connectome.png');
const scopes = [
  { scope: 'personal', label: 'Personal', database: 'default-tenant', collection: 'rrflow_personal_sources', workspace: 'personal' },
  { scope: 'work', label: 'Work', database: 'rrflow_specialist', collection: 'rrflow_shippin_sources', workspace: 'shippin' },
];
let stage = 'start'; let browser;
const evidence = { at: null, ui: 'Real Playwright browser, no mocked routes', imports: [], readback: [], screenshot: null };
try {
  assert(password && password.length >= 16, 'A workspace password is required.');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, colorScheme: 'dark' });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  stage = 'sign-in';
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Unlock my workspace', exact: true }).click();
  await page.getByLabel('Workspace password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Unlock workspace', exact: true }).click();
  await page.waitForURL(`${origin}/workspace`);
  password = undefined;
  assert.equal((await (await context.request.get(`${origin}/api/session`)).json()).authenticated, true);
  stage = 'open-connectome';
  await page.getByRole('button', { name: 'Connectome', exact: true }).click();
  await page.getByRole('button', { name: 'Qdrant source records', exact: true }).click();
  const libraries = page.getByRole('region', { name: 'Qdrant source libraries', exact: true });
  await expect(libraries).toBeVisible();
  const beforeResponse = await context.request.get(`${origin}/api/qdrant`);
  assert.equal(beforeResponse.status(), 200);
  const before = await beforeResponse.json();
  console.log(JSON.stringify({ stage: 'cloud-sources-loaded', sources: before.sources.map(source => ({ scope: source.scope, connected: source.connected, collection: source.collection, total: source.total, visible: source.points.length })) }));
  for (const target of scopes) {
    stage = `review-${target.scope}`;
    const source = before.sources.find(item => item.scope === target.scope);
    assert(source?.connected && source.location === 'external');
    assert.equal(source.collection, target.collection);
    assert.equal(source.database, target.database);
    assert.equal(source.total, 3); assert.equal(source.points.length, 3);
    const article = libraries.getByRole('article', { name: `${target.label} Qdrant source`, exact: true });
    await expect(article.getByRole('checkbox')).toHaveCount(3);
    await expect(article.getByText(target.collection, { exact: false }).first()).toBeVisible();
    for (const [index, point] of source.points.entries()) {
      stage = `review-${target.scope}-provenance-${index + 1}`;
      const card = article.locator('fieldset > div').filter({ has: page.getByRole('checkbox', { name: point.title, exact: true }) });
      const details = card.locator('details');
      await details.locator('summary').click();
      await expect(details.getByText(point.provenance, { exact: true })).toBeVisible();
      await expect(details.getByText(`Qdrant point: ${point.id} · HydraDB source: ${point.hydraId}`, { exact: true })).toBeVisible();
      await details.locator('summary').click();
      if (!readOnly) await article.getByRole('checkbox', { name: point.title, exact: true }).check();
    }
    if (readOnly) continue;
    stage = `import-${target.scope}`;
    const resultResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/qdrant' && response.request().method() === 'POST' && response.request().postDataJSON().scope === target.scope, { timeout: 120_000 });
    await article.getByRole('button', { name: `Import 3 ${target.label} sources`, exact: true }).click();
    const response = await resultResponse;
    const result = await response.json();
    assert.equal(response.status(), 200);
    assert.equal(result.accepted, 3);
    assert.equal(result.database, target.database);
    assert.equal(result.collection, 'qdrant_sources');
    assert.deepEqual([...result.ids].sort(), source.points.map(point => point.hydraId).sort());
    assert(result.ids.every(id => id.startsWith(`qdrant:${target.scope}:${target.collection}:`)));
    assert(result.receipts.some(receipt => receipt.endpoint === '/context/ingest' && receipt.database === target.database && receipt.outcome === 'ok' && receipt.requestId));
    assert(result.qdrantReceipts.some(receipt => receipt.endpoint === `/collections/${target.collection}/points` && receipt.ok));
    evidence.imports.push({ scope: target.scope, sourceCollection: target.collection, destination: `${result.database}/${result.collection}`, accepted: result.accepted, ids: result.ids, importedAt: result.importedAt, receipts: result.receipts.map(({ endpoint, database, httpStatus, outcome, requestId }) => ({ endpoint, database, httpStatus, outcome, requestId })) });
    await expect(libraries.getByRole('button', { name: 'Refresh source libraries', exact: true })).toBeEnabled({ timeout: 120_000 });
    console.log(JSON.stringify({ stage, accepted: result.accepted, database: result.database, collection: result.collection }));
  }
  stage = 'verify-native-readback';
  const afterResponse = await context.request.get(`${origin}/api/qdrant`);
  assert.equal(afterResponse.status(), 200);
  const after = await afterResponse.json();
  for (const target of scopes) {
    stage = `verify-${target.scope}-registry`;
    const source = after.sources.find(item => item.scope === target.scope);
    console.log(JSON.stringify({ stage, count: source.points.length, warnings: source.warnings.length, points: source.points.map(point => ({ id: point.hydraId, hasImportTime: !!point.importedAt, versionConfirmed: point.importedVersion === point.version, indexingStatus: point.indexingStatus })) }));
    assert.equal(source.points.length, 3);
    assert(source.points.every(point => point.importedAt && point.importedVersion === point.version));
    stage = `verify-${target.scope}-context-list`;
    const response = await context.request.get(`${origin}/api/explore/${target.database}/items?kind=knowledge&pageSize=100&collection=qdrant_sources`);
    assert.equal(response.status(), 200);
    const saved = await response.json();
    const expectedIds = source.points.map(point => point.hydraId);
    const found = saved.items.filter(item => expectedIds.includes(item.id));
    console.log(JSON.stringify({ stage, status: response.status(), listed: saved.items.length, found: found.length, requestId: saved.requestId, metadata: found.map(item => ({ id: item.id, collection: item.additionalMetadata.qdrant_collection, workspace: item.additionalMetadata.workspace })) }));
    assert.equal(found.length, 3);
    assert(found.every(item => item.additionalMetadata.qdrant_collection === target.collection && item.additionalMetadata.workspace === target.workspace));
    evidence.readback.push({ scope: target.scope, database: target.database, collection: 'qdrant_sources', found: found.length, requestId: saved.requestId, points: source.points.map(point => ({ id: point.hydraId, indexingStatus: point.indexingStatus, versionConfirmed: point.importedVersion === point.version })), receipts: after.receipts.filter(receipt => receipt.database === target.database).map(({ endpoint, requestId, outcome }) => ({ endpoint, requestId, outcome })) });
  }
  stage = 'capture-approved-source-cards';
  await libraries.getByRole('button', { name: 'Refresh source libraries', exact: true }).click();
  await expect(libraries.getByRole('button', { name: 'Refresh source libraries', exact: true })).toBeEnabled();
  await mkdir(path.dirname(screenshot), { recursive: true });
  const exists = await access(screenshot).then(() => true).catch(() => false);
  assert(!exists, 'The approved screenshot already exists.');
  // Only the approved source library panel is captured, with personal source bodies collapsed.
  await libraries.screenshot({ path: screenshot, animations: 'disabled' });
  evidence.screenshot = 'submission/screenshots/22-qdrant-cloud-connectome.png';
  evidence.at = new Date().toISOString();
  console.log(JSON.stringify({ ok: true, ...evidence }));
  await context.close();
} catch {
  // Playwright call logs can include a fill value. Never emit raw errors from a live sign-in.
  console.error(JSON.stringify({ ok: false, stage, message: 'Live UI verification stopped; credentials and source content suppressed.', completedImports: evidence.imports, readback: evidence.readback }));
  process.exitCode = 1;
} finally { password = undefined; if (browser) await browser.close(); }
