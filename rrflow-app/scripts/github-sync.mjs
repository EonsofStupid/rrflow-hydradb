import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const repository = 'EonsofStupid/rrflow-hydradb';
export const database = 'rrflow_specialist';
export const checkpointCollection = 'rrflow_sync';
export const checkpointId = repository.toLowerCase();
const api = 'https://api.hydradb.com';
const secretPatterns = [/sk_live_[A-Za-z0-9._-]{16,}/, /gh[pousr]_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];

/** Only public application source, documentation and reproducible configuration. */
export const isSyncPath = path => !path.split('/').some(part => part === '..' || part.startsWith('.env')) && (
  ['README.md', 'AGENTS.md', 'package.json', 'pnpm-workspace.yaml'].includes(path)
  || /^apps\/rrflow\/(src\/.*\.(?:ts|tsx|css)|(?:AGENTS\.md|package\.json|next\.config\.ts))$/.test(path)
  || /^docs\/rrflow\/[^/]+\.md$/.test(path)
  || /^scripts\/github-sync\.mjs$/.test(path)
  || /^\.github\/workflows\/(?:ci|hydradb-sync)\.yml$/.test(path)
);
export const sourceId = path => {
  if (!isSyncPath(path)) throw new Error('Refusing a source outside this repository sync scope.');
  const readable = `github:${checkpointId}:${path}`;
  // HydraDB caps source IDs at 100 UTF-8 bytes. Preserve existing short IDs,
  // and give deeper paths a stable identity without truncating the path itself.
  return Buffer.byteLength(readable) <= 100 ? readable
    : `github:${createHash('sha256').update(`${checkpointId}:${path}`).digest('hex')}`;
};
export const assertSafeSource = (path, content, keys = []) => {
  if (!isSyncPath(path) || Buffer.byteLength(content) > 200_000 || content.includes('\0')) throw new Error(`Unsupported public source: ${path}`);
  if (secretPatterns.some(pattern => pattern.test(content)) || keys.some(key => key && content.includes(key))) throw new Error(`Credential-like content detected in ${path}; sync stopped.`);
};
export const assertIngested = (data, ids) => {
  if (!Array.isArray(data?.results) || data.failed_count > 0) throw new Error('HydraDB did not accept every source.');
  for (const id of ids) {
    const result = data.results.find(item => item.id === id);
    if (!result || !['queued', 'processing', 'completed'].includes(result.status) || result.error) throw new Error('A source was rejected or omitted by HydraDB.');
  }
};
export const indexingProgress = (data, ids) => {
  if (!Array.isArray(data?.statuses)) throw new Error('HydraDB returned an invalid indexing response.');
  let searchable = 0; let completed = 0;
  for (const id of ids) {
    const result = data.statuses.find(item => item.id === id);
    if (!result) throw new Error('HydraDB omitted a requested indexing status.');
    if (['errored', 'failed'].includes(result.indexing_status)) throw new Error(`HydraDB indexing failed (${result.error_code || result.indexing_status}).`);
    if (!['queued', 'processing', 'graph_creation', 'completed'].includes(result.indexing_status)) throw new Error('Unknown HydraDB indexing state.');
    if (['graph_creation', 'completed'].includes(result.indexing_status)) searchable++;
    if (result.indexing_status === 'completed') completed++;
  }
  return { searchable, completed };
};
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 4_000_000 }).trim();
const batches = (items, size = 10) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/** A corrupt checkpoint must never grant permission to delete an unrelated source. */
export const readCheckpoint = rows => {
  if (!Array.isArray(rows) || rows.length > 1) throw new Error('HydraDB returned an invalid repository checkpoint.');
  if (!rows.length) return {};
  let previous;
  try { previous = JSON.parse(rows[0].state); } catch { throw new Error('The repository checkpoint is unreadable; sync stopped without changing sources.'); }
  if (!previous || previous.version !== 1 || previous.repository !== repository || previous.database !== database) throw new Error('The repository checkpoint belongs to a different scope or version.');
  for (const manifest of [previous.manifest, previous.pendingManifest]) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || Object.entries(manifest).some(([path, hash]) => !isSyncPath(path) || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) throw new Error('The repository source manifest is invalid; sync stopped without changing sources.');
  }
  return previous;
};

