import { z } from 'zod';
import { brainNamePlanSchema, plannedBrainName } from './source-atlas-contracts';
import { BRAIN_REGISTRY_DATABASE, createDatabaseSchema } from './databases-contracts';
import { projectIdSchema } from './project-context-contracts';
import type { ServiceReceipt } from './mesh-contracts';

export const registryWorkspaceSchema = z.enum(['personal', 'shippin']);
export type RegistryWorkspace = z.infer<typeof registryWorkspaceSchema>;
export const REGISTRY_DATABASE = BRAIN_REGISTRY_DATABASE;
export const registryCollections = { personal: 'personal', shippin: 'work' } as const;
export const REGISTRY_ROOT = 'brain-registry-v1';
export const REGISTRY_LIMIT = 250;
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1);
const brainId = z.string().regex(/^brain-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
export const registeredBrainNameSchema = z.string().max(100).refine(value => {
  const parts = value.split('/');
  return parts.length === 3 && brainNamePlanSchema.safeParse({ workspace: parts[0], project: parts[1], purpose: parts[2] }).success;
}, 'Use a valid workspace/project/purpose address.');
const collection = z.string().max(200).refine(value => !/[\x00-\x1f\x7f]/.test(value), 'Collection names cannot contain control characters.');
export const brainRegistrationSchema = z.object({
  version: z.literal(1), id: brainId, workspace: registryWorkspaceSchema,
  projectId: projectIdSchema.nullable(), projectSlug: brainNamePlanSchema.shape.project,
  purpose: brainNamePlanSchema.shape.purpose, displayName: z.string().trim().min(1).max(80), canonicalName: registeredBrainNameSchema,
  aliases: z.array(registeredBrainNameSchema).max(32), database: createDatabaseSchema.shape.name, collection,
  revision: revision.refine(value => value >= 1), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).strict();
export type RegisteredBrain = z.infer<typeof brainRegistrationSchema>;
const shared = { workspace: registryWorkspaceSchema, expectedRevision: revision };
const editable = { projectSlug: brainNamePlanSchema.shape.project, purpose: brainNamePlanSchema.shape.purpose, displayName: z.string().trim().min(1).max(80) };
export const brainRegistryActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('register'), ...shared, ...editable, projectId: projectIdSchema.nullable(), database: createDatabaseSchema.shape.name, collection }).strict(),
  z.object({ action: z.literal('rename'), ...shared, ...editable, brainId }).strict(),
]);
export type BrainRegistryAction = z.infer<typeof brainRegistryActionSchema>;
export type BrainRegistrySnapshot = { workspace: RegistryWorkspace; revision: number; brains: RegisteredBrain[]; checkedAt: string; receipts: ServiceReceipt[] };
export type BrainRegistryResult = BrainRegistrySnapshot & { brain?: RegisteredBrain; message?: string };
export const registryReadSchema = z.object({ workspace: registryWorkspaceSchema, revision, brains: z.array(brainRegistrationSchema).max(REGISTRY_LIMIT), checkedAt: z.string().datetime(), receipts: z.array(z.object({ action: z.string(), outcome: z.enum(['ok', 'failed']), requestId: z.string().nullable() })) });
export class BrainRegistryError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}
export const canonicalBrainName = (workspace: RegistryWorkspace, project: string, purpose: RegisteredBrain['purpose']) => plannedBrainName({ workspace: workspace === 'personal' ? 'personal' : 'work', project, purpose });

