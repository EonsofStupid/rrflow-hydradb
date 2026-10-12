import { test, expect } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, symlink, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { applyBrainUiMessage, type BrainUiSurface } from '../src/lib/brain-ui-contracts';

test('a delayed project list cannot replace a new selection or show another workspace', async ({ page }) => {
  const saved = {
    id: `project-${'a'.repeat(24)}`, workspace: 'shippin', kind: 'folder', name: 'Fresh project', location: '/fixture/fresh',
    revision: 'a'.repeat(64), revisionKind: 'metadata_fingerprint', loadedAt: new Date().toISOString(), sourceUpdatedAt: null,
    stack: ['typescript'], files: ['package.json'], manifests: [], checks: [], topics: [], warnings: [],
    bounds: { listedFiles: 1, inspectedManifests: 0, truncated: false },
  };
  const stale = { ...saved, id: `project-${'b'.repeat(24)}`, name: 'Older work project' };
  const personal = { ...saved, id: `project-${'c'.repeat(24)}`, workspace: 'personal', name: 'Personal project' };
  let releaseList!: () => void;
  const listGate = new Promise<void>(resolve => { releaseList = resolve; });
  await page.route('**/api/project-context**', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ json: { project: saved, receipts: [] } });
    const workspace = new URL(route.request().url()).searchParams.get('workspace');
    if (workspace === 'shippin') { await listGate; return route.fulfill({ json: { projects: [stale], receipts: [] } }); }
    // Even an incorrectly mixed list must not display a project from another workspace.
    return route.fulfill({ json: { projects: [stale, personal], receipts: [] } });
  });
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Brain workspace', exact: true }).click();
    await page.getByLabel('Existing project folder', { exact: true }).fill('/fixture/fresh');
    await page.getByRole('button', { name: 'Load project into HydraDB' }).click();
    const savedProjects = page.getByLabel('Resume a saved project', { exact: true });
    await expect(savedProjects).toHaveValue(saved.id);
    const delayedResponse = page.waitForResponse(response => response.request().method() === 'GET' && response.url().includes('/api/project-context?workspace=shippin'));
    releaseList();
    await (await delayedResponse).finished();
    await expect(savedProjects).toHaveValue(saved.id);
    await expect(savedProjects.getByRole('option', { name: 'Fresh project · folder' })).toHaveCount(1);
    await expect(savedProjects.getByRole('option', { name: 'Older work project · folder' })).toHaveCount(0);
    await page.getByLabel('Project workspace', { exact: true }).selectOption('personal');
    await expect(savedProjects.getByRole('option', { name: 'Personal project · folder' })).toHaveCount(1);
    await expect(savedProjects.getByRole('option', { name: 'Older work project · folder' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Project context' })).not.toContainText('Saved in HydraDB · Shippin work');
  } finally { releaseList(); }
});

