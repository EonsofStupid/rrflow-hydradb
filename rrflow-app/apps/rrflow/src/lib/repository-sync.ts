import 'server-only';
import { z } from 'zod';
import { repositorySyncSchema, SYNC_COLLECTION, SYNC_DATABASE, SYNC_REPOSITORY, type RepositorySyncSnapshot } from './repository-sync-contracts';
import type { ServiceReceipt } from './mesh-contracts';

export const getRepositorySync = async (): Promise<RepositorySyncSnapshot> => {
  const started = performance.now();
  const receipt: ServiceReceipt = { service: 'HydraDB', action: 'Check GitHub knowledge sync', method: 'POST', endpoint: '/byog/query', database: SYNC_DATABASE, at: new Date().toISOString(), httpStatus: null, outcome: 'failed', requestId: null, latencyMs: null };
  const snapshot: RepositorySyncSnapshot = { state: null, checkedAt: receipt.at, receipts: [receipt] };
  try {
    if (!process.env.HYDRA_DB_API_KEY) throw new Error('HydraDB credential is unavailable. Start this workspace through Infisical.');
    const response = await fetch('https://api.hydradb.com/byog/query', {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${process.env.HYDRA_DB_API_KEY}`, 'API-Version': '2', 'Content-Type': 'application/json' },
      body: JSON.stringify({ database: SYNC_DATABASE, collection: SYNC_COLLECTION, query: 'MATCH (s:RepositorySync {ext_id: $id}) RETURN s.state AS state LIMIT 1', params: { id: SYNC_REPOSITORY.toLowerCase() } }),
    });
    receipt.httpStatus = response.status; receipt.requestId = response.headers.get('x-request-id');
    if (!response.ok) throw new Error(`HydraDB sync status could not be read (HTTP ${response.status}).`);
    const body = z.object({ success: z.literal(true), data: z.array(z.object({ state: z.string() })).max(1), meta: z.object({ request_id: z.string().optional() }).optional() }).parse(await response.json());
    receipt.requestId = body.meta?.request_id ?? receipt.requestId;
    snapshot.state = body.data.length ? repositorySyncSchema.parse(JSON.parse(body.data[0].state)) : null;
    receipt.outcome = 'ok';
  } catch (error) {
    snapshot.error = error instanceof z.ZodError || error instanceof SyntaxError ? 'HydraDB returned an unreadable sync checkpoint. The last successful sync cannot be verified.' : error instanceof Error ? error.message : 'Repository sync status is unavailable.';
    receipt.error = snapshot.error;
  } finally { receipt.latencyMs = Math.round(performance.now() - started); snapshot.checkedAt = new Date().toISOString(); }
  return snapshot;
};
