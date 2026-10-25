import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { activeDecisions, applyReviewedKnowledge, knowledgeActionSchema, knowledgeDecisionSchema, knowledgeEvidenceSchema, knowledgeQuerySchema, knowledgeRunSchema, type KnowledgePolicy, type KnowledgeRun } from '../src/lib/knowledge-path-contracts';
import { brainRegistrationSchema } from '../src/lib/brain-registry-contracts';

const now = '2026-10-24T23:00:00.000Z';
const brain = brainRegistrationSchema.parse({ version: 1, id: 'brain-11111111-1111-4111-8111-111111111111', workspace: 'shippin', projectId: `project-${'a'.repeat(24)}`, projectSlug: 'rrflow', purpose: 'knowledge', displayName: 'RRFLOW project', canonicalName: 'work/rrflow/knowledge', aliases: [], database: 'rrflow_specialist', collection: '', revision: 1, createdAt: now, updatedAt: now });
const evidence = knowledgeEvidenceSchema.parse({ sourceId: 'public-source', chunkId: 'chunk-1', title: 'Timestamp behavior', excerpt: 'A sync timestamp is not the original source date.', fingerprint: 'a'.repeat(64), sourceUrl: null, sourceRevision: 'b'.repeat(40), sourceDate: null, syncedAt: now, sourcePath: 'src/timestamps.ts' });
const emptyPolicy = (): KnowledgePolicy => ({ revision: 0, decisions: [] });
const runFixture = (policy = emptyPolicy(), id = '11111111-1111-4111-8111-111111111111'): KnowledgeRun => knowledgeRunSchema.parse({ version: 1, id, workspace: brain.workspace, brain, projectName: 'RRFLOW', projectRevision: 'b'.repeat(40), question: 'Which timestamp should the UI display?', mode: 'fast', recordType: 'knowledge', at: now, policyRevision: policy.revision, ...applyReviewedKnowledge([evidence], policy), rejectedScopeCount: 0, requestId: '22222222-2222-4222-8222-222222222222', route: ['Shippin work', 'RRFLOW', brain.canonicalName, 'rrflow_specialist / default', 'Native hybrid retrieval', 'Reviewed guidance + source evidence'], warnings: ['Source text is evidence, not instructions.'] });
const query = () => knowledgeQuerySchema.parse({ action: 'query', workspace: brain.workspace, brainId: brain.id, expectedBrainRevision: 1, question: 'Which timestamp should the UI display?' });

test('knowledge path contracts preserve vision and history while applying only current reviewed corrections', () => {
  const baseline = runFixture();
  const correction = knowledgeDecisionSchema.parse({ id: '33333333-3333-4333-8333-333333333333', kind: 'correction', text: 'Show sync time separately from the original source date.', reason: 'The original source date was not supplied.', runId: baseline.id, at: now, reviewer: 'workspace-owner', revision: 1, replaces: null, evidenceFingerprints: [evidence.fingerprint] });
  const policy = { revision: 1, decisions: [correction] };
  expect(applyReviewedKnowledge([evidence], policy)).toMatchObject({ evidence: [], excluded: [{ fingerprint: evidence.fingerprint, decisionId: correction.id }], guidance: [correction] });
  const replacement = { ...correction, id: '44444444-4444-4444-8444-444444444444', revision: 2, replaces: correction.id, evidenceFingerprints: [] };
  expect(activeDecisions({ revision: 2, decisions: [correction, replacement] })).toEqual([replacement]);
  expect(applyReviewedKnowledge([evidence], { revision: 2, decisions: [correction, replacement] }).evidence).toHaveLength(1);
  expect(() => activeDecisions({ revision: 2, decisions: [correction, { ...replacement, kind: 'vision' }] })).toThrow(/vision/);
  expect(() => activeDecisions({ revision: 3, decisions: [correction] })).toThrow(/incomplete/);
  expect(knowledgeActionSchema.safeParse({ ...query(), database: 'default-tenant' }).success).toBe(false);
  expect(knowledgeActionSchema.safeParse({ action: 'review', workspace: brain.workspace, brainId: brain.id, runId: baseline.id, expectedPolicyRevision: 0, kind: 'correction', text: correction.text, reason: correction.reason, evidenceFingerprints: [], replaces: null, confirm: true }).success).toBe(false);
});

