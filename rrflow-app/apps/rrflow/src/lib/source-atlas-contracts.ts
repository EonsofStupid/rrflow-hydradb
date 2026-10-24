import { z } from 'zod';
import { projectSummarySchema } from './project-context-contracts';
import { repositorySyncSchema } from './repository-sync-contracts';

/** A draft address, not a native binding or an authorization decision. */
export const brainNamePlanSchema = z.object({
  workspace: z.enum(['personal', 'work']),
  project: z.string().min(1).max(48).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by single hyphens.'),
  purpose: z.enum(['knowledge', 'practice', 'catalog', 'intake']),
}).strict();
export const plannedBrainName = (input: unknown) => {
  const value = brainNamePlanSchema.parse(input);
  return `${value.workspace}/${value.project}/${value.purpose}`;
};

const nullableTime = z.string().nullable();
const workspace = z.enum(['personal', 'shippin', 'practice']);
const receipt = z.object({ action: z.string(), outcome: z.enum(['ok', 'failed']), requestId: z.string().nullable() });
export const atlasDatabasesSchema = z.object({
  databases: z.array(z.object({ name: z.string(), workspace: workspace.nullable(), ready: z.boolean().nullable(), status: z.string().nullable() })),
  checkedAt: z.string(), warnings: z.array(z.string()).optional(), receipts: z.array(receipt),
});
export const atlasConnectionsSchema = z.object({
  overview: z.object({
    connectors: z.array(z.object({ id: z.string(), provider: z.string(), name: z.string(), database: z.string(), workspace,
      collection: z.string(), lifecycle: z.string(), syncStatus: z.string(), lastAttempt: nullableTime, lastSuccess: nullableTime,
      resources: z.number().nullable(), needsAttention: z.boolean() })),
    connectorListAvailable: z.boolean(), unassigned: z.array(z.object({ id: z.string(), provider: z.string(), database: z.string(), reason: z.string() })),
    warnings: z.array(z.string()), checkedAt: z.string(),
  }), receipts: z.array(receipt),
});
export const atlasProjectsSchema = z.object({ projects: z.array(projectSummarySchema), receipts: z.array(receipt) });
export const atlasSyncSchema = z.object({ state: repositorySyncSchema.nullable(), checkedAt: z.string(), receipts: z.array(receipt) });
export const atlasCollectionsSchema = z.object({ collections: z.array(z.string()) });
export const atlasItemsSchema = z.object({
  database: z.string(), collection: z.string().nullable(), kind: z.enum(['knowledge', 'memory']),
  items: z.array(z.object({ id: z.string(), kind: z.enum(['knowledge', 'memory']), collection: z.string().nullable(), title: z.string(), timestamp: nullableTime,
    description: z.string().nullable(), metadata: z.record(z.string(), z.unknown()), additionalMetadata: z.record(z.string(), z.unknown()) })),
  total: z.number().nullable(), requestId: z.string().nullable(),
});
export const atlasDetailSchema = z.object({
  id: z.string(), database: z.string(), collection: z.string().nullable(), kind: z.enum(['knowledge', 'memory']), content: z.string().nullable(),
  inferredContent: z.string().nullable(), requestIds: z.array(z.string()), failures: z.array(z.object({ call: z.string(), message: z.string() })),
});
export type AtlasDatabase = z.infer<typeof atlasDatabasesSchema>['databases'][number];
export type AtlasItem = z.infer<typeof atlasItemsSchema>['items'][number];
