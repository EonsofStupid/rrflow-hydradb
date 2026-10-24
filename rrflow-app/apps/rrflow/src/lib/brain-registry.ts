import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { databaseRequest, readDatabaseAssignments } from './databases';
import { listCollections } from './explore';
import { loadProjectContext } from './project-context';
import type { ServiceReceipt } from './mesh-contracts';
import { BrainRegistryError, REGISTRY_DATABASE, REGISTRY_LIMIT, REGISTRY_ROOT, brainRegistrationSchema, planBrainRegistryChange, registryCollections, validateBrainRegistry, type BrainRegistryAction, type BrainRegistryResult, type BrainRegistrySnapshot, type RegisteredBrain, type RegistryWorkspace } from './brain-registry-contracts';

const projection = `b.ext_id AS id, b.version AS version, b.workspace AS workspace, b.project_id AS projectId,
  b.project_slug AS projectSlug, b.purpose AS purpose, b.display_name AS displayName, b.canonical_name AS canonicalName,
  b.aliases AS aliases, b.database AS database, b.collection AS collection, b.revision AS revision,
  b.created_at AS createdAt, b.updated_at AS updatedAt`;
const rawRows = z.array(z.record(z.string(), z.unknown()));
const graph = <T>(workspace: RegistryWorkspace, query: string, params: Record<string, unknown>, schema: z.ZodType<T>, receipts: ServiceReceipt[], action: string) => databaseRequest(
  'POST', '/byog/query', action, schema, receipts,
  { database: REGISTRY_DATABASE, collection: registryCollections[workspace], query, params: { root: REGISTRY_ROOT, ...params } }, REGISTRY_DATABASE,
);

export const readBrainRegistry = async (workspace: RegistryWorkspace, receipts: ServiceReceipt[]): Promise<BrainRegistrySnapshot> => {
  const rows = await graph(workspace, `MATCH (r:BrainRegistry {ext_id: $root})
    OPTIONAL MATCH (r)-[:HAS_BRAIN]->(b:RegisteredBrain)
    RETURN id(r) AS anchorId, r.revision AS registryRevision, ${projection}
    ORDER BY b.ext_id LIMIT ${REGISTRY_LIMIT + 1}`, {}, rawRows, receipts, 'Read registered brain identities');
  if (rows.length > REGISTRY_LIMIT) throw new BrainRegistryError('The registry read reached its bound. Reconcile the registry before editing.', 503);
  if (!rows.length) return { workspace, revision: 0, brains: [], checkedAt: new Date().toISOString(), receipts };
  const revisions = new Set(rows.map(row => row.registryRevision));
  const anchors = new Set(rows.map(row => row.anchorId));
  const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1).safeParse(rows[0].registryRevision);
  if (anchors.size !== 1 || rows[0].anchorId === undefined || revisions.size !== 1 || !revision.success) throw new BrainRegistryError('Registry anchors or revisions conflict. Reconcile before editing.', 503);
  const brains = rows.filter(row => row.id !== null).map(({ anchorId: _anchor, registryRevision: _revision, ...brain }) => {
    void _anchor; void _revision;
    return brainRegistrationSchema.parse(brain);
  });
  if (brains.some(brain => brain.revision > revision.data)) throw new BrainRegistryError('A brain revision is ahead of its registry. Reconcile before editing.', 503);
  return { workspace, revision: revision.data, brains: validateBrainRegistry(workspace, brains), checkedAt: new Date().toISOString(), receipts };
};

const verifyTarget = async (brain: RegisteredBrain, receipts: ServiceReceipt[]) => {
  const assignments = await readDatabaseAssignments(receipts);
  if (!assignments.databases.some(item => item.name === brain.database && item.workspace === brain.workspace && item.available)) throw new BrainRegistryError('This database no longer has the required workspace assignment. Refresh before registering or renaming its brain.', 403);
  if (brain.collection) {
    const result = await listCollections(brain.database);
    if (!result.collections.includes(brain.collection)) throw new BrainRegistryError('The selected collection is no longer available in this database. Refresh the source list.', 409);
  }
  if (brain.projectId) {
    const project = await loadProjectContext(brain.projectId, brain.workspace, receipts);
    if (project.id !== brain.projectId || project.workspace !== brain.workspace) throw new BrainRegistryError('The saved project does not belong to this workspace.', 403);
  }
};