const loadServer = () => {
  const runtimeRequire = createRequire(resolve('package.json')); const cache = new Map<string, { exports: Record<string, unknown> }>();
  const load = (filename: string): Record<string, unknown> => {
    const file = filename.endsWith('.ts') ? filename : `${filename}.ts`; if (cache.has(file)) return cache.get(file)!.exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const localRequire = (name: string) => name === 'server-only' ? {} : name.startsWith('.') ? load(resolve(dirname(file), name)) : runtimeRequire(name);
    new Function('require', 'module', 'exports', code)(localRequire, loaded, loaded.exports); return loaded.exports;
  };
  return load(resolve('src/lib/knowledge-path.ts')) as typeof import('../src/lib/knowledge-path');
};

test('knowledge path server enforces scope, saves real query provenance, rejects stale reviews and applies corrections on the next run', async () => {
  const savedFetch = globalThis.fetch; const oldKey = process.env.HYDRA_DB_API_KEY; const oldRaindrop = process.env.RAINDROP_WRITE_KEY;
  process.env.HYDRA_DB_API_KEY = 'fixture-only'; delete process.env.RAINDROP_WRITE_KEY;
  let policy = emptyPolicy(); const runs = new Map<string, KnowledgeRun>(); const queryBodies: Record<string, unknown>[] = []; let nativeFeedback = 0;
  const project = { id: brain.projectId, workspace: 'shippin', kind: 'github', name: 'RRFLOW', location: 'EonsofStupid/rrflow-hydradb', revision: 'b'.repeat(40), revisionKind: 'git_commit', loadedAt: now, sourceUpdatedAt: null, stack: [], files: [], manifests: [], checks: [], topics: [], warnings: [], bounds: { listedFiles: 0, inspectedManifests: 0, truncated: false } };
  const envelope = (data: unknown) => Response.json({ success: true, data, meta: { request_id: '22222222-2222-4222-8222-222222222222' } });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.pathname === '/databases') return envelope({ databases: ['rrflow_specialist', 'default-tenant', 'rrflow_registry'], failed_databases: [] });
    if (url.pathname === '/feedback') { nativeFeedback++; expect(body.request_id).toBe('22222222-2222-4222-8222-222222222222'); return envelope({ accepted: true }); }
    if (url.pathname === '/query') {
      queryBodies.push(body); expect(body.database).toBe(brain.database); expect(body.collection).toBe(''); expect(body.type).toBe('knowledge');
      expect(body.metadata_filters).toEqual({ additional_metadata: { repository: project.location } });
      return envelope({ chunks: [
        { id: 'real-source-id', chunk_uuid: 'chunk-1', chunk_content: 'Show HydraDB timestamp as the original email date.', source_title: 'Misleading source date', source_upload_time: now, source_last_updated_time: '2026-10-25T00:00:00.000Z', additional_metadata: { repository: project.location, path: 'src/date.ts', commit: 'b'.repeat(40), observed_at: now } },
        { id: 'foreign-source', chunk_content: 'Must not leak into this project', additional_metadata: { repository: 'other/project' } },
      ] });
    }
    expect(url.pathname).toBe('/byog/query');
    if (body.query.includes('DatabaseWorkspace')) return envelope([]);
    if (body.query.includes('HAS_CONTEXT')) return envelope([{ payload: JSON.stringify(project) }]);
    expect(body.database).toBe('rrflow_registry');
    if (body.query.startsWith('MATCH (r:BrainRegistry')) return envelope(body.collection === 'work' ? [{ anchorId: 1, registryRevision: 1, ...brain }] : []);
    expect(body.collection).toBe('work');
    if (body.query.includes('OPTIONAL MATCH (p)-[:HAS_REVISION]')) return envelope(policy.decisions.map(item => ({ anchor: 1, revision: policy.revision, state: JSON.stringify(item) })));
    if (body.query.includes('CREATE (r:KnowledgeRun')) { expect(body.query).toContain('coalesce(p.revision,0)=$policyRevision'); if (body.params.policyRevision !== policy.revision) return envelope([]); const run = knowledgeRunSchema.parse(JSON.parse(body.params.state)); runs.set(run.id, run); return envelope([{ state: JSON.stringify(run) }]); }
    if (body.query.includes('CREATE (d:KnowledgeDecision')) {
      expect(body.query).toContain('WHERE p.revision=$expected'); if (body.params.expected !== policy.revision) return envelope([]);
      const decision = knowledgeDecisionSchema.parse(JSON.parse(body.params.decisionState)); policy = { revision: policy.revision + 1, decisions: [...policy.decisions, decision] }; return envelope([{ state: JSON.stringify(decision) }]);
    }
    if (body.query.includes('HAS_RUN')) return envelope([...runs.values()].filter(run => !body.params.run || run.id === body.params.run).map(run => ({ state: JSON.stringify(run) })));
    throw new Error('Unexpected native operation in knowledge-path test');
  };
  try {
    const api = loadServer();
    await expect(api.queryKnowledgePath({ ...query(), workspace: 'personal' }, [])).rejects.toThrow(/not registered/);
    await expect(api.queryKnowledgePath({ ...query(), expectedBrainRevision: 0 }, [])).rejects.toThrow(/brain changed/);
    expect(queryBodies).toHaveLength(0);
    const first = await api.queryKnowledgePath(query(), []); expect(first.run.evidence).toHaveLength(1); expect(first.run.rejectedScopeCount).toBe(1); expect(first.run.evidence[0].sourceId).toBe('real-source-id'); expect(first.run.evidence[0].sourceDate).toBeNull();
    expect(first.run.evidence[0].syncedAt).toBe('2026-10-25T00:00:00.000Z');
    const review = { action: 'review' as const, workspace: brain.workspace, brainId: brain.id, runId: first.run.id, expectedPolicyRevision: 0, kind: 'correction' as const, text: 'Display sync time separately; the original source date is unknown.', reason: 'A native upload timestamp does not establish the source date.', evidenceFingerprints: [first.run.evidence[0].fingerprint], replaces: null, confirm: true as const };
    await expect(api.reviewKnowledgePath({ ...review, evidenceFingerprints: ['f'.repeat(64)] }, [])).rejects.toThrow(/selected run/);
    const reviews = await Promise.allSettled([api.reviewKnowledgePath(review, []), api.reviewKnowledgePath({ ...review, text: 'Competing correction must not overwrite an accepted revision.' }, [])]);
    expect(reviews.filter(item => item.status === 'fulfilled')).toHaveLength(1); expect(nativeFeedback).toBe(1);
    const next = await api.queryKnowledgePath(query(), []); expect(next.run.evidence).toHaveLength(0); expect(next.run.excluded).toHaveLength(1); expect(next.run.guidance).toHaveLength(1); expect(queryBodies[1].additional_context).toContain('correction:');
    expect((await loadServer().readKnowledgeRun('shippin', brain.id, next.run.id, [])).policyRevision).toBe(1);
    await expect(api.reviewKnowledgePath(review, [])).rejects.toThrow(/guidance changed/);
  } finally { globalThis.fetch = savedFetch; if (oldKey === undefined) delete process.env.HYDRA_DB_API_KEY; else process.env.HYDRA_DB_API_KEY = oldKey; if (oldRaindrop === undefined) delete process.env.RAINDROP_WRITE_KEY; else process.env.RAINDROP_WRITE_KEY = oldRaindrop; }
});

