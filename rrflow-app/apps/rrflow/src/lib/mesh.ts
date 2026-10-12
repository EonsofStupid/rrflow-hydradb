import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  meshBrainIds, recallInputSchema,
  type BrainPulse, type FeedbackInput, type LearningItem, type MeshBrainId, type MeshSnapshot, type RecallInput, type RecallResult,
  type ContextSource, type ServiceReceipt, type VerifyResult,
} from './mesh-contracts';
import { isRaindropEnabled, raindropProject, trackEvent, trackSignal } from './raindrop';

/** The person using this local workspace; replace once account access exists. */
const OPERATOR_ID = 'jesse';

const HYDRADB_URL = 'https://api.hydradb.com';

/** Carries the HydraDB request ID so the UI can show the request behind a failure. */
export class MeshRequestError extends Error {
  constructor(message: string, readonly requestId: string | null) {
    super(message);
  }
}

/** A failed action still returns the receipts of every call it made, so the failure is inspectable. */
export class MeshRequestReceiptsError extends MeshRequestError {
  constructor(cause: unknown, readonly receipts: ServiceReceipt[]) {
    super(cause instanceof Error ? cause.message : 'The search could not be completed.', cause instanceof MeshRequestError ? cause.requestId : null);
  }
}

type HydraResponse = { body: unknown; requestId: string | null; latencyMs: number };

/** Where a call's receipt goes, and how to describe the call to a person. */
type ReceiptTarget = { action: string; database: string | null; sink: ServiceReceipt[] };

/**
 * Native HydraDB application API call; the key stays on the server.
 * Every call, successful or not, leaves a receipt built from the real response.
 */