export async function syncRepository({ fetch: request = globalThis.fetch, env = process.env, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), report = console.log } = {}) {
  if (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY.toLowerCase() !== checkpointId) throw new Error('This sync is scoped to the RRFLOW repository.');
  const key = env.HYDRA_DB_API_KEY;
  if (!key || !env.RAINDROP_WRITE_KEY) throw new Error('HydraDB and Raindrop server credentials are required.');
  const commit = git('rev-parse', 'HEAD');
  const sourceRoot = git('rev-parse', '--show-prefix');
  const sourceAt = git('show', '-s', '--format=%cI', commit);
  // Read the committed tree, never an untracked file or a symlink target on disk.
  const paths = git('ls-tree', '-r', '--name-only', '-z', commit).split('\0').filter(isSyncPath).sort();
  const documents = paths.map(path => {
    // `./` keeps the path relative to this app folder, which is a subfolder of the workspace repository.
    const text = execFileSync('git', ['show', `${commit}:./${path}`], { encoding: 'utf8', maxBuffer: 250_000 });
    assertSafeSource(path, text, [key, env.RAINDROP_WRITE_KEY]);
    return { path, text, hash: createHash('sha256').update(text).digest('hex') };
  });
  if (!documents.length) throw new Error('No public RRFLOW sources found; refusing to clear an existing sync.');
  const manifest = Object.fromEntries(documents.map(doc => [doc.path, doc.hash]));
  const requestIds = [];
  const hydra = async (path, init = {}) => {
    const response = await request(`${api}${path}`, { ...init, signal: AbortSignal.timeout(60_000), headers: { Authorization: `Bearer ${key}`, 'API-Version': '2', ...init.headers } });
    const body = await response.json().catch(() => null);
    const id = response.headers.get('x-request-id') ?? body?.meta?.request_id;
    if (id) requestIds.push(id);
    if (!response.ok || body?.success !== true) {
      const upstream = typeof body?.error?.message === 'string' ? body.error.message : '';
      const reason = upstream.replaceAll(key, '[redacted]').replaceAll(env.RAINDROP_WRITE_KEY, '[redacted]').slice(0, 500);
      throw new Error(`HydraDB ${init.method || 'GET'} ${path.split('?')[0]} failed (HTTP ${response.status}).${reason ? ` ${reason}` : ''}`);
    }
    return body.data;
  };
  const graph = (query, params) => hydra('/byog/query', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, collection: checkpointCollection, query, params }),
  });
  const previousRows = await graph('MATCH (s:RepositorySync {ext_id: $id}) RETURN s.state AS state LIMIT 1', { id: checkpointId });
  const previous = readCheckpoint(previousRows);
  const oldManifest = previous.manifest ?? {};
  // A repository-layout change also refreshes citations for unchanged content.
  const changed = documents.filter(doc => previous.sourceRoot !== sourceRoot || oldManifest[doc.path] !== doc.hash);
  // Include interrupted attempts so a later deletion can retire their sources too.
  const priorPaths = Object.keys({ ...oldManifest, ...previous.pendingManifest });
  const removed = priorPaths.filter(path => !(path in manifest));
  removed.forEach(sourceId);
  const state = {
    version: 1, repository, database, sourceRoot, commit, sourceAt, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    finishedAt: null, phase: 'ingesting', total: documents.length, changed: changed.length, accepted: 0,
    searchable: 0, completed: 0, failed: 0, removed: removed.length, deleted: 0, error: null,
    manifest: oldManifest, pendingManifest: { ...previous.pendingManifest, ...manifest },
    lastSuccessfulAt: previous.lastSuccessfulAt ?? null, lastSuccessfulCommit: previous.lastSuccessfulCommit ?? null,
    runUrl: env.GITHUB_RUN_ID ? `https://github.com/${repository}/actions/runs/${env.GITHUB_RUN_ID}` : null,
    raindrop: { status: 'pending', eventId: `github-sync-${commit}-${env.GITHUB_RUN_ID || 'local'}-${env.GITHUB_RUN_ATTEMPT || '1'}` }, requestIds: [],
  };
  const save = async () => {
    state.updatedAt = new Date().toISOString(); state.requestIds = requestIds.slice(-40);
    await graph('MERGE (s:RepositorySync {ext_id: $id}) SET s.state = $state RETURN s.ext_id AS id', { id: checkpointId, state: JSON.stringify(state) });
  };
  await save();
  let syncError;
  try {
    for (const batch of batches(changed)) {
      const form = new FormData();
      form.set('database', database); form.set('type', 'knowledge'); form.set('upsert', 'true');
      form.set('app_knowledge', JSON.stringify(batch.map(doc => ({
        id: sourceId(doc.path), title: `${repository} / ${sourceRoot}${doc.path}`, type: 'github_source',
        url: `https://github.com/${repository}/blob/${commit}/${(sourceRoot + doc.path).split('/').map(encodeURIComponent).join('/')}`, timestamp: sourceAt, content: { text: doc.text },
        additional_metadata: { repository, path: `${sourceRoot}${doc.path}`, app_path: doc.path, commit, sha256: doc.hash, source_system: 'github', workspace: 'shippin-cluster' },
      }))));
      const result = await hydra('/context/ingest', { method: 'POST', body: form });
      assertIngested(result, batch.map(doc => sourceId(doc.path)));
      state.accepted += batch.length; await save();
    }
    state.phase = 'indexing'; await save();
    const deadline = Date.now() + 10 * 60_000;
    const ids = documents.map(doc => sourceId(doc.path));
    while (true) {
      let searchable = 0; let completed = 0;
      for (const batch of batches(ids)) {
        const params = new URLSearchParams({ database }); batch.forEach(id => params.append('ids', id));
        const result = await hydra(`/context/status?${params}`);
        state.failed += Array.isArray(result?.statuses) ? batch.filter(id => result.statuses.some(item => item.id === id && ['errored', 'failed'].includes(item.indexing_status))).length : 0;
        const progress = indexingProgress(result, batch);
        searchable += progress.searchable; completed += progress.completed;
      }
      state.searchable = searchable; state.completed = completed; await save();
      if (searchable === ids.length) break;
      if (Date.now() > deadline) throw new Error('Native processing did not reach graph_creation or completed within ten minutes. Rerun the workflow to retry.');
      await wait(5000);
    }
    // Only retire exact source IDs previously owned by this sync; never clear a database.
    for (const path of removed) {
      let deleted = false;
      for (let attempt = 0; attempt < 3 && !deleted; attempt++) {
      const response = await request(`${api}/context`, {
        method: 'DELETE', signal: AbortSignal.timeout(60_000),
        headers: { Authorization: `Bearer ${key}`, 'API-Version': '2', 'Content-Type': 'application/json', 'X-HydraDB-Delete-Status': 'strict' },
        body: JSON.stringify({ database, type: 'knowledge', ids: [sourceId(path)] }),
      });
      const body = await response.json().catch(() => null);
      const id = response.headers.get('x-request-id') ?? body?.meta?.request_id; if (id) requestIds.push(id);
      const result = body?.data?.results?.find(item => item.id === sourceId(path));
      deleted = (response.ok && body?.success === true && body?.data?.deleted_count === 1 && result?.deleted === true && !result.error)
        || (response.status === 404 && body?.data?.deleted_count === 0 && result?.deleted === false);
      if (!deleted && [409, 429, 500, 502, 503, 504].includes(response.status) && attempt < 2) await wait(5000);
      else if (!deleted) throw new Error(`An obsolete source could not be removed (HTTP ${response.status}).`);
      }
      state.deleted++;
      await save();
    }
    state.phase = 'searchable'; state.manifest = manifest; state.pendingManifest = {};
    state.lastSuccessfulAt = new Date().toISOString(); state.lastSuccessfulCommit = commit;
  } catch (error) {
    syncError = error; state.phase = 'failed'; state.error = error instanceof Error ? error.message : 'Repository sync failed.';
  }
  state.finishedAt = new Date().toISOString(); await save();
  try {
    const response = await request('https://api.raindrop.ai/v1/events/track', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${env.RAINDROP_WRITE_KEY}`, 'Content-Type': 'application/json', 'X-Raindrop-Project-Id': 'rrflow-hydradb' },
      body: JSON.stringify([{
        event_id: state.raindrop.eventId, user_id: 'rrflow-github', event: 'github_repository_sync',
        properties: { repository, commit, database, phase: state.phase, changed: state.changed, total: state.total, searchable: state.searchable, deleted: state.deleted, error: state.error, hydradb_request_ids: state.requestIds, kind: 'repository_sync' },
      }]),
    });
    state.raindrop.status = response.ok ? 'accepted' : 'failed'; state.raindrop.httpStatus = response.status;
  } catch { state.raindrop.status = 'failed'; }
  await save();
  const summary = `### RRFLOW → HydraDB\n\n- Repository: ${repository}\n- Commit: ${commit}\n- State: ${state.phase}\n- Sources: ${state.total}; changed: ${state.changed}; graph stage reached: ${state.searchable}; retired: ${state.deleted}\n- Raindrop: ${state.raindrop.status}\n- Checkpoint: ${database}/${checkpointCollection}\n${state.error ? `- Error: ${state.error}\n` : ''}`;
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  report(summary);
  if (syncError) throw syncError;
  if (state.raindrop.status !== 'accepted') throw new Error('Native graph processing reached its checkpoint, but Raindrop delivery failed. Rerun to retry.');
  return state;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncRepository().catch(error => { console.error(error.message); process.exitCode = 1; });
}
