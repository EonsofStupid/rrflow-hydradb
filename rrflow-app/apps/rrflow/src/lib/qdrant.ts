import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { qdrantDestinations, qdrantHydraCollection, qdrantSourceCollection, type QdrantImportInput, type QdrantImportResult, type QdrantReceipt, type QdrantScope, type QdrantSnapshot, type QdrantSource, type QdrantSourcePoint } from './qdrant-contracts';
import type { ServiceReceipt } from './mesh-contracts';

const endpoints = { personal: 'http://127.0.0.1:6333', work: 'http://127.0.0.1:6335' } as const;
const registryCollection = 'rrflow_qdrant';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const sourceId = (scope: QdrantScope, id: string | number) => `qdrant:${scope}:${qdrantSourceCollection}:${id}`;
const sourcePayloadSchema = z.object({ title: z.string().min(1).max(500), text: z.string().min(1).max(60_000), scope: z.enum(['personal', 'work']), sourceKind: z.string().max(200), provenance: z.string().max(3000), sourceUrl: z.string().nullable().optional(), updatedAt: z.string().optional() });
const pointSchema = z.object({ id: z.union([z.string().uuid(), z.number().int().nonnegative()]), payload: z.unknown() });
const envelope = z.object({ success: z.literal(true), data: z.unknown(), meta: z.object({ request_id: z.string().optional() }).optional() });
export class QdrantSourceError extends Error { constructor(message: string, readonly status = 503) { super(message); } }

