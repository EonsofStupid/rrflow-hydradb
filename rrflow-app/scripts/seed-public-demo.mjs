import { pathToFileURL } from 'node:url';

const database = 'rrflow_public_demo';
const collection = 'rrflow_demo';
const repository = 'EonsofStupid/rrflow-hydradb';
const publicRevision = '4b1012e2f196c558ec9f6908d0a3b804f7515098';
const sourceUrl = path => `https://github.com/${repository}/blob/${publicRevision}/${path}`;

/** Explicit public allowlist only. No private workspace, lesson, email or source is read. */
export const createPublicDemoSnapshot = (updatedAt = new Date().toISOString()) => ({
  version: 1, updatedAt,
  sources: [
    { id: 'personal-reading', title: 'Example: a weekend reading list', scope: 'personal', kind: 'illustrative', summary: 'A fictional reader wants to collect books about gardening and choose one for the weekend.', reason: 'This invented example describes leisure interests, so it belongs in Personal. It contains no real person’s history.', sourceUrl: null },
    { id: 'personal-weekend', title: 'Example: plan a neighborhood walk', scope: 'personal', kind: 'illustrative', summary: 'A fictional person keeps a reminder to explore a nearby park on Saturday morning.', reason: 'This invented leisure plan is Personal context. No real location, schedule or calendar was used.', sourceUrl: null },
    { id: 'personal-learning', title: 'Example: learn watercolor painting', scope: 'personal', kind: 'illustrative', summary: 'A fictional learner plans to practice simple watercolor techniques for twenty minutes a week.', reason: 'This invented learning ambition demonstrates a Personal goal without importing anyone’s goals or notes.', sourceUrl: null },
    { id: 'work-overview', title: 'RRFLOW: the public project overview', scope: 'shippin', kind: 'public-repository', summary: 'The public README describes the TypeScript workspace, its Digo foundation, HydraDB knowledge, Playwright checks and visible capability boundaries.', reason: 'This is an explicitly selected public project document. It belongs with Shippin engineering work.', sourceUrl: sourceUrl('rrflow-app/README.md') },
    { id: 'work-context', title: 'How context decisions and lessons are recorded', scope: 'shippin', kind: 'public-repository', summary: 'The public design notes explain reviewable Personal/Shippin suggestions, saved corrections, CI observations and reviewed lessons with source evidence.', reason: 'This published engineering document explains the product’s behavior. It is not a copy of a private inbox or a saved personal lesson.', sourceUrl: sourceUrl('rrflow-app/docs/rrflow/CONTEXT_AND_LEARNING.md') },
    { id: 'work-sync', title: 'How GitHub changes reach the company brain', scope: 'shippin', kind: 'public-repository', summary: 'The public sync guide describes stable source identities, native ingestion, indexing checks, deletion handling and separately reported Raindrop delivery.', reason: 'This published integration guide belongs to the Shippin project. Queued uploads and searchable knowledge remain distinct states.', sourceUrl: sourceUrl('rrflow-app/docs/rrflow/GITHUB_SYNC.md') },
  ],
  learning: {
    failureRunUrl: `https://github.com/${repository}/actions/runs/38321136137`,
    passingRunUrl: `https://github.com/${repository}/actions/runs/38322254472`,
    ruleUrl: `https://github.com/${repository}/blob/8775997805e99a430cd8aba4a049b4ba35d90a0e/rrflow-app/apps/rrflow/tests/connectome.spec.ts#L44`,
    cause: 'Reviewed from the public CI log: the context-refresh assertion selected every alert in the connectome. In CI, two alerts matched, so Playwright rejected the ambiguous locator.',
    correction: 'The published correction filters the alert by “Source service unavailable” before checking visibility. The later linked run passed this same context-refresh test.',
    practice: 'When several alerts can coexist, target the intended message within its region. Preserve the failing run, exact assertion and later passing evidence; a passing follow-up alone does not prove causation.',
  },
});

export const seedPublicDemo = async () => {
  const key = process.env.HYDRA_DB_API_KEY;
  if (!key) throw new Error('HYDRA_DB_API_KEY must be supplied through the server secret environment.');
  const requestIds = [];
  const native = async (endpoint, body) => {
    const response = await fetch(`https://api.hydradb.com${endpoint}`, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${key}`, 'API-Version': '2', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const envelope = await response.json();
    const requestId = response.headers.get('x-request-id') ?? envelope.meta?.request_id;
    if (requestId) requestIds.push(requestId);
    if (!response.ok || envelope.success !== true) throw new Error(`Public demo ${endpoint.split('?')[0]} failed (HTTP ${response.status}).`);
    return envelope.data;
  };
  // Verify these exact public references before creating or changing demo data.
  const snapshot = createPublicDemoSnapshot();
  for (const source of snapshot.sources.filter(item => item.kind === 'public-repository')) {
    const path = new URL(source.sourceUrl).pathname.split(`/blob/${publicRevision}/`)[1];
    const response = await fetch(`https://raw.githubusercontent.com/${repository}/${publicRevision}/${path}`, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`The allowlisted public document ${source.id} could not be verified. No seeding was performed.`);
    // The demonstration publishes authored summaries, never fetched document bodies.
    await response.body?.cancel();
  }
  for (const [run, expected, commit] of [
    ['38321136137', 'failure', '435647cd99da55c26d2022c7692e1e761c57b3c7'],
    ['38322254472', 'success', '8775997805e99a430cd8aba4a049b4ba35d90a0e'],
  ]) {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${run}`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('The allowlisted public CI evidence could not be verified. No seeding was performed.');
    const data = await response.json();
    if (data.conclusion !== expected || data.head_sha !== commit || data.repository?.full_name?.toLowerCase() !== repository.toLowerCase()) throw new Error('The public CI evidence does not match the reviewed example. No seeding was performed.');
  }
  const catalog = await native('/databases');
  if (!Array.isArray(catalog.databases)) throw new Error('HydraDB returned an invalid database catalog.');
  if (!catalog.databases.includes(database)) await native('/databases', { database });
  let ready = false;
  for (let attempt = 0; attempt < 24; attempt++) {
    const status = await native(`/databases/status?database=${database}`);
    if (status.infra?.graph_status === true) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  if (!ready) throw new Error('The dedicated demo graph is still provisioning. Rerun the seed after it becomes ready.');
  const rows = await native('/byog/query', {
    database, collection,
    query: 'MERGE (s:PublicDemoSnapshot {ext_id: $id}) SET s.snapshot = $snapshot RETURN s.ext_id AS id',
    params: { id: 'v1', snapshot: JSON.stringify(snapshot) },
  });
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== 'v1') throw new Error('HydraDB did not confirm the curated demo write.');
  const readBack = await native('/byog/query', {
    database, collection,
    query: 'MATCH (s:PublicDemoSnapshot {ext_id: $id}) RETURN s.snapshot AS snapshot LIMIT 1', params: { id: 'v1' },
  });
  if (readBack?.[0]?.snapshot !== JSON.stringify(snapshot)) throw new Error('The curated snapshot did not match its native read-back.');
  console.log(JSON.stringify({ database, collection, id: 'v1', sources: snapshot.sources.length, publicRevision, verified: true, requestIds }));
  return snapshot;
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedPublicDemo().catch(error => { console.error(error.message); process.exitCode = 1; });
}
