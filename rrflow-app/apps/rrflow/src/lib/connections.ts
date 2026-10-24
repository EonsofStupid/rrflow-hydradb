import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { ServiceReceipt } from './mesh-contracts';
import { readDatabaseAssignments } from './databases';
import { databaseWorkspaceNames, type DatabaseAssignments } from './databases-contracts';
import type { ConnectionsAction, ConnectionsQuery, ConnectionsResponse, ConnectorItem, ProviderDetail, WebhookState } from './connections-contracts';

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): Row[] => Array.isArray(value) ? value.map(row) : [];
const string = (value: unknown, max = 1000) => typeof value === 'string' ? value.slice(0, max) : '';
const nullable = (value: unknown) => string(value) || null;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 100).map(item => item.slice(0, 1000)) : [];
const safeUrl = (value: unknown) => {
  try { const url = new URL(string(value, 2000)); if (url.protocol !== 'https:') return null; url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.href; } catch { return null; }
};

const native = async (path: string, method: 'GET' | 'POST', action: string, receipts: ServiceReceipt[], body?: unknown, database: string | null = null) => {
  const key = process.env.HYDRA_DB_API_KEY;
  if (!key) throw new Error('HydraDB is not connected. Start RRFLOW with its Infisical credentials.');
  const started = Date.now();
  let receipt: ServiceReceipt | undefined;
  try {
    const response = await fetch(`https://api.hydradb.com${path}`, {
      method, headers: { Authorization: `Bearer ${key}`, 'API-Version': '2', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: 'no-store', signal: AbortSignal.timeout(25_000),
    });
    const payload = row(await response.json().catch(() => ({})));
    const ok = response.ok && payload.success !== false;
    receipt = { service: 'HydraDB', action, method, endpoint: path.split('?')[0], database, httpStatus: response.status,
      outcome: ok ? 'ok' : 'failed', requestId: nullable(row(payload.meta).request_id) ?? response.headers.get('x-request-id'),
      latencyMs: Date.now() - started, at: new Date().toISOString() };
    receipts.push(receipt);
    if (!ok) {
      // Provider failures can contain credentials. Only a fixed, actionable message crosses the API boundary.
      const reason = response.status === 401 || response.status === 403 ? 'Access was refused. Check the account permissions.'
        : response.status === 402 ? 'The HydraDB plan limit was reached.'
          : response.status === 409 ? 'The connector state changed. Refresh its status before trying again.'
            : response.status === 400 || response.status === 422 ? 'HydraDB rejected these settings. Check the provider credential fields and selected resources.'
              : 'HydraDB could not finish this operation. Refresh and try again.';
      receipt.error = reason;
      throw new Error(reason);
    }
    return payload.data && typeof payload.data === 'object' ? row(payload.data) : payload;
  } catch (error) {
    if (receipt) throw error;
    receipts.push({ service: 'HydraDB', action, method, endpoint: path.split('?')[0], database, httpStatus: null,
      outcome: 'failed', requestId: null, latencyMs: Date.now() - started, at: new Date().toISOString(), error: 'HydraDB did not respond. Try again.' });
    throw new Error('HydraDB did not respond. Try again.');
  }
};

export class ConnectionScopeError extends Error { readonly httpStatus = 403; }
const destination = (name: string, assignments: DatabaseAssignments) => assignments.databases.find(item => item.name === name && item.available && item.workspace);
// Native APIs use both aliases. Conflicting or malformed values must never inherit a destination.
const databaseFrom = (value: Row, fallback = ''): string => {
  const values = [value.database, value.tenant_id].filter(item => item !== undefined && item !== null);
  if (values.some(item => typeof item !== 'string' || !item) || new Set(values).size > 1) return '';
  return values.length ? values[0] as string : fallback;
};
const connectorFrom = (value: Row, assignments: DatabaseAssignments): ConnectorItem | null => {
  const database = databaseFrom(value);
  const target = destination(database, assignments);
  if (!target?.workspace || !string(value.connector_id)) return null;
  return { id: string(value.connector_id), name: string(value.name) || string(value.provider), provider: string(value.provider), database, workspace: target.workspace,
    collection: string(value.collection ?? value.sub_tenant_id), lifecycle: string(value.lifecycle) || 'unknown', syncStatus: string(value.sync_status) || 'unknown',
    lastAttempt: nullable(value.last_attempted_sync_at), lastSuccess: nullable(value.last_successful_sync_at), nextSync: nullable(value.next_sync_at),
    dispatched: number(value.documents_dispatched), resources: number(value.active_resource_count), needsAttention: value.needs_reauth === true || value.sync_blocked === true || !!value.last_error };
};
const ownedConnector = async (id: string, receipts: ServiceReceipt[]) => {
  const [value, assignments] = await Promise.all([
    native(`/connectors/${encodeURIComponent(id)}`, 'GET', 'Read the connector destination', receipts), readDatabaseAssignments(receipts),
  ]);
  const connector = connectorFrom(value, assignments);
  if (!connector || connector.id !== id) throw new ConnectionScopeError('This connector has no verified workspace destination. Review its database assignment before changing it.');
  return { connector, assignments };
};
const webhookFrom = (value: Row): WebhookState => ({ registered: value.registered === true, url: safeUrl(value.url), signing: value.signing_secret_configured === true, events: strings(value.event_types) });

export const readConnections = async (query: ConnectionsQuery, receipts: ServiceReceipt[]): Promise<ConnectionsResponse> => {
  if (query.view === 'overview') {
    const [calls, assignments] = await Promise.all([Promise.allSettled([
      native('/connectors/providers', 'GET', 'Find available knowledge sources', receipts),
      native('/connectors', 'GET', 'Read RRFLOW connectors', receipts),
      native('/webhooks/indexing', 'GET', 'Read organization indexing notifications', receipts),
      native('/webhooks/indexing/deliveries?limit=20', 'GET', 'Read the last 20 indexing notification deliveries', receipts),
    ]), readDatabaseAssignments(receipts).catch((): DatabaseAssignments => ({ databases: [], warnings: ['Database assignments could not load. Connection changes are unavailable until a successful refresh.'] }))]);
    const result = (index: number) => calls[index].status === 'fulfilled' ? calls[index].value : null;
    const catalog = result(0); const connectors = result(1); const webhook = result(2); const deliveries = result(3);
    const connectorListAvailable = Array.isArray(connectors?.connectors);
    const managed = list(connectors?.connectors).map(item => ({ raw: item, connector: connectorFrom(item, assignments) }));
    return { receipts, overview: {
      providers: list(catalog?.providers).filter(item => item.supported === true).map(item => ({ id: string(item.provider), category: string(item.category), webhook: item.webhook_support === true, beta: item.is_beta === true || item.is_alpha === true })),
      destinations: assignments.databases.flatMap(item => item.available && item.workspace ? [{ name: item.name, workspace: item.workspace, label: `${databaseWorkspaceNames[item.workspace]} · ${item.name}` }] : []),
      connectors: managed.flatMap(item => item.connector ? [item.connector] : []),
      unassigned: managed.filter(item => !item.connector).map(({ raw }) => ({ id: string(raw.connector_id) || 'Unknown connector', provider: string(raw.provider) || 'Unknown provider', database: string(raw.database ?? raw.tenant_id) || 'Unknown destination', reason: assignments.databases.find(item => item.name === (raw.database ?? raw.tenant_id))?.issue ?? 'The destination could not be verified against the native database catalog and workspace registry.' })),
      connectorListAvailable,
      webhook: webhook ? webhookFrom(webhook) : null,
      deliveries: list(deliveries?.deliveries).slice(0, 20).map(item => ({ id: string(item.delivery_id), status: string(item.status), indexingStatus: string(item.indexing_status),
        at: nullable(item.updated_at ?? item.created_at), attempts: number(item.attempts), source: nullable(item.doc_id), url: safeUrl(item.webhook_url) })),
      warnings: [...assignments.warnings, ...calls.flatMap((call, index) => call.status === 'rejected' ? [`${['Provider catalog', 'Connector list', 'Webhook configuration', 'Delivery history'][index]} could not load. Refresh to retry.`] : []), ...(!connectorListAvailable && calls[1].status === 'fulfilled' ? ['The connector list returned an unexpected response. Its contents are unknown.'] : [])], checkedAt: new Date().toISOString(),
    } };
  }
  if (query.view === 'provider') {
    const value = await native(`/connectors/providers?id=${encodeURIComponent(query.provider)}`, 'GET', 'Read provider setup requirements', receipts);
    const schema = row(value.credential_schema); const required = strings(schema.required);
    const fields = Object.entries(row(schema.properties)).map(([name, definition]) => ({ name, description: string(row(definition).description, 2000), type: string(row(definition).type) || 'string', required: required.includes(name) }));
    const provider: ProviderDetail = { id: string(value.provider) || query.provider, objectTypes: strings(value.indexed_object_types), fields,
      complexCredentials: fields.some(field => !['string', 'number', 'integer', 'boolean'].includes(field.type)) || !!schema.oneOf || !!schema.anyOf,
      setup: typeof value.setup_guide === 'string' ? string(value.setup_guide, 8000) : null,
      scopes: list(value.token_scopes).map(scope => `${string(scope.id)}: ${string(scope.reason)}`) };
    return { provider, receipts };
  }
  const { connector } = await ownedConnector(query.connectorId, receipts);
  if (query.view === 'discover') {
    const params = new URLSearchParams({ limit: '100', ...(query.cursor ? { cursor: query.cursor } : {}) });
    const value = await native(`/connectors/${encodeURIComponent(connector.id)}/discover?${params}`, 'GET', 'Find repositories, channels or pages this account can read', receipts, undefined, connector.database);
    return { receipts, connector, discovery: { resources: list(value.resources).map(item => ({ id: string(item.id), name: string(item.name), type: string(item.resource_type) })), nextCursor: value.has_more === true ? nullable(value.next_cursor) : null } };
  }
  const value = await native(`/connectors/${encodeURIComponent(connector.id)}/status`, 'GET', 'Check source-by-source sync health', receipts, undefined, connector.database);
  return { receipts, detail: { connector, health: string(value.status) || 'unknown', resources: list(value.resources).map(item => ({ id: string(item.resource_id), name: string(item.display_name) || string(item.resource_id), status: string(item.status), rows: number(item.last_row_count) })) } };
};

// Registration causes HydraDB to call the destination. Reject local/reserved addresses, including DNS names pointing at them.
export const isPublicAddress = (address: string) => {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 || b === 2) || a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19 || b === 51) || a === 203 && b === 0 || a >= 224);
  }
  if (isIP(address) === 6) return /^2[0-9a-f]{3}:/i.test(address) && !/^2001:(db8|0):/i.test(address) && !/^2002:/i.test(address);
  return false;
};