const qdrant = async <T>(scope: QdrantScope, path: string, schema: z.ZodType<T>, receipts: QdrantReceipt[], body?: unknown): Promise<T> => {
  const started = Date.now();
  const receipt: QdrantReceipt = { scope, endpoint: path, method: body ? 'POST' : 'GET', httpStatus: null, latencyMs: 0, ok: false };
  try {
    const key = process.env[scope === 'personal' ? 'QDRANT_PERSONAL_API_KEY' : 'QDRANT_WORK_API_KEY'];
    const response = await fetch(`${endpoints[scope]}${path}`, { method: receipt.method, headers: { 'Content-Type': 'application/json', ...(key ? { 'api-key': key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(5000) });
    receipt.httpStatus = response.status;
    if (!response.ok) throw new QdrantSourceError(`The ${scope === 'personal' ? 'Personal' : 'Work'} source returned HTTP ${response.status}. Check its local Qdrant service.`);
    const payload = z.object({ status: z.literal('ok'), result: z.unknown() }).parse(await response.json());
    const result = schema.parse(payload.result); receipt.ok = true; return result;
  } catch (error) { throw error instanceof QdrantSourceError ? error : new QdrantSourceError(`The ${scope === 'personal' ? 'personal' : 'work'} Qdrant source is unavailable or returned an unexpected response. Start its local service and refresh.`); }
  finally { receipt.latencyMs = Date.now() - started; receipts.push(receipt); }
};

const hydra = async <T>(scope: QdrantScope, path: string, schema: z.ZodType<T>, receipts: ServiceReceipt[], body?: FormData | Record<string, unknown>, action = 'Read Qdrant source import evidence'): Promise<T> => {
  const key = process.env.HYDRA_DB_API_KEY;
  if (!key) throw new QdrantSourceError('HydraDB credentials are unavailable. Start RRFLOW through Infisical.');
  const started = Date.now();
  const receipt: ServiceReceipt = { service: 'HydraDB', action, method: body ? 'POST' : 'GET', endpoint: path.split('?')[0], database: qdrantDestinations[scope], httpStatus: null, outcome: 'failed', requestId: null, latencyMs: null, at: new Date().toISOString() };
  try {
    const response = await fetch(`https://api.hydradb.com${path}`, { method: receipt.method, headers: { Authorization: `Bearer ${key}`, 'API-Version': '2', ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    receipt.httpStatus = response.status; receipt.requestId = response.headers.get('x-request-id');
    if (!response.ok) throw new QdrantSourceError(`HydraDB could not complete the source operation (HTTP ${response.status}). Refresh before retrying.`);
    const result = envelope.parse(await response.json()); receipt.requestId = result.meta?.request_id ?? receipt.requestId;
    const data = schema.parse(result.data); receipt.outcome = 'ok'; return data;
  } catch (error) { const safe = error instanceof QdrantSourceError ? error : new QdrantSourceError('HydraDB did not confirm the source operation. Refresh to inspect its status before retrying.'); receipt.error = safe.message; throw safe; }
  finally { receipt.latencyMs = Date.now() - started; receipts.push(receipt); }
};

const pointFrom = (scope: QdrantScope, point: z.infer<typeof pointSchema>): QdrantSourcePoint | null => {
  const parsed = sourcePayloadSchema.safeParse(point.payload);
  if (!parsed.success || parsed.data.scope !== scope) return null;
  const payload = parsed.data;
  let url: string | null = null;
  if (payload.sourceUrl) { try { const source = new URL(payload.sourceUrl); if (source.protocol === 'https:' && !source.username && !source.password) url = source.href; } catch { /* Keep invalid source links inert. */ } }
  return { id: point.id, title: payload.title, text: payload.text, sourceKind: payload.sourceKind, provenance: payload.provenance, sourceUrl: url, updatedAt: payload.updatedAt ?? null,
    version: hash(JSON.stringify([payload.title, payload.text, payload.provenance, payload.sourceKind, url])), hydraId: sourceId(scope, point.id), importedAt: null, importedVersion: null, indexingStatus: null };
};

const importRows = z.array(z.object({ id: z.string(), version: z.string(), importedAt: z.string() }));
const loadEvidence = async (scope: QdrantScope, points: QdrantSourcePoint[], receipts: ServiceReceipt[], warnings: string[]) => {
  if (!points.length) return;
  const ids = points.map(point => point.hydraId);
  const params = new URLSearchParams({ database: qdrantDestinations[scope], collection: qdrantHydraCollection }); ids.forEach(id => params.append('ids', id));
  const [saved, status] = await Promise.allSettled([
    hydra(scope, '/byog/query', importRows, receipts, { database: qdrantDestinations[scope], collection: registryCollection, query: 'MATCH (s:QdrantSourceImport) WHERE s.ext_id IN $ids RETURN s.ext_id AS id, s.version AS version, s.imported_at AS importedAt', params: { ids } }),
    hydra(scope, `/context/status?${params}`, z.object({ statuses: z.array(z.object({ id: z.string(), indexing_status: z.string().nullable().optional(), found: z.boolean().optional(), error_code: z.string().nullable().optional() })) }), receipts),
  ]);
  if (saved.status === 'rejected') warnings.push('Import timestamps could not be read from HydraDB.');
  if (status.status === 'rejected') warnings.push('HydraDB indexing status could not be read.');
  for (const point of points) {
    const record = saved.status === 'fulfilled' ? saved.value.find(item => item.id === point.hydraId) : null;
    if (record) { point.importedAt = record.importedAt; point.importedVersion = record.version; }
    const evidence = status.status === 'fulfilled' ? status.value.statuses.find(item => item.id === point.hydraId) : null;
    point.indexingStatus = evidence?.found === false || evidence?.error_code === 'FILE_NOT_FOUND' ? null : evidence?.indexing_status ?? null;
  }
};

export const readQdrantSources = async (scope?: QdrantScope, includeEvidence = true): Promise<QdrantSnapshot> => {
  const receipts: ServiceReceipt[] = [], qdrantReceipts: QdrantReceipt[] = [];
  const sources = await Promise.all((scope ? [scope] : ['personal', 'work'] as const).map(async current => {
    const result: QdrantSource = { scope: current, endpoint: endpoints[current], database: qdrantDestinations[current], collection: qdrantSourceCollection, connected: false, total: null, collections: [], points: [], hasMore: false, warnings: [], checkedAt: new Date().toISOString(), evidencePending: !includeEvidence };
    try {
      const catalog = await qdrant(current, '/collections', z.object({ collections: z.array(z.object({ name: z.string() })) }), qdrantReceipts);
      result.collections = catalog.collections.map(item => item.name); result.connected = true;
      if (!result.collections.includes(qdrantSourceCollection)) { result.warnings.push('This source has not been seeded yet. Run the documented Qdrant seed script.'); return result; }
      const [info, page] = await Promise.all([
        qdrant(current, `/collections/${qdrantSourceCollection}`, z.object({ points_count: z.number().optional() }), qdrantReceipts),
        qdrant(current, `/collections/${qdrantSourceCollection}/points/scroll`, z.object({ points: z.array(pointSchema), next_page_offset: z.union([z.string(), z.number()]).nullable().optional() }), qdrantReceipts, { limit: 50, with_payload: true, with_vector: false }),
      ]);
      result.total = info.points_count ?? null; result.hasMore = page.next_page_offset !== null && page.next_page_offset !== undefined;
      result.points = page.points.map(point => pointFrom(current, point)).filter((point): point is QdrantSourcePoint => point !== null);
      if (result.points.length !== page.points.length) result.warnings.push('Some records were omitted because they have a different scope or an unsupported payload.');
      if (result.hasMore) result.warnings.push('This view shows the first 50 source records. Bulk import is limited to the visible selection.');
      if (includeEvidence) await loadEvidence(current, result.points, receipts, result.warnings);
    } catch (error) { result.error = error instanceof Error ? error.message : 'This Qdrant source could not load.'; }
    result.checkedAt = new Date().toISOString(); return result;
  }));
  return { sources, receipts, qdrantReceipts, checkedAt: new Date().toISOString() };
};

export const importQdrantSources = async (input: QdrantImportInput, receipts: ServiceReceipt[], qdrantReceipts: QdrantReceipt[]): Promise<QdrantImportResult> => {
  const found = await qdrant(input.scope, `/collections/${qdrantSourceCollection}/points`, z.array(pointSchema), qdrantReceipts, { ids: input.points.map(point => point.id), with_payload: true, with_vector: false });
  const points = found.map(point => pointFrom(input.scope, point)).filter((point): point is QdrantSourcePoint => point !== null);
  if (points.length !== input.points.length || input.points.some(item => !points.some(point => point.id === item.id && point.version === item.version))) throw new QdrantSourceError('A selected source changed, disappeared, or belongs to a different scope. Refresh and review the sources again.', 409);
  const form = new FormData();
  form.set('database', qdrantDestinations[input.scope]); form.set('collection', qdrantHydraCollection); form.set('type', 'knowledge'); form.set('upsert', 'true');
  form.set('app_knowledge', JSON.stringify(points.map(point => ({ id: point.hydraId, title: point.title, type: 'qdrant_source', ...(point.sourceUrl ? { url: point.sourceUrl } : {}), timestamp: point.updatedAt ?? new Date().toISOString(), content: { text: point.text }, additional_metadata: { source_system: 'qdrant', qdrant_scope: input.scope, qdrant_collection: qdrantSourceCollection, qdrant_point_id: String(point.id), source_kind: point.sourceKind, provenance: point.provenance, source_version: point.version, workspace: input.scope === 'personal' ? 'personal' : 'shippin' } }))));
  const accepted = await hydra(input.scope, '/context/ingest', z.object({ results: z.array(z.object({ id: z.string(), status: z.string(), error: z.string().nullable().optional() })), failed_count: z.number().optional() }), receipts, form, 'Import selected Qdrant sources into their HydraDB workspace');
  if ((accepted.failed_count ?? 0) > 0 || points.some(point => !accepted.results.some(item => item.id === point.hydraId && !item.error && ['queued', 'accepted', 'processing', 'completed', 'success', 'already_exists'].includes(item.status)))) throw new QdrantSourceError('HydraDB did not accept every selected source. Some may already be queued; refresh the status before retrying.');
  const importedAt = new Date().toISOString();
  const saved = await hydra(input.scope, '/byog/query', z.array(z.object({ count: z.number() })), receipts, {
    database: qdrantDestinations[input.scope], collection: registryCollection,
    query: 'UNWIND $sources AS row MERGE (s:QdrantSourceImport {ext_id: row.id}) SET s.version = row.version, s.imported_at = $at RETURN count(s) AS count',
    params: { at: importedAt, sources: points.map(point => ({ id: point.hydraId, version: point.version })) },
  }, 'Record accepted Qdrant source versions and import time');
  if (saved.length !== 1 || saved[0].count !== points.length) throw new QdrantSourceError('HydraDB accepted the source content, but did not confirm every import-version record. Refresh to inspect indexing before retrying.');
  return { accepted: points.length, database: qdrantDestinations[input.scope], collection: qdrantHydraCollection, ids: points.map(point => point.hydraId), importedAt, receipts, qdrantReceipts, message: `${points.length} sources accepted by HydraDB. Indexing runs next; refresh to see their status.` };
};