test('knowledge path UI shows evidence, saves a reviewed correction and exposes its next-run effect with accessible scope changes', async ({ page }) => {
  let policy = emptyPolicy(); const runs: KnowledgeRun[] = []; let stale = false;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/workspace', route => route.fulfill({ json: { connected: true, checkedAt: now, brains: [], edges: [], runs: [] } }));
  await page.route('**/api/brain-registry?*', route => route.fulfill({ json: { workspace: new URL(route.request().url()).searchParams.get('workspace'), revision: 1, brains: route.request().url().includes('shippin') ? [brain] : [], receipts: [], checkedAt: now } }));
  await page.route('**/api/project-context?*', route => route.fulfill({ json: { projects: [], receipts: [] } }));
  await page.route('**/api/knowledge-path*', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { brain, policy, runs, receipts: [] } });
    const input = knowledgeActionSchema.parse(route.request().postDataJSON());
    if (input.action === 'query') { const run = runFixture(policy, runs.length ? '55555555-5555-4555-8555-555555555555' : undefined); runs.unshift(run); return route.fulfill({ json: { run, observation: { status: 'accepted' }, receipts: [] } }); }
    if (input.action !== 'review') throw new Error('Unexpected connection mutation');
    if (stale) return route.fulfill({ status: 409, json: { error: 'Reviewed guidance changed. Reload before retrying.' } });
    const decision = knowledgeDecisionSchema.parse({ ...input, id: '33333333-3333-4333-8333-333333333333', at: now, revision: policy.revision + 1, reviewer: 'workspace-owner' });
    policy = { revision: policy.revision + 1, decisions: [...policy.decisions, decision] };
    return route.fulfill({ json: { policy, decision, nativeFeedback: 'accepted', observation: { status: 'accepted' }, receipts: [] } });
  });
  const open = async () => { await page.goto('/workspace'); await page.getByRole('button', { name: 'Connectome', exact: true }).click(); await page.getByRole('button', { name: 'Knowledge path', exact: true }).click(); await page.getByLabel('Registered project brain').selectOption(brain.id); };
  await open(); const region = page.getByRole('region', { name: 'RRFLOW knowledge path' });
  await region.getByRole('button', { name: 'Ask this brain', exact: true }).click();
  await expect(region.getByRole('region', { name: 'Retrieved knowledge evidence' })).toContainText('1 source passages');
  await expect(page.getByRole('button', { name: /What RRFLOW did/ })).toContainText('1');
  await region.getByText('Source, revision and dates', { exact: true }).click(); await expect(region).toContainText('Original source date: Not recorded');
  await region.getByRole('button', { name: 'Review this context' }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('What should RRFLOW use instead?').fill('Display sync time separately from the original source date.');
  await dialog.getByLabel('Why is this the right guidance?').fill('The original source date was not supplied by this record.');
  await dialog.getByLabel('Timestamp behavior', { exact: true }).check(); await dialog.getByLabel('I reviewed this guidance and want RRFLOW to use it.').check();
  await dialog.getByRole('button', { name: 'Save reviewed guidance' }).click(); await expect(dialog).toHaveCount(0);
  await region.getByRole('button', { name: 'Ask again with reviewed context' }).click();
  await expect(region.getByRole('region', { name: 'Retrieved knowledge evidence' })).toContainText('0 source passages · 1 reviewed instructions');
  await expect(region).toContainText('1 corrected passages excluded');
  await open(); await expect(region.getByRole('region', { name: 'Reviewed guidance' })).toContainText('Display sync time separately');
  await region.getByLabel('Reopen a saved knowledge path').selectOption(runs[0].id);
  stale = true; await region.getByRole('button', { name: 'Review this context' }).click();
  await dialog.getByLabel('Review type').selectOption('vision'); await dialog.getByLabel('What should guide this project?').fill('Preserve my priorities when evaluating provider changes.');
  await dialog.getByLabel('Why is this the right guidance?').fill('Provider changes must not silently override the owner.'); await dialog.getByLabel('I reviewed this guidance and want RRFLOW to use it.').check();
  await dialog.getByRole('button', { name: 'Save reviewed guidance' }).click(); await expect(dialog.getByRole('alert')).toContainText('guidance changed'); await expect(dialog.getByLabel('What should guide this project?')).toHaveValue('Preserve my priorities when evaluating provider changes.');
  await page.keyboard.press('Escape');
  for (const theme of ['light', 'dark']) { const toggle = page.getByRole('button', { name: `Switch to ${theme} mode` }); if (await toggle.count()) await toggle.click(); expect((await new AxeBuilder({ page }).include('section[aria-label="RRFLOW knowledge path"]').analyze()).violations).toEqual([]); await region.screenshot({ path: `test-results/knowledge-path-${theme}.png`, animations: 'disabled' }); }
  await page.setViewportSize({ width: 390, height: 844 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await region.getByLabel('Knowledge workspace').selectOption('personal'); await expect(region).not.toContainText('Display sync time separately'); await expect(region.getByLabel('Registered project brain')).toHaveValue('');
});

test('knowledge path MCP uses the same API and revision contract without exposing review or native override tools', async () => {
  const runtimeRequire = createRequire(resolve('package.json'));
  const { Client } = runtimeRequire('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = runtimeRequire('@modelcontextprotocol/sdk/client/stdio.js');
  let queryBody: Record<string, unknown> | null = null;
  const server = createServer(async (request, response) => {
    let text = ''; for await (const chunk of request) text += chunk;
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'POST') { queryBody = JSON.parse(text); response.end(JSON.stringify({ run: runFixture(), observation: { status: 'accepted' }, receipts: [] })); }
    else response.end(JSON.stringify({ workspace: brain.workspace, revision: 1, brains: [brain], receipts: [], checkedAt: now }));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done)); const address = server.address(); if (!address || typeof address === 'string') throw new Error('Test server did not bind');
  const client = new Client({ name: 'rrflow-playwright', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve('../../scripts/knowledge-mcp.mjs')], env: { PATH: process.env.PATH || '', RRFLOW_BASE_URL: `http://127.0.0.1:${address.port}` } });
  try {
    await client.connect(transport); const tools = await client.listTools(); expect(tools.tools.map((item: { name: string }) => item.name)).toEqual(['list_registered_brains', 'get_project_knowledge', 'read_knowledge_run']);
    const result = await client.callTool({ name: 'get_project_knowledge', arguments: { workspace: 'shippin', brain: brain.canonicalName, question: 'Which timestamp should the UI display?' } });
    expect(result.isError).not.toBe(true); expect(queryBody).toMatchObject({ brainId: brain.id, expectedBrainRevision: 1, workspace: 'shippin', action: 'query' }); expect(queryBody).not.toHaveProperty('database');
    const content = JSON.parse(result.content[0].text); expect(content.run.id).toBe(runFixture().id);
  } finally { await client.close(); await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); }
});

