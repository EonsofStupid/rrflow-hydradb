import 'server-only';
import { z } from 'zod';
import {
  type ExploreDatabase,
  type ExploreDatabasesResponse,
  type ExploreEntity,
  type ExploreItem,
  type ExploreItemDetail,
  type ExploreListResponse,
  type ExploreRelation,
  type GraphEdge,
  type LabChunk,
  type LabQueryInput,
  type LabQueryResponse,
  type ListItemsInput,
  itemDetailInputSchema,
} from './explore-contracts';

const HYDRADB_URL = 'https://api.hydradb.com';

/** Carries the HydraDB request id so the UI can show the request behind a failure. */
export class ExploreRequestError extends Error {
  constructor(
    message: string,
    readonly requestId: string | null,
    readonly status = 502,
  ) {
    super(message);
  }
}

type HydraResponse = { body: unknown; requestId: string | null; latencyMs: number };

/**
 * Native HydraDB application API call; the key stays on the server. Mirrors
 * the helper in `mesh.ts`, which is private to that module. Worth merging
 * into one shared transport once both owners agree on its home.
 */
const hydra = async (
  path: string,
  init?: { method?: string; json?: unknown; timeoutMs?: number },
): Promise<HydraResponse> => {
  const key = process.env.HYDRA_DB_API_KEY;
  if (!key) {
    throw new ExploreRequestError(
      'HydraDB credential is unavailable. Start this workspace through Infisical.',
      null,
      503,
    );
  }
  const started = performance.now();
  const response = await fetch(`${HYDRADB_URL}${path}`, {
    method: init?.method ?? 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(init?.timeoutMs ?? 20_000),
    headers: {
      Authorization: `Bearer ${key}`,
      'API-Version': '2',
      ...(init?.json === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: init?.json === undefined ? undefined : JSON.stringify(init.json),
  });
  const latencyMs = Math.round(performance.now() - started);
  const body: unknown = await response.json().catch(() => null);
  const requestId =
    response.headers.get('x-request-id') ??
    z.object({ meta: z.object({ request_id: z.string() }) }).safeParse(body).data?.meta
      .request_id ??
    null;
  if (!response.ok || z.object({ success: z.literal(false) }).safeParse(body).success) {
    const detail = z
      .object({ error: z.object({ code: z.string().optional(), message: z.string().optional() }) })
      .safeParse(body).data?.error;
    const suffix = detail?.code ? ` (${detail.code}${detail.message ? `: ${detail.message}` : ''})` : '';
    throw new ExploreRequestError(`HydraDB answered ${response.status}${suffix}.`, requestId);
  }
  return { body, requestId, latencyMs };
};

/** Core responses use a `data` envelope; a few administrative ones do not. */
const unwrap = (body: unknown): unknown =>
  body && typeof body === 'object' && 'data' in body && (body as { data: unknown }).data != null
    ? (body as { data: unknown }).data
    : body;

const record = z.record(z.string(), z.unknown());

// ---- Databases ---------------------------------------------------------------

const databasesSchema = z.object({
  databases: z.array(z.string()).optional(),
  tenant_ids: z.array(z.string()).optional(),
  failed_databases: z.array(z.object({ database: z.string().optional(), error: z.string().optional() })).optional(),
});
const statusSchema = z.object({ infra: z.object({ ready_for_ingestion: z.boolean() }) });
const statsSchema = z.object({
  knowledge_collection: z.object({ row_count: z.number() }).optional(),
  memory_collection: z.object({ row_count: z.number() }).optional(),
});
const collectionsSchema = z.object({
  collections: z.array(z.string()).optional(),
  sub_tenant_ids: z.array(z.string()).optional(),
});

const describeDatabase = async (name: string): Promise<ExploreDatabase> => {
  const database = encodeURIComponent(name);
  try {
    const [status, stats, collections] = await Promise.all([
      hydra(`/databases/status?database=${database}`),
      hydra(`/databases/stats?database=${database}`),
      hydra(`/databases/collections?database=${database}`),
    ]);
    const infra = statusSchema.safeParse(unwrap(status.body)).data;
    const counts = statsSchema.safeParse(unwrap(stats.body)).data;
    const names = collectionsSchema.safeParse(unwrap(collections.body)).data;
    return {
      name,
      ready: infra ? infra.infra.ready_for_ingestion : null,
      knowledgeRows: counts?.knowledge_collection?.row_count ?? null,
      memoryRows: counts?.memory_collection?.row_count ?? null,
      collections: names?.collections ?? names?.sub_tenant_ids ?? [],
      requestId: status.requestId,
      error: null,
    };
  } catch (error) {
    return {
      name,
      ready: null,
      knowledgeRows: null,
      memoryRows: null,
      collections: [],
      requestId: error instanceof ExploreRequestError ? error.requestId : null,
      error: error instanceof Error ? error.message : 'This brain could not be described.',
    };
  }
};

export const listDatabases = async (): Promise<ExploreDatabasesResponse> => {
  const { body } = await hydra('/databases');
  const parsed = databasesSchema.safeParse(unwrap(body)).data;
  const names = parsed?.databases ?? parsed?.tenant_ids ?? [];
  const databases = await Promise.all(names.map(describeDatabase));
  for (const failed of parsed?.failed_databases ?? []) {
    if (!failed.database) continue;
    databases.push({
      name: failed.database,
      ready: false,
      knowledgeRows: null,
      memoryRows: null,
      collections: [],
      requestId: null,
      error: failed.error ?? 'HydraDB reported this database as failed.',
    });
  }
  return { databases, checkedAt: new Date().toISOString() };
};

// ---- Items -------------------------------------------------------------------

export const listCollections = async (database: string): Promise<{ collections: string[]; requestId: string | null }> => {
  const response = await hydra(`/databases/collections?database=${encodeURIComponent(database)}`);
  const data = collectionsSchema.parse(unwrap(response.body));
  return { collections: data.collections ?? data.sub_tenant_ids ?? [], requestId: response.requestId };
};

const listedItemSchema = z.object({
  id: z.string().optional(),
  memory_id: z.string().optional(),
  title: z.string().nullish(),
  type: z.string().nullish(),
  collection: z.string().nullish(),
  timestamp: z.string().nullish(),
  description: z.string().nullish(),
  note: z.string().nullish(),
  metadata: record.nullish(),
  additional_metadata: record.nullish(),
});
const listSchema = z.object({
  sources: z.array(z.unknown()).optional(),
  user_memories: z.array(z.unknown()).optional(),
  total: z.number().optional(),
});

export const listItems = async (
  database: string,
  input: ListItemsInput,
): Promise<ExploreListResponse> => {
  const { body, requestId } = await hydra('/context/list', {
    method: 'POST',
    json: {
      database,
      ...(input.collection ? { collection: input.collection } : {}),
      type: input.kind,
      page: input.page,
      page_size: input.pageSize,
    },
  });
  const data = listSchema.safeParse(unwrap(body)).data;
  if (!data || !Array.isArray(input.kind === 'memory' ? data.user_memories : data.sources)) throw new ExploreRequestError('HydraDB returned an unexpected context list.', requestId);
  const raw = (input.kind === 'memory' ? data?.user_memories : data?.sources) ?? [];
  const items: ExploreItem[] = [];
  for (const entry of raw) {
    const item = listedItemSchema.safeParse(entry).data;
    const id = item?.memory_id ?? item?.id;
    if (!item || !id) continue;
    items.push({
      id,
      kind: input.kind,
      title: item.title || item.description?.slice(0, 80) || id,
      type: item.type ?? null,
      collection: item.collection ?? input.collection ?? null,
      timestamp: item.timestamp ?? null,
      description: item.description ?? item.note ?? null,
      metadata: item.metadata ?? {},
      additionalMetadata: item.additional_metadata ?? {},
    });
  }
  return {
    database,
    collection: input.collection ?? null,
    kind: input.kind,
    page: input.page,
    pageSize: input.pageSize,
    total: data?.total ?? null,
    items,
    requestId,
  };
};

// ---- One item: content, relations, subgraph ----------------------------------

const entitySchema = z.object({
  entity_id: z.string().nullish(),
  identifier: z.string().nullish(),
  name: z.string().nullish(),
  type: z.string().nullish(),
});
const evidenceSchema = z.object({
  canonical_predicate: z.string().nullish(),
  raw_predicate: z.string().nullish(),
  confidence: z.number().nullish(),
  context: z.string().nullish(),
  chunk_id: z.string().nullish(),
  synthesized: z.boolean().nullish(),
});
const tripletSchema = z.object({
  chunk_id: z.string().nullish(),
  source: entitySchema.nullish(),
  target: entitySchema.nullish(),
  relations: z.array(evidenceSchema).nullish(),
});
const relationsSchema = z.object({
  relations: z.array(z.unknown()).optional(),
  is_truncated: z.boolean().optional(),
});
const subgraphSchema = z.object({
  relations: z.array(z.unknown()).optional(),
  max_depth_reached: z.number().nullish(),
  sources: z
    .array(
      z.object({
        source_id: z.string().nullish(),
        title: z.string().nullish(),
        depth: z.number().nullish(),
        discovered_via: z.string().nullish(),
        discovered_relation: z.string().nullish(),
      }),
    )
    .optional(),
});
const inspectSchema = z.object({
  content: z.string().nullish(),
  inferred_content: z.string().nullish(),
  content_type: z.string().nullish(),
});

const toEntity = (node: z.infer<typeof entitySchema> | null | undefined): ExploreEntity => ({
  id: node?.entity_id ?? node?.identifier ?? node?.name ?? '?',
  name: node?.name ?? node?.identifier ?? node?.entity_id ?? '?',
  type: node?.type ?? null,
});

const flattenRelations = (raw: unknown[]): ExploreRelation[] => {
  const out: ExploreRelation[] = [];
  for (const entry of raw) {
    const triplet = tripletSchema.safeParse(entry).data;
    if (!triplet) continue;
    const source = toEntity(triplet.source);
    const target = toEntity(triplet.target);
    const evidences = triplet.relations?.length ? triplet.relations : [undefined];
    for (const evidence of evidences) {
      out.push({
        source,
        target,
        predicate: evidence?.canonical_predicate ?? evidence?.raw_predicate ?? 'related_to',
        confidence: evidence?.confidence ?? null,
        context: evidence?.context ?? null,
        chunkId: evidence?.chunk_id ?? triplet.chunk_id ?? null,
        synthesized: evidence?.synthesized ?? false,
      });
    }
  }
  return out.slice(0, 400);
};

export const getItem = async (
  database: string,
  id: string,
  input: z.infer<typeof itemDetailInputSchema>,
): Promise<ExploreItemDetail> => {
  const scope = `database=${encodeURIComponent(database)}&id=${encodeURIComponent(id)}${
    input.collection ? `&collection=${encodeURIComponent(input.collection)}` : ''
  }`;
  const failures: ExploreItemDetail['failures'] = [];
  const requestIds: string[] = [];
  const attempt = async <T>(
    call: 'inspect' | 'relations' | 'subgraph',
    run: () => Promise<HydraResponse>,
    schema: z.ZodType<T>,
  ): Promise<T | null> => {
    try {
      const response = await run();
      if (response.requestId) requestIds.push(response.requestId);
      const parsed = schema.safeParse(unwrap(response.body));
      if (!parsed.success) {
        failures.push({ call, message: 'HydraDB returned an unexpected shape.' });
        return null;
      }
      return parsed.data;
    } catch (error) {
      failures.push({ call, message: error instanceof Error ? error.message : 'failed' });
      return null;
    }
  };

  const [inspected, relations, subgraph] = await Promise.all([
    input.kind === 'knowledge'
      ? attempt('inspect', () => hydra(`/context/inspect?${scope}&mode=content`), inspectSchema)
      : Promise.resolve(null),
    attempt(
      'relations',
      () => hydra(`/context/relations?${scope}&type=${input.kind}&limit=200`),
      relationsSchema,
    ),
    attempt(
      'subgraph',
      () => hydra(`/context/subgraph?${scope}&type=${input.kind}&depth=2&max_sources=40`),
      subgraphSchema,
    ),
  ]);

  return {
    id,
    database,
    collection: input.collection ?? null,
    kind: input.kind,
    content: inspected?.content ? inspected.content.slice(0, 20_000) : null,
    inferredContent: inspected?.inferred_content ?? null,
    contentType: inspected?.content_type ?? null,
    relations: flattenRelations(relations?.relations ?? []),
    relationsTruncated: relations?.is_truncated ?? false,
    subgraph: {
      sources: (subgraph?.sources ?? []).map((source) => ({
        id: source.source_id ?? '',
        title: source.title || source.source_id || '',
        depth: source.depth ?? null,
        via: source.discovered_via ?? source.discovered_relation ?? null,
      })),
      relations: flattenRelations(subgraph?.relations ?? []),
      maxDepthReached: subgraph?.max_depth_reached ?? null,
    },
    requestIds,
    failures,
  };
};

// ---- Query Lab ---------------------------------------------------------------

const chunkSchema = z.object({
  id: z.string().nullish(),
  chunk_uuid: z.string().nullish(),
  chunk_content: z.string().nullish(),
  source_title: z.string().nullish(),
  source_type: z.string().nullish(),
  relevancy_score: z.number().nullish(),
  metadata: record.nullish(),
  collection: z.string().nullish(),
});
const sourceSchema = z.object({
  id: z.string().nullish(),
  title: z.string().nullish(),
  url: z.string().nullish(),
  type: z.string().nullish(),
});
const pathSchema = z.object({
  relevancy_score: z.number().nullish(),
  triplets: z.array(z.object({ source: record.nullish(), relation: record.nullish(), target: record.nullish() })).nullish(),
});
const querySchema = z.object({
  chunks: z.array(z.unknown()).optional(),
  sources: z.array(z.unknown()).optional(),
  graph_context: z.object({ query_paths: z.array(z.unknown()).optional(), chunk_relations: z.array(z.unknown()).optional() }).nullish(),
  temporal_facts: z.array(z.object({
    subject: z.string().nullish(), relation: z.string().nullish(), object: z.string().nullish(),
    status: z.string().nullish(), evidence_phrase: z.string().nullish(),
    event_start: z.number().nullish(), event_end: z.number().nullish(),
  })).nullish(),
  forceful_relations: z.object({
    declared: z.array(z.object({ chunk: chunkSchema.nullish(), via: z.unknown() })).nullish(),
    inferred: z.array(z.object({ chunk: chunkSchema.nullish(), via: z.unknown() })).nullish(),
  }).nullish(),
  alias_expansions: z.array(z.object({ alias: z.string().nullish(), canonical: z.string().nullish() })).nullish(),
  llm_prompt: z.string().nullish(),
});
const metaSchema = z.object({
  meta: z.object({ request_id: z.string().optional(), latency_ms: z.number().optional(), api_version: z.string().optional() }).optional(),
});

const label = (node: Record<string, unknown> | null | undefined): string => {
  if (!node) return '?';
  for (const key of ['name', 'label', 'title', 'id', 'type', 'relation', 'predicate']) {
    const value = node[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  const first = Object.values(node).find((value) => typeof value === 'string');
  return typeof first === 'string' ? first : '?';
};

const graphEdges = (data: z.infer<typeof querySchema>): GraphEdge[] => {
  const raw = [...(data.graph_context?.query_paths ?? []), ...(data.graph_context?.chunk_relations ?? [])];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const path = pathSchema.safeParse(entry).data;
    if (!path) continue;
    for (const triplet of path.triplets ?? []) {
      const edge: GraphEdge = {
        source: label(triplet.source),
        relation: label(triplet.relation),
        target: label(triplet.target),
        score: path.relevancy_score ?? null,
      };
      const key = `${edge.source}|${edge.relation}|${edge.target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(edge);
    }
  }
  return edges.slice(0, 80);
};

export const labQuery = async (database: string, input: LabQueryInput): Promise<LabQueryResponse> => {
  const { body, requestId, latencyMs } = await hydra('/query', {
    method: 'POST',
    timeoutMs: 45_000,
    json: {
      database,
      ...(input.collections.length ? { collections: input.collections } : {}),
      query: input.query,
      type: input.type,
      query_by: input.queryBy,
      mode: input.mode,
      max_results: input.maxResults,
      ...(input.alpha !== undefined ? { alpha: input.alpha } : {}),
      ...(input.recencyBias !== undefined ? { recency_bias: input.recencyBias } : {}),
      graph_context: input.graphContext,
      query_forceful_relations: input.forcefulRelations,
      temporal_reasoning: input.temporalReasoning,
      temporal_now: new Date().toISOString(),
      ...(input.attributes && Object.keys(input.attributes).length ? { attributes: input.attributes } : {}),
      ...(input.acl?.length ? { acl: input.acl } : {}),
    },
  });

  const data = querySchema.safeParse(unwrap(body));
  if (!data.success) {
    throw new ExploreRequestError('HydraDB returned an unexpected query payload.', requestId);
  }
  const meta = metaSchema.safeParse(body).data?.meta;

  const sourcesById = new Map<string, z.infer<typeof sourceSchema>>();
  for (const entry of data.data.sources ?? []) {
    const source = sourceSchema.safeParse(entry).data;
    if (source?.id) sourcesById.set(source.id, source);
  }

  const chunks: LabChunk[] = [];
  for (const entry of data.data.chunks ?? []) {
    const chunk = chunkSchema.safeParse(entry).data;
    if (!chunk) continue;
    const source = chunk.id ? sourcesById.get(chunk.id) : undefined;
    chunks.push({
      id: chunk.id ?? chunk.chunk_uuid ?? '',
      chunkId: chunk.chunk_uuid ?? null,
      title: source?.title ?? chunk.source_title ?? chunk.id ?? '',
      url: source?.url ?? null,
      type: source?.type ?? chunk.source_type ?? null,
      collection: chunk.collection ?? null,
      score: chunk.relevancy_score ?? null,
      content: chunk.chunk_content ?? '',
      metadata: chunk.metadata ?? {},
    });
  }

  const forceful = [
    ...(data.data.forceful_relations?.declared ?? []).map((entry) => ({ entry, declared: true })),
    ...(data.data.forceful_relations?.inferred ?? []).map((entry) => ({ entry, declared: false })),
  ].map(({ entry, declared }) => ({
    id: entry.chunk?.id ?? entry.chunk?.chunk_uuid ?? '',
    title: entry.chunk?.source_title ?? entry.chunk?.id ?? '',
    via: entry.via === undefined || entry.via === null ? null : JSON.stringify(entry.via).slice(0, 160),
    declared,
  }));

  return {
    database,
    request: input,
    requestId: meta?.request_id ?? requestId,
    latencyMs: meta?.latency_ms ?? latencyMs,
    apiVersion: meta?.api_version ?? null,
    chunks,
    graph: graphEdges(data.data),
    temporalFacts: (data.data.temporal_facts ?? []).map((fact) => ({
      subject: fact.subject ?? null,
      relation: fact.relation ?? null,
      object: fact.object ?? null,
      status: fact.status ?? null,
      evidence: fact.evidence_phrase ?? null,
      start: fact.event_start ?? null,
      end: fact.event_end ?? null,
    })),
    forceful,
    aliasExpansions: (data.data.alias_expansions ?? []).map((note) => ({
      alias: note.alias ?? '',
      canonical: note.canonical ?? '',
    })),
    llmPrompt: data.data.llm_prompt ?? null,
  };
};
