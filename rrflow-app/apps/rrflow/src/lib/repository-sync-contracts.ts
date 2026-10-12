import { z } from 'zod';
import type { ServiceReceipt } from './mesh-contracts';

export const SYNC_REPOSITORY = 'EonsofStupid/rrflow-hydradb';
export const SYNC_DATABASE = 'rrflow_specialist';
export const SYNC_COLLECTION = 'rrflow_sync';
const count = z.number().int().nonnegative();
export const repositorySyncSchema = z.object({
  version: z.literal(1), repository: z.literal(SYNC_REPOSITORY), database: z.literal(SYNC_DATABASE),
  commit: z.string().regex(/^[a-f0-9]{40}$/), sourceAt: z.string().datetime({ offset: true }),
  startedAt: z.string().datetime(), updatedAt: z.string().datetime(), finishedAt: z.string().datetime().nullable(),
  phase: z.enum(['ingesting', 'indexing', 'searchable', 'failed']), total: count, changed: count,
  accepted: count, searchable: count, completed: count, failed: count.default(0), removed: count, deleted: count,
  error: z.string().nullable(), lastSuccessfulAt: z.string().datetime().nullable(), lastSuccessfulCommit: z.string().nullable(),
  runUrl: z.string().regex(/^https:\/\/github\.com\/EonsofStupid\/rrflow-hydradb\/actions\/runs\/\d+$/).nullable(),
  raindrop: z.object({ status: z.enum(['pending', 'accepted', 'failed']), eventId: z.string(), httpStatus: z.number().optional() }),
  requestIds: z.array(z.string()),
}).refine(state => state.searchable + state.failed <= state.total && state.completed <= state.searchable && state.accepted <= state.changed && state.deleted <= state.removed, 'Repository counts are inconsistent.');
export type RepositorySyncState = z.infer<typeof repositorySyncSchema>;
export type RepositorySyncSnapshot = { state: RepositorySyncState | null; checkedAt: string; receipts: ServiceReceipt[]; error?: string };
