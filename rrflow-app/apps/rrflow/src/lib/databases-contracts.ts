import { z } from 'zod';
import type { ServiceReceipt } from './mesh-contracts';

export const databaseWorkspaceSchema = z.enum(['personal', 'shippin']);
export type DatabaseWorkspace = z.infer<typeof databaseWorkspaceSchema> | 'practice';
export const createDatabaseSchema = z.object({
  name: z.string().trim().min(3).max(63).regex(/^[a-z][a-z0-9_-]*$/, 'Start with a lowercase letter; use lowercase letters, numbers, underscores or hyphens.'),
  workspace: databaseWorkspaceSchema,
}).strict();
export type CreateDatabaseInput = z.infer<typeof createDatabaseSchema>;
export const builtInDatabaseWorkspaces: Readonly<Record<string, DatabaseWorkspace>> = {
  'default-tenant': 'personal', rrflow_specialist: 'shippin', shippin_cloud: 'shippin', shippin_ai: 'shippin', shipping_buzz: 'shippin', seniordev: 'practice',
};
export const databaseWorkspaceNames = { personal: 'Personal life', shippin: 'Shippin work', practice: 'Engineering practice' } as const;
export type DatabaseItem = {
  name: string; workspace: DatabaseWorkspace | null; ready: boolean | null; status: string | null;
  graph?: boolean | null; knowledge?: boolean | null; memories?: boolean | null;
};
export type DatabaseSummary = DatabaseItem;
export const builtInDatabaseWorkspace = (name: string): DatabaseWorkspace | null => Object.hasOwn(builtInDatabaseWorkspaces, name) ? builtInDatabaseWorkspaces[name] : null;
export type DatabasesSnapshot = {
  databases: DatabaseItem[]; checkedAt: string; receipts: ServiceReceipt[]; error?: string; warnings?: string[];
};
export type CreateDatabaseResult = {
  database: DatabaseItem; created: boolean; message: string; checkedAt: string; receipts: ServiceReceipt[];
};
