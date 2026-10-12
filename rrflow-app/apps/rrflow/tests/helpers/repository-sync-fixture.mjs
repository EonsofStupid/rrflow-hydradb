import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncRepository, sourceId, readCheckpoint, indexingProgress } from '../../../../scripts/github-sync.mjs';

const original = process.cwd();
const root = mkdtempSync(join(tmpdir(), 'rrflow-sync-test-'));
const app = join(root, 'rrflow-app');
mkdirSync(join(app, 'apps/rrflow/src'), { recursive: true });
const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' }).toString().trim();
git('init', '-q'); git('config', 'user.name', 'RRFLOW test'); git('config', 'user.email', 'fixture@example.invalid');
const commit = () => { git('add', '.'); git('commit', '-qm', 'fixture source change'); };
let checkpoint = null; let failure = null; let deleteBusy = false; let writes = 0; let deleteAttempts = 0;
const sources = new Map(); const ingested = []; const events = [];
let requestNumber = 0;
const envelope = (data, status = 200, success = true) => new Response(JSON.stringify({ success, data, meta: { request_id: `fixture-${++requestNumber}` } }), { status, headers: { 'Content-Type': 'application/json' } });
const fetch = async (input, options = {}) => {
  const url = new URL(input);
  if (url.hostname === 'api.raindrop.ai') { events.push(JSON.parse(options.body)); return new Response('{}', { status: 200 }); }
  if (url.pathname === '/byog/query') {
    const body = JSON.parse(options.body);
    assert.equal(body.database, 'rrflow_specialist'); assert.equal(body.collection, 'rrflow_sync');
    if (body.query.startsWith('MATCH')) return envelope(checkpoint === null ? [] : [{ state: typeof checkpoint === 'string' ? checkpoint : JSON.stringify(checkpoint) }]);
    checkpoint = JSON.parse(body.params.state); writes++; return envelope([{ id: body.params.id }]);
  }
  if (url.pathname === '/context/ingest') {
    assert.equal(options.body.get('upsert'), 'true');
    const docs = JSON.parse(options.body.get('app_knowledge'));
    for (const doc of docs) { sources.set(doc.id, doc); ingested.push(doc); }
    return envelope({ failed_count: 0, results: docs.map(doc => ({ id: doc.id, status: 'queued', error: null })) }, 202);
  }
  if (url.pathname === '/context/status') {
    if (failure === 'malformed') return envelope({ unexpected: [] });
    return envelope({ statuses: url.searchParams.getAll('ids').map(id => ({ id, indexing_status: failure === 'indexing' ? 'failed' : 'completed', error_code: failure === 'indexing' ? 'fixture_failure' : '' })) });
  }
  if (url.pathname === '/context' && options.method === 'DELETE') {
    deleteAttempts++;
    const { ids } = JSON.parse(options.body); assert.equal(ids.length, 1); assert.equal(options.headers['X-HydraDB-Delete-Status'], 'strict');
    if (deleteBusy) { deleteBusy = false; return envelope({ deleted_count: 0, results: [{ id: ids[0], deleted: false, error: 'Indexing' }] }, 409, false); }
    const deleted = sources.delete(ids[0]);
    return envelope({ deleted_count: Number(deleted), results: [{ id: ids[0], deleted, error: '' }] }, deleted ? 200 : 404, deleted);
  }
  throw new Error(`Unexpected simulated request ${url.pathname}`);
};
const run = () => syncRepository({ fetch, env: { GITHUB_REPOSITORY: 'EonsofStupid/rrflow-hydradb', HYDRA_DB_API_KEY: 'fixture-hydra', RAINDROP_WRITE_KEY: 'fixture-raindrop', GITHUB_RUN_ID: '123' }, wait: async () => {}, report: () => {} });
try {
  process.chdir(app);
  writeFileSync(join(app, 'README.md'), '# Public app\n');
  writeFileSync(join(app, 'apps/rrflow/src/example.ts'), 'export const version = 1;\n'); commit();
  const initial = await run();
  assert.equal(initial.phase, 'searchable'); assert.equal(initial.changed, 2); assert.equal(sources.size, 2);
  assert.ok(ingested.every(doc => doc.url.includes('/rrflow-app/') && doc.additional_metadata.path.startsWith('rrflow-app/')));
  const acceptedBefore = ingested.length;
  const noop = await run(); assert.equal(noop.changed, 0); assert.equal(ingested.length, acceptedBefore);
  writeFileSync(join(app, 'apps/rrflow/src/example.ts'), 'export const version = 2;\n'); commit();
  const edit = await run(); assert.equal(edit.changed, 1); assert.equal(sources.size, 2);
  assert.match(sources.get(sourceId('apps/rrflow/src/example.ts')).content.text, /version = 2/);
  unlinkSync(join(app, 'apps/rrflow/src/example.ts')); commit(); deleteBusy = true;
  const removed = await run(); assert.equal(removed.deleted, 1); assert.equal(deleteAttempts, 2); assert.equal(sources.size, 1);
  const successfulCommit = removed.lastSuccessfulCommit;
  writeFileSync(join(app, 'apps/rrflow/src/retry.ts'), 'export const retry = true;\n'); commit(); failure = 'indexing';
  await assert.rejects(run, /indexing failed/);
  assert.equal(checkpoint.phase, 'failed'); assert.equal(checkpoint.lastSuccessfulCommit, successfulCommit);
  assert.ok(checkpoint.pendingManifest['apps/rrflow/src/retry.ts']);
  failure = null; const retry = await run(); assert.equal(retry.changed, 1); assert.equal(retry.phase, 'searchable'); assert.equal(sources.size, 2);
  failure = 'malformed'; await assert.rejects(run, /invalid indexing response/); assert.equal(checkpoint.phase, 'failed'); failure = null;
  const valid = structuredClone(checkpoint); const writesBefore = writes;
  checkpoint = '{broken'; await assert.rejects(run, /checkpoint is unreadable/); assert.equal(writes, writesBefore);
  checkpoint = { ...valid, manifest: { '../../unowned': '0'.repeat(64) } };
  await assert.rejects(run, /manifest is invalid/); assert.equal(writes, writesBefore);
  assert.throws(() => readCheckpoint([{ state: JSON.stringify({ ...valid, database: 'other' }) }]), /different scope/);
  assert.throws(() => indexingProgress({ statuses: [] }, ['missing']), /omitted/);
  assert.ok(events.length >= 7);
  console.log(JSON.stringify({ scenarios: ['add', 'nested-repository-citations', 'no-op', 'edit', 'delete-retry', 'indexing-failure-retry', 'malformed-upstream', 'corrupt-checkpoint-no-writes', 'foreign-manifest-no-writes'], sources: sources.size }));
} finally {
  process.chdir(original);
  // mkdtemp created this exact isolated fixture directory; never remove the real checkout.
  rmSync(root, { recursive: true, force: true });
}
