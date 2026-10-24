import 'server-only';
import { z } from 'zod';
import { BRAIN_REGISTRY_DATABASE, builtInDatabaseWorkspace, resolveDatabaseAssignments, type DatabaseAssignments, type CreateDatabaseInput, type CreateDatabaseResult, type DatabaseItem, type DatabasesSnapshot, type DatabaseWorkspace } from './databases-contracts';
import type { ServiceReceipt } from './mesh-contracts';

const registryDatabase = 'rrflow_specialist';
const registryCollection = 'rrflow';
const envelopeSchema = z.object({ success: z.boolean(), data: z.unknown(), meta: z.object({ request_id: z.string().optional() }).optional() });
const catalogSchema = z.object({ databases: z.array(z.string()), failed_databases: z.array(z.object({ database: z.string() })).optional() });
const membershipSchema = z.array(z.object({ name: z.string(), workspace: z.enum(['personal', 'shippin']).nullable() }));
const readinessSchema = z.object({ status: z.string().optional(), infra: z.object({
  ready_for_ingestion: z.boolean().optional(), graph_status: z.boolean().optional(),
  vectorstore_status: z.object({ knowledge: z.boolean().optional(), memories: z.boolean().optional() }).optional(),
}) });

export class DatabaseActionError extends Error {
  constructor(message: string, readonly httpStatus = 503) { super(message); }
}

