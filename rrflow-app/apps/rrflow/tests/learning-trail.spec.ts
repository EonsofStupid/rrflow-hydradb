import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { LearningEvidence, LearningSnapshot } from '../src/lib/learning-contracts';

const evidence = (status: 'failed' | 'passed'): LearningEvidence => ({ version: 1, id: status, kind: 'ci', repository: 'EonsofStupid/rrflow-hydradb', commit: (status === 'failed' ? 'a' : 'b').repeat(40), runUrl: 'https://github.com/EonsofStupid/rrflow-hydradb/actions', at: status === 'failed' ? '2026-10-12T20:00:00Z' : '2026-10-12T21:00:00Z', conclusion: status, checks: [{ name: 'Fixture: placement isolation', status, sourcePath: 'tests/organization.spec.ts', line: 5, rule: { id: 'fixture-isolation', title: 'Fixture: scope assertion', sourceUrl: 'https://github.com/EonsofStupid/rrflow-hydradb', explanation: 'The scope assertion checks the source destination. Failure alone does not establish a cause.' } }], schema: { version: '1.0', path: 'rrflow-app/scripts/learning-evidence.schema.json', sha256: 'c'.repeat(64), sourceUrl: 'https://github.com/EonsofStupid/rrflow-hydradb' }, capture: { mode: 'automatic-ci', tool: 'Playwright + GitHub Actions' } });
test('learning trail traces a failure to its rule, review and later passing evidence', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const snapshot: LearningSnapshot = { evidence: [evidence('passed'), evidence('failed')], lessons: [], dogfood: [{ id: 'workspace:fixture', title: 'Fixture: workspace learning log', at: '2026-10-12T20:00:00Z', path: 'research/fixture.md', sha256: 'd'.repeat(64) }], checkedAt: '2026-10-12T21:10:00Z', errors: [], requestIds: ['fixture-read'] };
  const writes: unknown[] = [];
  await page.route('**/api/learning', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: snapshot });
    const input = route.request().postDataJSON(); writes.push(input);
    const lesson = { ...input, id: 'fixture-lesson', at: snapshot.checkedAt, sourceCommit: 'a'.repeat(40), validationCommit: 'b'.repeat(40), status: 'reviewed-with-follow-up' as const, rule: evidence('failed').checks[0].rule };
    snapshot.lessons = [lesson]; return route.fulfill({ json: { lesson, ingestion: 'accepted', telemetry: 'accepted' } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Learning trail', exact: true }).click();
  const trail = page.getByRole('region', { name: 'Learning trail' });
  await expect(trail.getByText('Captured automatically from CI')).toHaveCount(2);
  const failed = trail.locator('article').filter({ hasText: 'aaaaaaaa' });
  await failed.getByText('Where does the evidence schema come from?', { exact: true }).click();
  await expect(failed.getByRole('link', { name: 'Read the versioned schema' })).toBeVisible();
  await failed.locator('summary').filter({ hasText: 'Fixture: placement isolation' }).click();
  await expect(failed.getByRole('link', { name: 'Fixture: scope assertion' })).toBeVisible();
  await failed.getByRole('button', { name: 'Review this failure' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('What caused the failure?').fill('Fixture diagnosis: the destination was not scoped.');
  await dialog.getByLabel('What correction was made?').fill('Fixture correction: scope the destination from the server.');
  await dialog.getByLabel('What practice should future work use?').fill('Keep workspace boundaries in the server contract.');
  await dialog.getByLabel('Later passing evidence').selectOption('passed');
  await dialog.getByRole('button', { name: 'Save reviewed lesson' }).click();
  await expect(trail.getByRole('status')).toContainText('Raindrop accepted the review event');
  expect(writes).toEqual([expect.objectContaining({ evidenceId: 'failed', validationEvidenceId: 'passed', checkName: 'Fixture: placement isolation' })]);
  await expect(trail.getByRole('heading', { name: 'Keep workspace boundaries in the server contract.' })).toBeVisible();
  for (const theme of ['light', 'dark']) { await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme); expect((await new AxeBuilder({ page }).include('section[aria-label="Learning trail"]').analyze()).violations).toEqual([]); await page.screenshot({ path: `test-results/learning-trail-${theme}.png`, animations: 'disabled' }); }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
test('learning trail rejects incomplete or cross-site lesson writes before native access', async ({ request }) => {
  expect((await request.post('/api/learning', { data: { cause: 'no verified source' } })).status()).toBe(400);
  expect((await request.post('/api/learning', { headers: { origin: 'https://unrelated.example' }, data: {} })).ok()).toBeFalsy();
});