test('knowledge path API rejects source overrides, unconfirmed reviews and foreign origins before native operations', async ({ request }) => {
  expect((await request.post('/api/knowledge-path', { data: { ...query(), database: 'default-tenant' } })).status()).toBe(400);
  expect((await request.post('/api/knowledge-path', { data: query(), headers: { origin: 'https://foreign.example' } })).status()).toBe(403);
  expect((await request.post('/api/knowledge-path', { data: { action: 'review', confirm: false } })).status()).toBe(400);
  expect((await request.get(`/api/knowledge-path?workspace=shippin&workspace=personal&brainId=${brain.id}`)).status()).toBe(400);
});

test('knowledge path CI verifies saved retrieval without publishing source content and rejects untrusted events', async () => {
  let mismatch = false;
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'POST') { for await (const chunk of request) void chunk; response.end(JSON.stringify({ run: runFixture(), observation: { status: 'accepted' } })); }
    else if (request.url?.startsWith('/api/brain-registry')) response.end(JSON.stringify({ brains: [brain] }));
    else { const run = runFixture(); if (mismatch) run.evidence[0].excerpt = 'PRIVATE_FAILURE_PASSAGE'; response.end(JSON.stringify({ run })); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done)); const address = server.address(); if (!address || typeof address === 'string') throw new Error('Fixture could not bind');
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test', PATH: process.env.PATH, RRFLOW_BASE_URL: `http://127.0.0.1:${address.port}` };
  const script = resolve('../../scripts/verify-knowledge.mjs');
  try {
    const result = await promisify(execFile)(process.execPath, [script], { env });
    expect(JSON.parse(result.stdout)).toMatchObject({ savedReadVerified: true, sourcePassages: 1, raindrop: 'accepted' });
    expect(result.stdout).not.toContain(evidence.excerpt); expect(result.stdout).not.toContain(evidence.sourceId);
    mismatch = true;
    const failed = await promisify(execFile)(process.execPath, [script], { env }).catch((error: Error & { stderr: string }) => error);
    expect(failed.stderr).toContain('saved comparison'); expect(failed.stderr).not.toContain('PRIVATE_FAILURE_PASSAGE'); expect(failed.stderr).not.toContain(evidence.excerpt);
    await expect(promisify(execFile)(process.execPath, [script], { env: { ...env, GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'pull_request' } })).rejects.toThrow(/main-branch push/);
  } finally { await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())); }
});