const native = async <T>(method: 'GET' | 'POST', endpoint: string, action: string, schema: z.ZodType<T>, receipts: ServiceReceipt[], body?: unknown, database: string | null = null): Promise<T> => {
  const key = process.env.HYDRA_DB_API_KEY;
  if (!key) throw new DatabaseActionError('HydraDB is not connected. Start the workspace with its Infisical credentials.');
  const started = Date.now();
  const receipt: ServiceReceipt = { service: 'HydraDB', action, method, endpoint: endpoint.split('?')[0], database, httpStatus: null, outcome: 'failed', requestId: null, latencyMs: null, at: new Date().toISOString() };
  try {
    const response = await fetch(`https://api.hydradb.com${endpoint}`, {
      method, headers: { Authorization: `Bearer ${key}`, 'API-Version': '2', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: 'no-store', signal: AbortSignal.timeout(25_000),
    });
    receipt.httpStatus = response.status; receipt.requestId = response.headers.get('x-request-id');
    if (!response.ok) {
      if (response.status === 409) throw new DatabaseActionError('That database already exists or is being created. Refresh the list; its assignment was not overwritten.', 409);
      if (response.status === 401 || response.status === 403) throw new DatabaseActionError('HydraDB refused access. Check that this key can manage databases.', 403);
      if (response.status === 400 || response.status === 422) throw new DatabaseActionError('HydraDB did not accept this database name. Check its naming requirements.', 400);
      if (response.status === 402) throw new DatabaseActionError('Your HydraDB database allowance has been reached.', 402);
      throw new DatabaseActionError(`HydraDB could not complete the operation (HTTP ${response.status}). Refresh before retrying.`);
    }
    const payload = envelopeSchema.parse(await response.json());
    receipt.requestId = payload.meta?.request_id ?? receipt.requestId;
    if (!payload.success) throw new DatabaseActionError('HydraDB did not complete this operation. Refresh before retrying.');
    const result = schema.parse(payload.data);
    receipt.outcome = 'ok';
    return result;
  } catch (error) {
    const safe = error instanceof DatabaseActionError ? error : new DatabaseActionError(error instanceof z.ZodError ? 'HydraDB returned an unexpected database response. Refresh before retrying.' : 'HydraDB did not respond. Check the database list before retrying a creation.');
    receipt.error = safe.message;
    throw safe;
  } finally { receipt.latencyMs = Date.now() - started; receipts.push(receipt); }
};

const readCatalog = (receipts: ServiceReceipt[]) => native('GET', '/databases', 'List HydraDB databases', catalogSchema, receipts);
// Registry operations reuse this existing native transport and its receipt/redaction contract.
export { native as databaseRequest };
const readMemberships = (receipts: ServiceReceipt[]) => native('POST', '/byog/query', 'Read Personal and Shippin database assignments', membershipSchema, receipts, {
  database: registryDatabase, collection: registryCollection,
  query: 'MATCH (d:DatabaseWorkspace) RETURN d.ext_id AS name, d.workspace AS workspace LIMIT 1000', params: {},
}, registryDatabase);

const checkReadiness = async (name: string, workspace: DatabaseWorkspace | null, receipts: ServiceReceipt[]): Promise<DatabaseItem> => {
  try {
    const response = await native('GET', `/databases/status?database=${encodeURIComponent(name)}`, `Check whether ${name} is ready to learn`, readinessSchema, receipts, undefined, name);
    const infra = response.infra;
    return { name, workspace, ready: infra.ready_for_ingestion ?? null,
      status: response.status ?? (infra.ready_for_ingestion === true ? 'Ready to learn' : infra.ready_for_ingestion === false ? 'Preparing database' : 'Readiness not reported'),
      graph: infra.graph_status ?? null, knowledge: infra.vectorstore_status?.knowledge ?? null, memories: infra.vectorstore_status?.memories ?? null };
  } catch {
    return { name, workspace, ready: null, status: 'Status unavailable — refresh to retry' };
  }
};

export const readDatabaseAssignments = async (receipts: ServiceReceipt[]): Promise<DatabaseAssignments> => {
  const [catalog, memberships] = await Promise.allSettled([readCatalog(receipts), readMemberships(receipts)]);
  if (catalog.status === 'rejected') throw catalog.reason;
  // A full bounded result may be truncated; do not authorize custom destinations from it.
  return resolveDatabaseAssignments(catalog.value.databases, catalog.value.failed_databases?.map(item => item.database) ?? [],
    memberships.status === 'fulfilled' && memberships.value.length < 1000 ? memberships.value : null);
};

export const listDatabases = async (receipts: ServiceReceipt[]): Promise<DatabasesSnapshot> => {
  const assignments = await readDatabaseAssignments(receipts);
  const databases: DatabaseItem[] = [];
  // Bound parallel requests so a large account does not flood HydraDB status calls.
  for (let index = 0; index < assignments.databases.length; index += 6) {
    databases.push(...await Promise.all(assignments.databases.slice(index, index + 6).map(({ name, workspace, provisioningFailed }) => {
      return provisioningFailed ? { name, workspace, ready: false, status: 'Database creation failed' } : checkReadiness(name, workspace, receipts);
    })));
  }
  return { databases, checkedAt: new Date().toISOString(), receipts, warnings: [...assignments.warnings, ...assignments.databases.filter(item => item.issue).map(item => `${item.name}: ${item.issue}`)] };
};

export const createDatabase = async (input: CreateDatabaseInput, receipts: ServiceReceipt[]): Promise<CreateDatabaseResult> => {
  if (input.name === BRAIN_REGISTRY_DATABASE) throw new DatabaseActionError('This name is reserved for brain identity metadata. Choose a source database name.', 409);
  const catalog = await readCatalog(receipts);
  if (catalog.databases.includes(input.name) || catalog.failed_databases?.some(item => item.database === input.name) || builtInDatabaseWorkspace(input.name)) {
    throw new DatabaseActionError('That database already exists. Its workspace assignment and contents were not changed. Choose a new name.', 409);
  }
  // Reserve only the user's chosen assignment. ON CREATE prevents concurrent or retried requests from changing it.
  // A failed provisioning attempt leaves the intent in HydraDB; list joins it with real database existence.
  const membership = await native('POST', '/byog/query', 'Save the new database workspace assignment', membershipSchema, receipts, {
    database: registryDatabase, collection: registryCollection,
    query: `MERGE (d:DatabaseWorkspace {ext_id: $name})
      ON CREATE SET d.workspace = $workspace, d.created_at = $createdAt
      RETURN d.ext_id AS name, d.workspace AS workspace`,
    params: { name: input.name, workspace: input.workspace, createdAt: new Date().toISOString() },
  }, registryDatabase);
  if (membership.length !== 1 || membership[0].workspace !== input.workspace) throw new DatabaseActionError('That database name already has a different saved workspace assignment. Choose a new name; the existing assignment was preserved.', 409);
  await native('POST', '/databases', 'Create the requested HydraDB database', z.object({ database: z.string(), status: z.string().optional() }), receipts, { database: input.name }, input.name);
  const database = await checkReadiness(input.name, input.workspace, receipts);
  return { database, created: true, checkedAt: new Date().toISOString(), receipts,
    message: database.ready ? 'Database created and ready to learn. Its workspace assignment is saved in HydraDB.' : 'Database creation accepted. Its workspace assignment is saved; refresh to check when it is ready to learn.' };
};
