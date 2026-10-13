import { z } from 'zod';
import type { ServiceReceipt } from './mesh-contracts';

export const qdrantScopeSchema = z.enum(['personal', 'work']);
export type QdrantScope = z.infer<typeof qdrantScopeSchema>;
export const qdrantDestinations = { personal: 'default-tenant', work: 'rrflow_specialist' } as const;
export const qdrantSourceCollection = 'rrflow_sources';
export const qdrantHydraCollection = 'qdrant_sources';
const pointId = z.union([z.string().uuid(), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)]);
export const qdrantImportSchema = z.object({
  scope: qdrantScopeSchema,
  points: z.array(z.object({ id: pointId, version: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).min(1).max(20),
}).strict().refine(input => new Set(input.points.map(item => String(item.id))).size === input.points.length, 'Select each source only once.');
export type QdrantImportInput = z.infer<typeof qdrantImportSchema>;
export type QdrantReceipt = { scope: QdrantScope; method: 'GET' | 'POST'; endpoint: string; httpStatus: number | null; latencyMs: number; ok: boolean };
export type QdrantSourcePoint = {
  id: string | number; title: string; text: string; sourceKind: string; provenance: string; sourceUrl: string | null;
  updatedAt: string | null; version: string; hydraId: string; importedAt: string | null; importedVersion: string | null; indexingStatus: string | null;
};
export type QdrantSource = {
  scope: QdrantScope; endpoint: string; database: string; collection: string; connected: boolean;
  total: number | null; collections: string[]; points: QdrantSourcePoint[]; hasMore: boolean;
  warnings: string[]; checkedAt: string; error?: string; evidencePending?: boolean;
};
export type QdrantSnapshot = { sources: QdrantSource[]; receipts: ServiceReceipt[]; qdrantReceipts: QdrantReceipt[]; checkedAt: string; error?: string };
export type QdrantImportResult = { accepted: number; database: string; collection: string; ids: string[]; importedAt: string; message: string; receipts: ServiceReceipt[]; qdrantReceipts: QdrantReceipt[]; error?: string };