export const changeBrainRegistry = async (action: BrainRegistryAction, receipts: ServiceReceipt[]): Promise<BrainRegistryResult> => {
  const snapshot = await readBrainRegistry(action.workspace, receipts);
  const { brain, nextRevision } = planBrainRegistryChange(snapshot, action, `brain-${randomUUID()}`, new Date().toISOString());
  await verifyTarget(brain, receipts);
  // Native WHERE + mutation was exercised with concurrent HTTP writers. No process-local lock is used.
  // Name/alias conflicts are checked against the full snapshot whose revision this statement requires.
  const target = action.action === 'register' ? 'CREATE (b:RegisteredBrain {ext_id: $id})' : 'MATCH (r)-[:HAS_BRAIN]->(b:RegisteredBrain {ext_id: $id})';
  const rows = await graph(action.workspace, `MERGE (r:BrainRegistry {ext_id: $root}) ON CREATE SET r.revision = 0
    WITH r WHERE r.revision = $expected
    ${target}
    SET b.version = $version, b.workspace = $workspace, b.project_id = $projectId,
      b.project_slug = $projectSlug, b.purpose = $purpose, b.display_name = $displayName,
      b.canonical_name = $canonicalName, b.aliases = $aliases, b.database = $database,
      b.collection = $collection, b.revision = $revision, b.created_at = $createdAt, b.updated_at = $updatedAt
    MERGE (r)-[:HAS_BRAIN]->(b)
    SET r.revision = $next
    CREATE (e:BrainRegistryRevision {ext_id: $eventId, action: $action, brain_id: $id, registry_revision: $next,
      canonical_name: $canonicalName, display_name: $displayName, aliases: $aliases, at: $updatedAt,
      previous_name: $previousName, actor: 'workspace-owner'})
    MERGE (b)-[:HAS_REVISION]->(e)
    RETURN r.revision AS registryRevision, ${projection}`, {
    ...brain, expected: action.expectedRevision, next: nextRevision, eventId: `revision-${randomUUID()}`, action: action.action,
    previousName: snapshot.brains.find(item => item.id === brain.id)?.canonicalName ?? null,
  }, rawRows, receipts, action.action === 'register' ? 'Register a logical brain and native binding' : 'Rename a logical brain and retain its aliases');
  if (rows.length !== 1) {
    const receipt = receipts.at(-1);
    if (receipt) { receipt.outcome = 'failed'; receipt.error = 'The expected registry revision no longer matches. No change was committed by this request.'; }
    throw new BrainRegistryError('The registry changed during this save. Refresh and review the latest names; do not retry blindly.');
  }
  const { registryRevision, ...saved } = rows[0];
  const parsed = brainRegistrationSchema.parse(saved);
  if (registryRevision !== nextRevision || JSON.stringify(parsed) !== JSON.stringify(brain)) throw new BrainRegistryError('The save returned an unexpected identity. Refresh the registry to reconcile the result.', 503);
  // Return the CAS-committed snapshot. A later concurrent revision is discovered on refresh.
  return { workspace: action.workspace, revision: nextRevision, brains: validateBrainRegistry(action.workspace, [...snapshot.brains.filter(item => item.id !== brain.id), parsed]),
    checkedAt: new Date().toISOString(), receipts, brain: parsed,
    message: action.action === 'register' ? 'Brain registered in HydraDB. Its native database and sources are unchanged.' : 'Brain renamed. Its identity and binding are unchanged; the previous address remains an alias.' };
};