export const changeConnections = async (input: ConnectionsAction, receipts: ServiceReceipt[]): Promise<ConnectionsResponse> => {
  if (input.action === 'create') {
    const assignments = await readDatabaseAssignments(receipts);
    if (!destination(input.database, assignments)) throw new ConnectionScopeError('Choose an existing database with a verified workspace assignment. No connector was created.');
    const value = await native('/connectors', 'POST', 'Create a native HydraDB connector', receipts, {
      provider: input.provider, name: input.name, database: input.database, collection: 'connected-sources',
      provider_account_scope: input.account, credentials: input.credentials, custom_instructions: input.instructions,
    }, input.database);
    const connector = connectorFrom(value, assignments);
    if (!connector || connector.database !== input.database) throw new Error('HydraDB accepted the request but returned an unexpected connector destination. Refresh before creating another.');
    return { receipts, connector, message: 'Account connected. Choose which resources this brain should learn from next.' };
  }
  if (input.action === 'register-webhook') {
    const host = new URL(input.url).hostname;
    let addresses: { address: string }[];
    try { addresses = await lookup(host, { all: true }); } catch { throw new Error('The endpoint host could not be resolved. Use a reachable public HTTPS address.'); }
    if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('The endpoint must resolve only to public addresses. Local and private network endpoints cannot receive HydraDB notifications.');
    const value = await native('/webhooks/indexing', 'POST', 'Save the organization indexing notification endpoint', receipts, {
      url: input.url, event_types: ['indexing.status_changed'], generate_signing_secret: input.generateSecret,
    });
    return { receipts, webhook: webhookFrom(value), ...(input.generateSecret && typeof value.signing_secret === 'string' ? { signingSecret: value.signing_secret } : {}),
      message: 'Indexing notifications are registered. Test the receiver and save the signing secret in its secret manager.' };
  }
  if (input.action === 'test-webhook') {
    const value = await native('/webhooks/indexing/test', 'POST', 'Send a test indexing notification', receipts);
    return { receipts, delivered: value.delivered === true, receiverStatus: number(value.status_code), message: value.delivered === true ? 'The receiver accepted the test notification.' : 'The receiver did not accept the test. Check its URL and signature configuration.' };
  }
  const { connector, assignments } = await ownedConnector(input.connectorId, receipts);
  // Configure also starts ingestion; validate existing routes before every action that can start writes.
  if (input.action !== 'pause') {
    const sources = await native(`/connectors/${encodeURIComponent(connector.id)}/resources`, 'GET', 'Verify the destinations of configured sources', receipts, undefined, connector.database);
    if (!Array.isArray(sources.resources) || sources.has_more === true || sources.next_cursor) throw new ConnectionScopeError('The complete resource destination list could not be verified. Sync was not started.');
    if (list(sources.resources).some(source => {
      if (!string(source.resource_id ?? source.id)) return true;
      const inherited = databaseFrom(source, connector.database);
      const targetName = databaseFrom({ database: source.database_override, tenant_id: source.tenant_id_override }, inherited);
      const target = destination(targetName, assignments);
      return !target || target.workspace !== connector.workspace;
    })) throw new ConnectionScopeError('A source routes outside this connection’s workspace or to an unverified database. Review its destination before starting sync.');
  }
  if (input.action === 'configure') {
    await native(`/connectors/${encodeURIComponent(connector.id)}/configure`, 'POST', 'Select knowledge sources and start the first sync', receipts, {
      lookback_days: input.lookbackDays, resources: input.resources.map(resource => ({ resource_id: resource.id, resource_type: resource.type, name: resource.name, database: connector.database, collection: connector.collection })),
    }, connector.database);
    return { receipts, message: 'Sources selected. HydraDB has started ingestion; check status for progress and failures.' };
  }
  await native(`/connectors/${encodeURIComponent(connector.id)}/${input.action}`, 'POST', `${input.action === 'sync' ? 'Request a sync for' : input.action === 'pause' ? 'Pause' : 'Resume'} the connector`, receipts, undefined, connector.database);
  return { receipts, message: input.action === 'sync' ? 'Sync requested. This confirms the request, not that indexing has finished.' : input.action === 'pause' ? 'Scheduled syncs are paused. An active sync stops at its next step.' : 'Scheduled syncs resumed from their saved position.' };
};
