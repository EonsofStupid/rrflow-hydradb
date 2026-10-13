import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { listCollections, listItems } from './explore';
import { decisionSchema, suggestOrganization, type OrganizationItem, type OrganizationSnapshot, type organizationInputSchema } from './organization-contracts';
import type { ExploreItem } from './explore-contracts';
import { trackEvent } from './raindrop';

const collection = 'rrflow_organization';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const keyFor = (item: ExploreItem) => digest([item.kind, item.collection, item.id]);
const versionFor = (item: ExploreItem) => digest([item.title, item.timestamp, item.metadata, item.additionalMetadata]);
const projection = 'd.ext_id AS key, d.destination AS destination, d.note AS note, d.updated_at AS updatedAt, d.source_version AS sourceVersion';

export class OrganizationError extends Error { constructor(message: string, readonly status = 503) { super(message); } }
const graph = async (database: string, query: string, params: Record<string, unknown>, requestIds: string[]) => {
  const key = process.env.HYDRA_DB_API_KEY;
  if (!key) throw new OrganizationError('Start the workspace with its Infisical credentials to organize context.');
  const response = await fetch('https://api.hydradb.com/byog/query', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${key}`, 'API-Version': '2', 'Content-Type': 'application/json' }, body: JSON.stringify({ database, collection, query, params }) });
  if (!response.ok) throw new OrganizationError(`HydraDB could not read or save context decisions (HTTP ${response.status}).`);
  const body = z.object({ success: z.literal(true), data: z.unknown(), meta: z.object({ request_id: z.string().optional() }).optional() }).parse(await response.json());
  const id = body.meta?.request_id ?? response.headers.get('x-request-id'); if (id) requestIds.push(id);
  return body.data;
};

export const readOrganization = async (database: OrganizationSnapshot['database']): Promise<OrganizationSnapshot> => {
  const result: OrganizationSnapshot = { database, items: [], checkedAt: new Date().toISOString(), requestIds: [], errors: [], decisionsAvailable: false, sampleLimit: 40 };
  let collections: string[] = [];
  try {
    const catalog = await listCollections(database);
    collections = [...new Set(catalog.collections)].sort().slice(0, 6);
    if (catalog.requestId) result.requestIds.push(catalog.requestId);
    if (catalog.collections.length > 6) result.errors.push('This sample covers the first six named collections plus the default collection. Open the connectome for more sources.');
  } catch { result.errors.push('Named collections could not be discovered. Only the default collection is included in this sample.'); }
  const lists: PromiseSettledResult<Awaited<ReturnType<typeof listItems>>>[] = [];
  // Read explicit collections: omitting collection does not include connected Gmail/GitHub.
  const sourceCollections = [undefined, ...collections];
  for (let index = 0; index < sourceCollections.length; index += 3) {
    lists.push(...await Promise.allSettled(sourceCollections.slice(index, index + 3).flatMap(sourceCollection => (['knowledge', 'memory'] as const).map(kind => listItems(database, { kind, page: 1, pageSize: 20, collection: sourceCollection })))));
  }
  const unique = new Map(lists.flatMap(list => list.status === 'fulfilled' ? list.value.items.map(source => [keyFor(source), source] as const) : []));
  const sample = [...unique.values()].sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? '')).slice(0, result.sampleLimit);
  const keys = sample.map(keyFor);
  const saved = await Promise.allSettled([graph(database, `MATCH (d:ContextDecision) WHERE d.ext_id IN $keys RETURN ${projection}`, { keys }, result.requestIds).then(data => z.array(decisionSchema).parse(data))]);
  const decisions = new Map(saved[0].status === 'fulfilled' ? saved[0].value.map(item => [item.key, item]) : []);
  result.decisionsAvailable = saved[0].status === 'fulfilled';
  if (!result.decisionsAvailable) result.errors.push('Saved decisions could not be loaded. Suggestions are visible, but confirmation is disabled until a successful refresh.');
  for (const list of lists) {
    if (list.status === 'rejected') { result.errors.push('Some source records could not be read. The visible counts cover only the available sample.'); continue; }
    if (list.value.requestId) result.requestIds.push(list.value.requestId);
  }
  for (const source of sample) {
      const key = keyFor(source), sourceVersion = versionFor(source), decision = decisions.get(key) ?? null;
      const suggestion = suggestOrganization(source, database);
      const changedSinceReview = !!decision && decision.sourceVersion !== sourceVersion;
      const provider = /gmail|email/i.test(`${source.collection} ${source.type}`) ? 'Gmail' : /github/i.test(`${source.collection} ${source.type}`) ? 'GitHub' : source.kind === 'memory' ? 'Memory' : 'Source';
      result.items.push({ key, source, sourceVersion, provider, suggested: suggestion.destination, destination: decision && !changedSinceReview ? decision.destination : changedSinceReview ? 'review' : suggestion.destination, reason: changedSinceReview ? 'The source metadata changed after your decision. Review it again before using that placement.' : decision ? 'Your saved decision takes precedence over the routing suggestion.' : suggestion.reason, matchedProject: suggestion.matchedProject, decision, changedSinceReview });
  }
  result.items.sort((a, b) => (b.source.timestamp ?? '').localeCompare(a.source.timestamp ?? '') || a.key.localeCompare(b.key));
  return result;
};

export const saveOrganization = async (input: z.infer<typeof organizationInputSchema>, verification = false) => {
  const snapshot = await readOrganization(input.database);
  if (!snapshot.decisionsAvailable) throw new OrganizationError('Saved decisions could not be verified. Refresh before saving.');
  const item: OrganizationItem | undefined = snapshot.items.find(item => item.key === input.key);
  if (!item || item.sourceVersion !== input.sourceVersion) throw new OrganizationError('This source changed or left the current sample. Refresh the inbox before reviewing it.', 409);
  if ((item.decision?.updatedAt ?? null) !== input.expectedUpdatedAt) throw new OrganizationError('Another review changed this placement. Refresh to see the saved decision.', 409);
  const updatedAt = new Date().toISOString();
  const fields = 'd.destination = $destination, d.note = $note, d.updated_at = $updatedAt, d.source_version = $sourceVersion, d.source_id = $sourceId, d.source_kind = $sourceKind, d.source_collection = $sourceCollection';
  const mutation = input.expectedUpdatedAt === null
    ? `MERGE (d:ContextDecision {ext_id: $key}) ON CREATE SET ${fields} WITH d WHERE d.updated_at = $updatedAt RETURN ${projection}`
    : `MATCH (d:ContextDecision {ext_id: $key}) WHERE d.updated_at = $expected SET ${fields} RETURN ${projection}`;
  const rows = z.array(decisionSchema).parse(await graph(input.database, mutation, { key: input.key, expected: input.expectedUpdatedAt, destination: input.destination, note: input.note, updatedAt, sourceVersion: input.sourceVersion, sourceId: item.source.id, sourceKind: item.source.kind, sourceCollection: item.source.collection ?? '' }, snapshot.requestIds));
  if (!rows.length) throw new OrganizationError('Another review changed this placement. Refresh to see the saved decision.', 409);
  // Only aggregate routing metadata leaves HydraDB; no source title, ID, body, or reviewer note.
  const telemetry = await trackEvent({ event_id: `organization-${digest([input.database, input.key, updatedAt])}`, user_id: verification ? 'rrflow-playwright' : 'jesse', event: 'context_alignment_review', properties: { kind: 'human_context_alignment', suggested: item.suggested, chosen: input.destination, corrected: item.suggested !== input.destination, source_type: item.source.kind, verification_run: verification } }, 'Record context-alignment review');
  return { decision: rows[0], requestIds: snapshot.requestIds, telemetry: { status: telemetry.status, error: telemetry.error }, message: 'Your placement is saved in HydraDB. The original source stays in its database.' };
};
