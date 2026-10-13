import { z } from 'zod';
import type { ServiceReceipt } from './mesh-contracts';

export const qdrantScopeSchema = z.enum(['personal', 'work']);
export type QdrantScope = z.infer<typeof qdrantScopeSchema>;
export const qdrantDestinations = { personal: 'default-tenant', work: 'rrflow_specialist' } as const;
export const qdrantSourceCollection = 'rrflow_sources';
export const qdrantHydraCollection = 'qdrant_sources';
export const qdrantCollectionSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);

/** Server-owned connection settings only; no request may choose an endpoint. */
export const resolveQdrantConnection = (input: { scope: QdrantScope; hosted: boolean; url?: string; hasApiKey: boolean; collection?: string; otherUrl?: string; otherCollection?: string }): { endpoint: string | null; displayEndpoint: string; collection: string; location: 'local' | 'external' | 'unconfigured'; error?: string } => {
  const parsedCollection = qdrantCollectionSchema.safeParse(input.collection ?? qdrantSourceCollection);
  const collection = parsedCollection.success ? parsedCollection.data : qdrantSourceCollection;
  const unconfigured = (error: string) => ({ endpoint: null, displayEndpoint: 'No hosted source configured', collection, location: 'unconfigured' as const, error });
  if (!parsedCollection.success) return unconfigured('The server Qdrant collection must be 1–128 letters, digits, underscores or hyphens, starting with a letter or digit.');
  if (!input.url) {
    if (input.hosted) return unconfigured('This Qdrant library runs on your local computer and is not connected to this hosted workspace. Previously imported knowledge remains available in HydraDB and the Connectome.');
    const endpoint = input.scope === 'personal' ? 'http://127.0.0.1:6333' : 'http://127.0.0.1:6335';
    return { endpoint, displayEndpoint: endpoint, collection, location: 'local' as const };
  }
  try {
    const url = new URL(input.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname === '[::1]' || /^127\./.test(url.hostname)) return unconfigured('The server Qdrant URL must be an external HTTPS origin without embedded credentials, a path, or query parameters.');
    if (!input.hasApiKey) return unconfigured('This external Qdrant source needs its own API key in the server environment.');
    if (input.otherUrl && collection === (input.otherCollection ?? qdrantSourceCollection)) {
      try { if (url.origin === new URL(input.otherUrl).origin) return unconfigured('Personal and Work must use different collections when sharing one Qdrant service.'); } catch { /* The other scope reports its own invalid URL. */ }
    }
    return { endpoint: url.origin, displayEndpoint: 'External Qdrant service · HTTPS', collection, location: 'external' as const };
  } catch { return unconfigured('The server Qdrant URL is invalid. Configure an external HTTPS origin and its API key.'); }
};
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
  location?: 'local' | 'external' | 'unconfigured';
  total: number | null; collections: string[]; points: QdrantSourcePoint[]; hasMore: boolean;
  warnings: string[]; checkedAt: string; error?: string; evidencePending?: boolean;
};
export type QdrantSnapshot = { sources: QdrantSource[]; receipts: ServiceReceipt[]; qdrantReceipts: QdrantReceipt[]; checkedAt: string; error?: string };
export type QdrantImportResult = { accepted: number; database: string; collection: string; ids: string[]; importedAt: string; message: string; receipts: ServiceReceipt[]; qdrantReceipts: QdrantReceipt[]; error?: string };