const hydra = async (path: string, init: { method?: 'GET' | 'POST'; json?: unknown; receipt: ReceiptTarget }): Promise<HydraResponse> => {
  const method = init.method ?? 'GET';
  const endpoint = path.split('?')[0];
  const at = new Date().toISOString();
  const started = performance.now();
  const record = (fields: Pick<ServiceReceipt, 'httpStatus' | 'outcome' | 'requestId' | 'latencyMs'> & { error?: string }) =>
    init.receipt.sink.push({ service: 'HydraDB', action: init.receipt.action, method, endpoint, database: init.receipt.database, at, ...fields });

  const key = process.env.HYDRA_DB_API_KEY;
  if (!key) {
    const message = 'HydraDB credential is unavailable. Start this workspace through Infisical.';
    record({ httpStatus: null, outcome: 'failed', requestId: null, latencyMs: null, error: message });
    throw new MeshRequestError(message, null);
  }
  let response: Response;
  try {
    response = await fetch(`${HYDRADB_URL}${path}`, {
      method,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${key}`,
        'API-Version': '2',
        ...(init.json === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
    });
  } catch {
    const message = 'HydraDB could not be reached.';
    record({ httpStatus: null, outcome: 'failed', requestId: null, latencyMs: Math.round(performance.now() - started), error: message });
    throw new MeshRequestError(message, null);
  }
  const latencyMs = Math.round(performance.now() - started);
  const body: unknown = await response.json().catch(() => null);
  const requestId = response.headers.get('x-request-id')
    ?? z.object({ meta: z.object({ request_id: z.string() }) }).safeParse(body).data?.meta.request_id
    ?? null;
  const isRejected = !response.ok || z.object({ success: z.literal(false) }).safeParse(body).success;
  const error = !response.ok ? `HydraDB answered ${response.status}.` : isRejected ? 'HydraDB could not complete this request.' : undefined;
  record({ httpStatus: response.status, outcome: isRejected ? 'failed' : 'ok', requestId, latencyMs, ...(error ? { error } : {}) });
  if (error) throw new MeshRequestError(error, requestId);
  return { body, requestId, latencyMs };
};

/** Core responses use a `data` envelope; a few administrative ones do not. */
const unwrap = (body: unknown): unknown =>
  body && typeof body === 'object' && 'data' in body && (body as { data: unknown }).data != null
    ? (body as { data: unknown }).data
    : body;

const statusSchema = z.object({ infra: z.object({ ready_for_ingestion: z.boolean() }) });
const statsSchema = z.object({
  knowledge_collection: z.object({ row_count: z.number() }).optional(),
  memory_collection: z.object({ row_count: z.number() }).optional(),
});

const getPulse = async (id: MeshBrainId, sink: ServiceReceipt[]): Promise<BrainPulse> => {
  try {
    const database = encodeURIComponent(id);
    const [statusResult, statsResult] = await Promise.allSettled([
      hydra(`/databases/status?database=${database}`, { receipt: { action: `Checked ${id} readiness`, database: id, sink } }),
      hydra(`/databases/stats?database=${database}`, { receipt: { action: `Counted ${id} memories and knowledge`, database: id, sink } }),
    ]);
    if (statusResult.status === 'rejected') throw statusResult.reason;
    const status = statusResult.value;
    const infra = statusSchema.safeParse(unwrap(status.body));
    if (!infra.success) throw new MeshRequestError('HydraDB readiness response could not be read.', status.requestId);
    const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
    const counts = stats ? statsSchema.safeParse(unwrap(stats.body)) : null;
    const statsError = statsResult.status === 'rejected'
      ? 'Statistics are temporarily unavailable.'
      : !counts?.success ? 'HydraDB statistics response could not be read.' : undefined;
    return {
      id,
      state: infra.data.infra.ready_for_ingestion ? 'ready' : 'warming_up',
      memories: counts?.data?.memory_collection?.row_count ?? null,
      knowledge: counts?.data?.knowledge_collection?.row_count ?? null,
      latencyMs: Math.max(status.latencyMs, stats?.latencyMs ?? 0),
      requestId: status.requestId,
      statsRequestId: stats?.requestId ?? (statsResult.status === 'rejected' && statsResult.reason instanceof MeshRequestError ? statsResult.reason.requestId : null),
      statsError,
    };
  } catch (error) {
    return {
      id, state: 'unreachable', memories: null, knowledge: null, latencyMs: null,
      requestId: error instanceof MeshRequestError ? error.requestId : null,
      error: error instanceof Error ? error.message : 'This brain could not be reached.',
    };
  }
};

const memorySchema = z.object({
  memory_id: z.string(),
  title: z.string().nullish(),
  timestamp: z.string().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  additional_metadata: z.record(z.string(), z.unknown()).nullish(),
});
const asText = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** The newest lessons in the practices brain: what RRFLOW has learned while being built. */
const getLearning = async (sink: ServiceReceipt[]): Promise<{ items: LearningItem[]; requestId: string | null }> => {
  const { body, requestId } = await hydra('/context/list', {
    method: 'POST',
    json: { database: 'seniordev', type: 'memory', page: 1, page_size: 50 },
    receipt: { action: 'Listed recorded lessons', database: 'seniordev', sink },
  });
  const parsed = z.object({ user_memories: z.array(memorySchema) }).safeParse(unwrap(body));
  if (!parsed.success) throw new MeshRequestError('HydraDB memory response could not be read.', requestId);
  const items = parsed.data.user_memories
    .map(item => ({
      id: item.memory_id,
      brain: 'seniordev' as const,
      title: item.title || item.memory_id,
      kind: asText(item.metadata?.kind) ?? 'memory',
      tool: asText(item.metadata?.tool),
      agent: asText(item.metadata?.agent),
      at: item.timestamp ?? null,
      evidence: asText(item.additional_metadata?.evidence),
    }))
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  return { items, requestId };
};

const databaseListSchema = z.object({ databases: z.array(z.string()) });

const sourceListSchema = z.object({
  total: z.number().nullish(),
  sources: z.array(z.object({
    id: z.string(),
    title: z.string().nullish(),
    timestamp: z.string().nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })),
});

/** The documents the Shippin cluster's company brain holds: its shared context, listed live. */
const getShippinContext = async (sink: ServiceReceipt[]): Promise<MeshSnapshot['shippinContext']> => {
  try {
    const { body, requestId } = await hydra('/context/list', {
      method: 'POST',
      json: { database: 'rrflow_specialist', type: 'knowledge', page: 1, page_size: 50 },
      receipt: { action: 'Listed the Shippin cluster’s shared documents', database: 'rrflow_specialist', sink },
    });
    const parsed = sourceListSchema.safeParse(unwrap(body));
    if (!parsed.success) return { sources: [], total: null, requestId, error: 'HydraDB document listing could not be read.' };
    const sources: ContextSource[] = parsed.data.sources
      .map(source => ({
        id: source.id,
        title: source.title || source.id,
        kind: asText(source.metadata?.kind),
        updatedAt: source.timestamp ?? null,
      }))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    return { sources, total: parsed.data.total ?? sources.length, requestId };
  } catch (error) {
    return {
      sources: [], total: null,
      requestId: error instanceof MeshRequestError ? error.requestId : null,
      error: error instanceof Error ? error.message : 'Documents could not be listed.',
    };
  }
};

/** Databases on this key outside the mesh, shown so nothing the key can reach is hidden. */
const getOtherDatabases = async (sink: ServiceReceipt[]): Promise<string[] | null> => {
  try {
    const listed = await hydra('/databases', { receipt: { action: 'Listed every database this key can see', database: null, sink } });
    const databases = databaseListSchema.safeParse(unwrap(listed.body)).data?.databases;
    return databases ? databases.filter(name => !(meshBrainIds as readonly string[]).includes(name)) : null;
  } catch {
    return null;
  }
};

export const getMeshSnapshot = async (): Promise<MeshSnapshot> => {
  const checkedAt = new Date().toISOString();
  const receipts: ServiceReceipt[] = [];
  const [brains, learning, shippinContext, otherDatabases] = await Promise.all([
    Promise.all(meshBrainIds.map(id => getPulse(id, receipts))),
    getLearning(receipts).then(result => ({ ...result, error: undefined as string | undefined })).catch(error => ({
      items: [] as LearningItem[],
      requestId: error instanceof MeshRequestError ? error.requestId : null,
      error: error instanceof Error ? error.message : 'Lessons could not be loaded.',
    })),
    getShippinContext(receipts),
    getOtherDatabases(receipts),
  ]);
  const connected = brains.some(brain => brain.state !== 'unreachable');
  return {
    connected, checkedAt, brains, learning: learning.items, isMonitored: isRaindropEnabled(),
    raindropProject: raindropProject(), shippinContext, otherDatabases,
    learningError: learning.error, learningRequestId: learning.requestId, receipts,
    ...(connected ? {} : { error: brains[0]?.error ?? 'HydraDB could not be reached.' }),
  };
};

/**
 * "Verify with HydraDB": fresh, uncached calls made at the moment the person asks,
 * so the screen can prove the integration is real rather than assert it.
 */
export const verifyHydra = async (): Promise<VerifyResult> => {
  const receipts: ServiceReceipt[] = [];
  let databases: string[] = [];
  try {
    const listed = await hydra('/databases', { receipt: { action: 'Listed every database this key can see', database: null, sink: receipts } });
    databases = databaseListSchema.safeParse(unwrap(listed.body)).data?.databases ?? [];
  } catch {
    // The failed receipt already explains why; per-brain checks still run so the picture is complete.
  }
  const pulses = await Promise.all(meshBrainIds.map(id => getPulse(id, receipts)));
  const brains = pulses.map(pulse => ({
    id: pulse.id,
    isListed: databases.includes(pulse.id),
    isReady: pulse.state === 'unreachable' ? null : pulse.state === 'ready',
    memories: pulse.memories,
    knowledge: pulse.knowledge,
  }));
  return {
    checkedAt: new Date().toISOString(),
    databases,
    brains,
    isHealthy: brains.every(brain => brain.isListed && brain.isReady === true) && receipts.every(receipt => receipt.outcome === 'ok'),
    receipts,
  };
};

const chunkSchema = z.object({
  source_title: z.string().nullish(),
  title: z.string().nullish(),
  source_id: z.string().nullish(),
  chunk_content: z.string().nullish(),
  content: z.string().nullish(),
  text: z.string().nullish(),
});

/**
 * Ask one brain a question using HydraDB's native hybrid retrieval over knowledge and memories.
 * The person chooses the retrieval depth; telemetry records that choice without
 * silently changing application behavior or pretending it is an evaluated experiment.
 */
export const recall = async (input: RecallInput): Promise<RecallResult> => {
  const { brain, question, mode } = recallInputSchema.parse(input);
  const eventId = randomUUID();
  const receipts: ServiceReceipt[] = [];
  const queryArguments = { database: brain, type: 'all', query_by: 'hybrid', mode };
  let response: HydraResponse;
  try {
    response = await hydra('/query', {
      method: 'POST',
      json: { ...queryArguments, query: question },
      receipt: { action: `Searched ${brain} (${mode === 'thinking' ? 'deep' : 'fast'})`, database: brain, sink: receipts },
    });
  } catch (error) {
    const failureReport = await trackEvent({
      event_id: eventId, user_id: OPERATOR_ID, event: 'brain_recall',
      properties: { brain, recall_mode: mode, kind: 'retrieval', outcome: 'error' },
      ai_data: {
        input: question, output: '',
        tool_calls: [{ name: 'hydradb.query', arguments: queryArguments, status: 'error', error: error instanceof Error ? error.message : 'unknown' }],
      },
    }, 'Reported the failed search to Raindrop');
    if (failureReport.receipt) receipts.push(failureReport.receipt);
    throw new MeshRequestReceiptsError(error, receipts);
  }
  const { body, requestId, latencyMs } = response;
  const parsed = z.object({ chunks: z.array(chunkSchema) }).safeParse(unwrap(body));
  if (!parsed.success) throw new MeshRequestReceiptsError(new MeshRequestError('HydraDB retrieval response could not be read.', requestId), receipts);
  const seen = new Set<string>();
  const hits = parsed.data.chunks
    .map(chunk => ({
      title: chunk.source_title || chunk.title || chunk.source_id || 'Untitled source',
      // Some indexed text keeps escaped newlines; readers should see prose, not "\n".
      excerpt: (chunk.chunk_content || chunk.content || chunk.text || '').replace(/\\[nrt]/g, ' ').replace(/\s+/g, ' ').trim(),
      sourceId: chunk.source_id ?? null,
    }))
    // HydraDB also indexes each source's metadata header as JSON; it is not evidence a reader can use.
    .filter(hit => hit.excerpt && !hit.excerpt.startsWith('{"id":'))
    .filter(hit => {
      const key = `${hit.title}|${hit.excerpt.slice(0, 80)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map(hit => ({ ...hit, excerpt: hit.excerpt.slice(0, 360) }));

  const telemetry = await trackEvent({
    event_id: eventId, user_id: OPERATOR_ID, event: 'brain_recall',
    properties: { brain, recall_mode: mode, kind: 'retrieval', hit_count: hits.length, latency_ms: latencyMs, hydradb_request_id: requestId, outcome: hits.length ? 'evidence_returned' : 'no_matches' },
    ai_data: {
      input: question,
      output: hits.length ? hits.map(hit => `${hit.title}: ${hit.excerpt}`).join('\n\n') : '(nothing found)',
      tool_calls: [{
        name: 'hydradb.query', arguments: queryArguments, status: 'ok',
        result: { hits: hits.length, request_id: requestId, latency_ms: latencyMs, sources: hits.map(hit => hit.title) },
      }],
    },
  }, 'Reported this search to Raindrop');
  if (telemetry.receipt) receipts.push(telemetry.receipt);
  return {
    eventId, brain, question, mode, hits, requestId, latencyMs, receipts,
    telemetry: { status: telemetry.status, ...(telemetry.error ? { error: telemetry.error } : {}) },
  };
};

/** The person's verdict on an answer: the ground truth Raindrop issues and experiments are measured against. */
export const recordFeedback = async ({ eventId, isHelpful }: FeedbackInput): Promise<{ isRecorded: boolean; error?: string; receipts: ServiceReceipt[] }> => {
  if (!isRaindropEnabled()) return { isRecorded: false, receipts: [] };
  const delivery = await trackSignal({
    event_id: eventId,
    signal_name: isHelpful ? 'answer_helpful' : 'answer_not_helpful',
    sentiment: isHelpful ? 'POSITIVE' : 'NEGATIVE',
    signal_type: 'feedback',
  }, `Sent your "${isHelpful ? 'helpful' : 'not helpful'}" verdict to Raindrop`);
  return { isRecorded: delivery.status === 'accepted', error: delivery.error, receipts: delivery.receipt ? [delivery.receipt] : [] };
};