test('a real folder supplies scoped saved context and selects specialists without running scripts or reading secrets', async ({ page, request }) => {
  const folder = await mkdtemp(path.join(tmpdir(), 'rrflow-project-check-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'rrflow-outside-check-'));
  let projectId: string | undefined;
  try {
    await mkdir(path.join(folder, 'src', 'api'), { recursive: true });
    await writeFile(path.join(folder, 'package.json'), JSON.stringify({ private: true, dependencies: { next: '16', react: '19' }, devDependencies: { typescript: '5', '@playwright/test': '1' }, scripts: { test: `touch ${path.join(folder, 'EXECUTED')}`, lint: 'some-untrusted-program' }, secret: 'PRIVATE_FIXTURE_VALUE' }));
    await writeFile(path.join(folder, 'src', 'api', 'contracts.ts'), 'export type Fixture = { name: string };');
    await writeFile(path.join(folder, '.env'), 'PRIVATE_FIXTURE_VALUE');
    await writeFile(path.join(folder, 'credentials.json'), '{"value":"PRIVATE_FIXTURE_VALUE"}');
    await writeFile(path.join(outside, 'package.json'), '{"dependencies":{"outside-secret":"PRIVATE_FIXTURE_VALUE"}}');
    await symlink(outside, path.join(folder, 'escape'));
    await page.setExtraHTTPHeaders({ 'x-rrflow-verification': 'playwright' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Brain workspace', exact: true }).click();
    await page.getByLabel('Project workspace', { exact: true }).selectOption('personal');
    await page.getByLabel('Existing project folder', { exact: true }).fill(folder);
    const loadPromise = page.waitForResponse(response => response.url().endsWith('/api/project-context') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Load project into HydraDB' }).click();
    const load = await loadPromise;
    expect(load.ok(), await load.text()).toBeTruthy();
    const { project, receipts } = await load.json();
    projectId = project.id;
    expect(project.workspace).toBe('personal');
    expect(project.stack).toEqual(expect.arrayContaining(['nextjs', 'react', 'typescript']));
    expect(project.files).toEqual(['package.json', 'src/api/contracts.ts']);
    expect(JSON.stringify(project)).not.toContain('PRIVATE_FIXTURE_VALUE');
    expect(JSON.stringify(project)).not.toContain('some-untrusted-program');
    expect(project.checks.every((check: { status: string }) => check.status === 'not_run')).toBeTruthy();
    expect(receipts.some((receipt: { outcome: string; requestId: string }) => receipt.outcome === 'ok' && receipt.requestId)).toBeTruthy();
    expect(await access(path.join(folder, 'EXECUTED')).then(() => true, () => false)).toBeFalsy();
    await expect(page.getByRole('region', { name: 'Project context' })).toContainText('Saved in HydraDB · Personal');
    await page.getByText('Available checks (2) · Not run', { exact: true }).click();
    await expect(page.getByRole('region', { name: 'Project context' })).toContainText('npm run test');
    const wrongScope = await request.get(`/api/project-context?id=${projectId}&workspace=shippin`);
    expect(wrongScope.status()).toBe(503);
    expect((await wrongScope.json()).error).toContain('not found');
    const streamPromise = page.waitForResponse(response => response.url().endsWith('/api/brain-ui'));
    await page.getByRole('button', { name: 'Build my workspace', exact: true }).click();
    const stream = await streamPromise;
    let surface: BrainUiSurface | null = null;
    for (const line of (await stream.text()).trim().split('\n')) surface = applyBrainUiMessage(surface, JSON.parse(line));
    expect(surface?.model?.project?.id).toBe(projectId);
    expect(surface?.model?.brains.map(item => item.brain.id)).toEqual(expect.arrayContaining(['core', 'nextjs', 'typescript', 'react']));
    expect(surface?.model?.avenues.some(item => item.selection.includes('saved project context'))).toBeTruthy();
    await page.reload();
    await page.getByRole('button', { name: 'Brain workspace', exact: true }).click();
    await page.getByLabel('Project workspace', { exact: true }).selectOption('personal');
    await page.getByLabel('Resume a saved project', { exact: true }).selectOption(projectId!);
    await expect(page.getByRole('region', { name: 'Project context' })).toContainText(project.revision.slice(0, 12));
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  } finally {
    if (projectId) expect((await request.delete(`/api/project-context?id=${projectId}&workspace=personal`)).ok()).toBeTruthy();
    await rm(folder, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('GitHub preview records one real commit and rejects unsafe or fabricated project inputs', async ({ request }) => {
  expect((await request.post('/api/project-context', { data: { kind: 'github', workspace: 'shippin', location: 'https://example.com/owner/repository' } })).status()).toBe(422);
  expect((await request.post('/api/project-context', { data: { kind: 'folder', workspace: 'shippin', location: '/' } })).status()).toBe(422);
  expect((await request.post('/api/project-context', { data: { kind: 'folder', workspace: 'shippin', location: './relative' } })).status()).toBe(422);
  expect((await request.post('/api/project-context', { headers: { origin: 'https://untrusted.example' }, data: { kind: 'github', workspace: 'personal', location: 'digohq/app-starter' } })).status()).toBe(403);
  expect((await request.post('/api/brain-ui', { data: { goal: 'Check my project', stack: 'nextjs', project: { stack: ['rust'] } } })).status()).toBe(400);
  const repository = 'digohq/app-starter';
  const id = `project-${createHash('sha256').update(`shippin:github:${repository}`).digest('hex').slice(0, 24)}`;
  const existing = (await request.get(`/api/project-context?id=${id}&workspace=shippin`)).ok();
  let saved = false;
  try {
    const response = await request.post('/api/project-context', { data: { kind: 'github', workspace: 'shippin', location: `https://github.com/${repository}` } });
    expect(response.ok(), await response.text()).toBeTruthy();
    const { project } = await response.json(); saved = true;
    expect(project.id).toBe(id);
    expect(project.revisionKind).toBe('git_commit');
    expect(project.revision).toMatch(/^[a-f0-9]{40}$/);
    expect(project.files).toContain('package.json');
    expect(project.manifests.length).toBeGreaterThan(0);
    expect(project.files.length).toBeLessThanOrEqual(400);
    expect(project.checks.every((check: { status: string }) => check.status === 'not_run')).toBeTruthy();
    const reloaded = await request.get(`/api/project-context?id=${id}&workspace=shippin`);
    expect((await reloaded.json()).project.revision).toBe(project.revision);
  } finally { if (saved && !existing) expect((await request.delete(`/api/project-context?id=${id}&workspace=shippin`)).ok()).toBeTruthy(); }
});
