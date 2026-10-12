import { z } from 'zod';

/**
 * Brain Explorer contracts. Client-safe: no secrets, no server-only imports.
 *
 * The explorer discovers every HydraDB database this key can reach at request
 * time and drills down: database → collection → item → content, extracted
 * relations, subgraph. Query Lab forwards every `POST /query` knob and returns
 * the structured response with its request id.
 */

export const exploreKinds = ['knowledge', 'memory'] as const;
export type ExploreKind = (typeof exploreKinds)[number];

export const queryModes = ['fast', 'thinking', 'auto'] as const;
export type QueryMode = (typeof queryModes)[number];

export const sourceTypes = ['knowledge', 'memory', 'all'] as const;
export type SourceType = (typeof sourceTypes)[number];

export const databaseNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/, 'Database names use letters, digits, "_" and "-".');

export const listItemsInputSchema = z.object({
  collection: z.string().max(200).optional(),
  kind: z.enum(exploreKinds).default('knowledge'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListItemsInput = z.infer<typeof listItemsInputSchema>;

export const itemDetailInputSchema = z.object({
  collection: z.string().max(200).optional(),
  kind: z.enum(exploreKinds).default('knowledge'),
});

export const labQueryInputSchema = z.object({
  collections: z.array(z.string().max(200)).max(10).default([]),
  query: z.string().trim().min(1, 'Ask something.').max(2000),
  type: z.enum(sourceTypes).default('all'),
  queryBy: z.enum(['hybrid', 'text']).default('hybrid'),
  mode: z.enum(queryModes).default('thinking'),
  maxResults: z.number().int().min(1).max(50).default(10),
  alpha: z.union([z.literal('auto'), z.number().min(0).max(1)]).optional(),
  recencyBias: z.number().min(0).max(1).optional(),
  graphContext: z.boolean().default(true),
  forcefulRelations: z.boolean().default(true),
  temporalReasoning: z.boolean().default(true),
  attributes: z.record(z.string(), z.unknown()).optional(),
  acl: z.array(z.string().max(200)).max(10).optional(),
});
export type LabQueryInput = z.infer<typeof labQueryInputSchema>;

// ---- Outputs -----------------------------------------------------------------

export interface ExploreDatabase {
  name: string;
  ready: boolean | null;
  knowledgeRows: number | null;
  memoryRows: number | null;
  collections: string[];
  requestId: string | null;
  error: string | null;
}

export interface ExploreDatabasesResponse {
  databases: ExploreDatabase[];
  checkedAt: string;
}

export interface ExploreItem {
  id: string;
  kind: ExploreKind;
  title: string;
  type: string | null;
  collection: string | null;
  timestamp: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  additionalMetadata: Record<string, unknown>;
}

export interface ExploreListResponse {
  database: string;
  collection: string | null;
  kind: ExploreKind;
  page: number;
  pageSize: number;
  total: number | null;
  items: ExploreItem[];
  requestId: string | null;
}

export interface ExploreEntity {
  id: string;
  name: string;
  type: string | null;
}

export interface ExploreRelation {
  source: ExploreEntity;
  target: ExploreEntity;
  predicate: string;
  confidence: number | null;
  context: string | null;
  chunkId: string | null;
  synthesized: boolean;
}

export interface ExploreSubgraphSource {
  id: string;
  title: string;
  depth: number | null;
  via: string | null;
}

export interface ExploreItemDetail {
  id: string;
  database: string;
  collection: string | null;
  kind: ExploreKind;
  content: string | null;
  inferredContent: string | null;
  contentType: string | null;
  relations: ExploreRelation[];
  relationsTruncated: boolean;
  subgraph: {
    sources: ExploreSubgraphSource[];
    relations: ExploreRelation[];
    maxDepthReached: number | null;
  };
  /** One request id per HydraDB call that succeeded, for evidence on demand. */
  requestIds: string[];
  /** Calls that failed, by name, so the UI never shows "nothing" for "unknown". */
  failures: { call: 'inspect' | 'relations' | 'subgraph'; message: string }[];
}

export interface GraphEdge {
  source: string;
  relation: string;
  target: string;
  score: number | null;
}

export interface LabChunk {
  id: string;
  chunkId: string | null;
  title: string;
  url: string | null;
  type: string | null;
  collection: string | null;
  score: number | null;
  content: string;
  metadata: Record<string, unknown>;
}

export interface LabTemporalFact {
  subject: string | null;
  relation: string | null;
  object: string | null;
  status: string | null;
  evidence: string | null;
  start: number | null;
  end: number | null;
}

export interface LabForcefulRelation {
  id: string;
  title: string;
  via: string | null;
  declared: boolean;
}

export interface LabQueryResponse {
  database: string;
  request: LabQueryInput;
  requestId: string | null;
  latencyMs: number | null;
  apiVersion: string | null;
  chunks: LabChunk[];
  graph: GraphEdge[];
  temporalFacts: LabTemporalFact[];
  forceful: LabForcefulRelation[];
  aliasExpansions: { alias: string; canonical: string }[];
  llmPrompt: string | null;
}
