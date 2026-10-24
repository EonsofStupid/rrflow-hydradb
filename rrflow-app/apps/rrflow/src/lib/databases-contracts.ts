import { z } from 'zod';
import type { ServiceReceipt } from './mesh-contracts';

export const databaseWorkspaceSchema = z.enum(['personal', 'shippin']);
export type DatabaseWorkspace = z.infer<typeof databaseWorkspaceSchema> | 'practice';
export const createDatabaseSchema = z.object({
  name: z.string().trim().min(3).max(63).regex(/^[a-z][a-z0-9_-]*$/, 'Start with a lowercase letter; use lowercase letters, numbers, underscores or hyphens.'),
  workspace: databaseWorkspaceSchema,
}).strict();
export type CreateDatabaseInput = z.infer<typeof createDatabaseSchema>;
// System metadata is never a generic Personal/Work connector destination.
export const BRAIN_REGISTRY_DATABASE = 'rrflow_registry';
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
export type DatabaseAssignment = { name: string; workspace: DatabaseWorkspace | null; available: boolean; provisioningFailed: boolean; issue: string | null };
export type DatabaseAssignments = { databases: DatabaseAssignment[]; warnings: string[] };

/** Join real native existence to explicit membership; a name is never a permission. */
export const resolveDatabaseAssignments = (
  names: readonly string[], failedNames: readonly string[],
  memberships: readonly { name: string; workspace: 'personal' | 'shippin' | null }[] | null,
): DatabaseAssignments => {
  const failed = new Set(failedNames);
  const warnings = memberships === null ? ['Saved workspace assignments could not be verified. Only built-in assignments can be used until a successful refresh.'] : [];
  const databases = [...new Set([...names, ...failedNames])].map(name => {
    if (name === BRAIN_REGISTRY_DATABASE) return { name, workspace: null, available: false, provisioningFailed: failed.has(name), issue: 'Reserved for scoped brain identity metadata; not a source-ingestion destination.' };
    const builtIn = builtInDatabaseWorkspace(name);
    const saved = memberships?.filter(item => item.name === name) ?? [];
    const scopes = new Set(saved.map(item => item.workspace));
    const conflict = scopes.size > 1 || !!builtIn && saved.some(item => item.workspace !== builtIn);
    const workspace = conflict ? null : builtIn ?? saved[0]?.workspace ?? null;
    const issue = conflict ? 'Workspace assignments conflict. Review the registry before using this destination.'
      : failed.has(name) ? 'Native database provisioning failed.'
        : !createDatabaseSchema.shape.name.safeParse(name).success ? 'This native name needs compatibility review.'
          : !workspace ? memberships === null ? 'Workspace assignment is unavailable.' : 'Assign this database to a workspace before connecting sources.' : null;
    return { name, workspace, available: issue === null, provisioningFailed: failed.has(name), issue };
  });
  return { databases, warnings };
};
export type DatabasesSnapshot = {
  databases: DatabaseItem[]; checkedAt: string; receipts: ServiceReceipt[]; error?: string; warnings?: string[];
};
export type CreateDatabaseResult = {
  database: DatabaseItem; created: boolean; message: string; checkedAt: string; receipts: ServiceReceipt[];
};