/** Validate the complete bounded snapshot before using any name or alias. */
export const validateBrainRegistry = (workspace: RegistryWorkspace, input: unknown): RegisteredBrain[] => {
  const brains = z.array(brainRegistrationSchema).max(REGISTRY_LIMIT).parse(input);
  const ids = new Set<string>(); const names = new Set<string>(); const bindings = new Set<string>();
  const projects = new Map<string, string>(); const slugs = new Map<string, string | null>();
  for (const brain of brains) {
    if (brain.workspace !== workspace || brain.canonicalName !== canonicalBrainName(workspace, brain.projectSlug, brain.purpose) || (!brain.projectId && brain.projectSlug !== 'shared') || (brain.projectId && brain.projectSlug === 'shared')) throw new BrainRegistryError('A saved brain has an inconsistent workspace or project address. Review the registry before editing.', 503);
    if (ids.has(brain.id)) throw new BrainRegistryError('Duplicate brain identities require reconciliation.', 503);
    ids.add(brain.id);
    for (const address of [brain.canonicalName, ...brain.aliases]) {
      if (address.split('/')[0] !== (workspace === 'personal' ? 'personal' : 'work') || names.has(address)) throw new BrainRegistryError('Duplicate or conflicting names and aliases require reconciliation.', 503);
      names.add(address);
    }
    const binding = JSON.stringify([brain.database, brain.collection]);
    if (bindings.has(binding)) throw new BrainRegistryError('Multiple brains claim the same native binding. Review their placement.', 503);
    bindings.add(binding);
    if (brain.projectId && projects.has(brain.projectId) && projects.get(brain.projectId) !== brain.projectSlug || slugs.has(brain.projectSlug) && slugs.get(brain.projectSlug) !== brain.projectId) throw new BrainRegistryError('Project addresses conflict. Review project identity before editing.', 503);
    if (brain.projectId) projects.set(brain.projectId, brain.projectSlug);
    slugs.set(brain.projectSlug, brain.projectId);
  }
  return brains;
};
export const resolveRegisteredBrain = (snapshot: BrainRegistrySnapshot, address: string) => {
  const parsed = registeredBrainNameSchema.parse(address);
  const brain = validateBrainRegistry(snapshot.workspace, snapshot.brains).find(item => item.canonicalName === parsed || item.aliases.includes(parsed));
  if (!brain) throw new BrainRegistryError('That brain name is not registered in this workspace.', 404);
  return { brain, matchedAlias: brain.canonicalName !== address };
};

/** Pure validation; the server still resolves native scope and commits with a revision guard. */
export const planBrainRegistryChange = (snapshot: BrainRegistrySnapshot, action: BrainRegistryAction, newId: string, at: string) => {
  if (snapshot.workspace !== action.workspace || snapshot.revision !== action.expectedRevision) throw new BrainRegistryError('The registry changed. Refresh and review the latest names before saving.');
  const existing = validateBrainRegistry(snapshot.workspace, snapshot.brains);
  const previous = action.action === 'rename' ? existing.find(brain => brain.id === action.brainId) : undefined;
  if (action.action === 'rename' && !previous) throw new BrainRegistryError('This brain is no longer registered in this workspace.', 404);
  if (action.action === 'register' && existing.length >= REGISTRY_LIMIT) throw new BrainRegistryError('This registry has reached its current 250-brain limit.');
  const projectId = action.action === 'register' ? action.projectId : previous!.projectId;
  if ((!projectId && action.projectSlug !== 'shared') || (projectId && action.projectSlug === 'shared')) throw new BrainRegistryError('Choose shared for workspace-wide knowledge, or choose a saved project and its own slug.', 400);
  const canonicalName = canonicalBrainName(action.workspace, action.projectSlug, action.purpose);
  const aliases = previous ? [...new Set([...previous.aliases, ...(previous.canonicalName === canonicalName ? [] : [previous.canonicalName])])].filter(alias => alias !== canonicalName) : [];
  if (aliases.length > 32) throw new BrainRegistryError('This brain has 32 retained aliases. Review its naming history before another rename.');
  const brain = brainRegistrationSchema.parse({
    version: 1, id: previous?.id ?? newId, workspace: action.workspace, projectId, projectSlug: action.projectSlug,
    purpose: action.purpose, displayName: action.displayName, canonicalName, aliases,
    database: previous?.database ?? (action.action === 'register' ? action.database : ''), collection: previous?.collection ?? (action.action === 'register' ? action.collection : ''),
    revision: (previous?.revision ?? 0) + 1, createdAt: previous?.createdAt ?? at, updatedAt: at,
  });
  const others = existing.filter(item => item.id !== brain.id);
  const reserved = new Set(others.flatMap(item => [item.canonicalName, ...item.aliases]));
  if ([brain.canonicalName, ...brain.aliases].some(address => reserved.has(address))) throw new BrainRegistryError('That name is already registered or retained as another brain’s alias.');
  if (others.some(item => item.database === brain.database && item.collection === brain.collection)) throw new BrainRegistryError('That database and collection already have a registered brain. Rename it instead.');
  if (others.some(item => item.projectSlug === brain.projectSlug && item.projectId !== brain.projectId || !!brain.projectId && item.projectId === brain.projectId && item.projectSlug !== brain.projectSlug)) throw new BrainRegistryError('This project slug conflicts with another registered project. A project with several brains needs a coordinated project rename.');
  return { brain, brains: validateBrainRegistry(action.workspace, [...others, brain]), nextRevision: snapshot.revision + 1 };
};
