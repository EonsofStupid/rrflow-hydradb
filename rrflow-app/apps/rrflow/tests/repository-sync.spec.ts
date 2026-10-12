import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { RepositorySyncSnapshot, RepositorySyncState } from '../src/lib/repository-sync-contracts';

test('committed repository changes add, edit, retire and retry safely without live credentials', () => {
  const output = execFileSync(process.execPath, [resolve('tests/helpers/repository-sync-fixture.mjs')], { encoding: 'utf8', timeout: 30_000 });
  expect(JSON.parse(output).scenarios).toEqual(['add', 'nested-repository-citations', 'no-op', 'edit', 'delete-retry', 'indexing-failure-retry', 'malformed-upstream', 'corrupt-checkpoint-no-writes', 'foreign-manifest-no-writes']);
});

test('GitHub sync shows native progress, refreshes into readiness and preserves failure visibility', async ({ page }) => {
  const at = '2026-10-12T22:00:00.000Z';
  const state: RepositorySyncState = { version: 1, repository: 'EonsofStupid/rrflow-hydradb', database: 'rrflow_specialist', commit: 'a'.repeat(40), sourceAt: at, startedAt: at, updatedAt: at, finishedAt: null, phase: 'indexing', total: 3, changed: 2, accepted: 2, searchable: 1, completed: 1, failed: 0, removed: 1, deleted: 0, error: null, lastSuccessfulAt: null, lastSuccessfulCommit: null, runUrl: 'https://github.com/EonsofStupid/rrflow-hydradb/actions/runs/123', raindrop: { status: 'pending', eventId: 'fixture-event' }, requestIds: ['fixture-native-sync'] };
  let fail = false;
  await page.route('**/api/workspace', route => route.fulfill({ json: { connected: true, checkedAt: at, brains: [], runs: [], edges: [] } }));
  await page.route('**/api/repository-sync', route => {
    const body: RepositorySyncSnapshot = { state, checkedAt: at, receipts: [{ service: 'HydraDB', action: 'Check GitHub knowledge sync', method: 'POST', endpoint: '/byog/query', database: 'rrflow_specialist', httpStatus: fail ? 503 : 200, outcome: fail ? 'failed' : 'ok', requestId: 'fixture-native-check', latencyMs: 10, at }], ...(fail ? { error: 'Fixture: HydraDB is temporarily unavailable.' } : {}) };
    return route.fulfill({ status: fail ? 503 : 200, json: body });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Connections', exact: true }).click();
  const panel = page.getByRole('region', { name: 'GitHub knowledge sync' });
  await expect(panel).toContainText('Making knowledge searchable');
  await expect(panel.getByText('Still processing', { exact: true }).locator('..')).toContainText('2');
  await expect(panel).toContainText('Waiting for the workflow to report');
  state.phase = 'searchable'; state.searchable = 3; state.completed = 3; state.deleted = 1; state.lastSuccessfulAt = at; state.raindrop = { status: 'accepted', eventId: 'fixture-event', httpStatus: 200 };
  await panel.getByRole('button', { name: 'Check sync now' }).click();
  await expect(panel.getByRole('status')).toContainText('Ready to use');
  await expect(panel).toContainText('Event accepted · HTTP 200');
  await panel.getByText('Sync evidence and native request IDs', { exact: true }).click();
  await expect(panel).toContainText('fixture-native-sync');
  fail = true;
  await panel.getByRole('button', { name: 'Check sync now' }).click();
  await expect(panel.getByRole('alert')).toContainText('Showing the last successfully checked status');
  await panel.getByRole('button', { name: 'Inspect sync requests' }).click();
  await expect(page.getByRole('dialog')).toContainText('HTTP 503');
});
