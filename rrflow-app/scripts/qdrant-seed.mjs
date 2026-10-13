import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const collection = 'rrflow_sources';
const seedNamespace = 'rrflow-initial-source-v1';
const pointId = (scope, source) => {
  const hash = createHash('sha256').update(`${seedNamespace}:${scope}:${source}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};
const call = async (base, path, method = 'GET', body) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Qdrant ${method} ${path} returned HTTP ${response.status}`);
  const data = await response.json();
  if (data.status !== 'ok') throw new Error('Qdrant did not confirm this operation.');
  return data.result;
};
// Personal seed text stays outside the public repository. Supply only goals explicitly provided by the user.
const personalPath = process.env.RRFLOW_QDRANT_PERSONAL_SEEDS || join(homedir(), '.local', 'share', 'rrflow-qdrant', 'personal-seeds.json');
const personalInput = JSON.parse(await readFile(personalPath, 'utf8'));
if (!Array.isArray(personalInput) || !personalInput.length || personalInput.length > 50 || personalInput.some(item =>
  !item || typeof item.sourceId !== 'string' || typeof item.title !== 'string' || typeof item.text !== 'string' || item.text.length > 60_000)) throw new Error('Personal seeds must be a bounded array of user-provided sourceId, title and text records.');
const personal = personalInput.map(({ sourceId, title, text }) => ({ sourceId, title, text,
  provenance: 'User-provided goals and preferences in the RRFLOW project conversation; concise paraphrase, not independently inferred personal data.', sourceKind: 'user-provided-goals', sourceUrl: null }));

// Work is seeded only from files already published to the user's public repository.
const repository = 'EonsofStupid/rrflow-hydradb';
const commitResponse = await fetch(`https://api.github.com/repos/${repository}/commits/main`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(20_000) });
if (!commitResponse.ok) throw new Error('The public Work repository revision could not be verified. No seeding was performed.');
const commit = (await commitResponse.json()).sha;
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Unexpected public repository commit.');
const work = await Promise.all(['README.md', 'rrflow-app/README.md', 'TEAM.md'].map(async path => {
  const sourceUrl = `https://github.com/${repository}/blob/${commit}/${path}`;
  const response = await fetch(`https://raw.githubusercontent.com/${repository}/${commit}/${path}`, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Public Work source ${path} could not be read.`);
  const text = await response.text();
  if (text.length > 60_000) throw new Error('A public Work document exceeds the bounded seed size.');
  return { sourceId: path, title: `RRFLOW public repository · ${path}`, text, sourceKind: 'public-repository-document', sourceUrl, provenance: `Published GitHub document at commit ${commit}`, revision: commit };
}));

for (const [scope, base, items] of [['personal', 'http://127.0.0.1:6333', personal], ['work', 'http://127.0.0.1:6335', work]]) {
  const catalog = await call(base, '/collections');
  if (!catalog.collections.some(item => item.name === collection)) await call(base, `/collections/${collection}`, 'PUT', { vectors: {} });
  const points = items.map(item => {
    const contentHash = createHash('sha256').update(item.text).digest('hex');
    return { id: pointId(scope, item.sourceId), vector: {}, payload: { ...item, scope, contentHash, seedNamespace, updatedAt: new Date().toISOString() } };
  });
  // Stable IDs update only these explicit seed records, preserving any unrelated points.
  await call(base, `/collections/${collection}/points?wait=true`, 'PUT', { points });
  const found = await call(base, `/collections/${collection}/points/scroll`, 'POST', { limit: 100, with_payload: true, with_vector: false });
  if (found.points.some(point => point.payload?.scope !== scope)) throw new Error(`Unexpected cross-scope source found in ${scope}.`);
  const info = await call(base, `/collections/${collection}`);
  console.log(JSON.stringify({ scope, endpoint: base, collection, points: info.points_count, sourceKinds: [...new Set(found.points.map(point => point.payload.sourceKind))], vectors: info.config.params.vectors, publicWorkCommit: scope === 'work' ? commit : undefined }));
}
