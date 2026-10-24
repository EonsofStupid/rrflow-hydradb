import { z } from 'zod';
import type { ServiceReceipt } from './mesh-contracts';
import { createDatabaseSchema, type DatabaseWorkspace } from './databases-contracts';

const id = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_.:-]+$/);
const shortText = z.string().trim().min(1).max(200);
export const publicWebhookUrl = z.string().trim().max(2000).url().refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      && url.port !== '0' && (!url.port || url.port === '443') && url.hostname.includes('.')
      && !/(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname);
  } catch { return false; }
}, 'Use a public HTTPS endpoint on port 443, without credentials, query parameters, or a fragment.');

export const connectionsActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), provider: id, name: shortText, database: createDatabaseSchema.shape.name,
    account: z.string().trim().max(200), credentials: z.record(z.string().min(1).max(100), z.json()).refine(value =>
      Object.keys(value).length <= 40 && JSON.stringify(value).length <= 24_000, 'Credentials are too large.'),
    instructions: z.string().trim().max(4000).default('') }).strict(),
  z.object({ action: z.literal('configure'), connectorId: id,
    resources: z.array(z.object({ id: shortText, name: shortText, type: shortText }).strict()).min(1).max(100),
    lookbackDays: z.number().int().min(1).max(365).default(30) }).strict(),
  z.object({ action: z.enum(['sync', 'pause', 'resume']), connectorId: id }).strict(),
  z.object({ action: z.literal('register-webhook'), url: publicWebhookUrl,
    generateSecret: z.boolean(), acknowledgeOrganization: z.literal(true) }).strict(),
  z.object({ action: z.literal('test-webhook') }).strict(),
]);
export type ConnectionsAction = z.infer<typeof connectionsActionSchema>;
export const connectionsQuerySchema = z.discriminatedUnion('view', [
  z.object({ view: z.literal('overview') }).strict(),
  z.object({ view: z.literal('provider'), provider: id }).strict(),
  z.object({ view: z.literal('connector'), connectorId: id }).strict(),
  z.object({ view: z.literal('discover'), connectorId: id, cursor: z.string().max(2000).optional() }).strict(),
]);
export type ConnectionsQuery = z.infer<typeof connectionsQuerySchema>;
export type ProviderItem = { id: string; category: string; webhook: boolean; beta: boolean };
export type CredentialField = { name: string; description: string; type: string; required: boolean };
export type ProviderDetail = { id: string; objectTypes: string[]; fields: CredentialField[]; complexCredentials: boolean; setup: string | null; scopes: string[] };
export type ConnectorItem = {
  id: string; name: string; provider: string; database: string; workspace: DatabaseWorkspace; collection: string;
  lifecycle: string; syncStatus: string; lastAttempt: string | null; lastSuccess: string | null;
  nextSync: string | null; dispatched: number | null; resources: number | null; needsAttention: boolean;
};
export type ResourceItem = { id: string; name: string; type: string };
export type ConnectorDetail = { connector: ConnectorItem; health: string; resources: { id: string; name: string; status: string; rows: number | null }[] };
export type WebhookState = { registered: boolean; url: string | null; signing: boolean; events: string[] };
export type DeliveryItem = { id: string; status: string; indexingStatus: string; at: string | null; attempts: number | null; source: string | null; url: string | null };
export type ConnectionDestination = { name: string; workspace: DatabaseWorkspace; label: string };
export type UnassignedConnection = { id: string; provider: string; database: string; reason: string };
export type ConnectionsOverview = { providers: ProviderItem[]; destinations: ConnectionDestination[]; connectors: ConnectorItem[]; unassigned: UnassignedConnection[]; connectorListAvailable: boolean; webhook: WebhookState | null; deliveries: DeliveryItem[]; warnings: string[]; checkedAt: string };
export type ConnectionsResponse = {
  receipts: ServiceReceipt[]; error?: string; message?: string; overview?: ConnectionsOverview;
  provider?: ProviderDetail; connector?: ConnectorItem; detail?: ConnectorDetail;
  discovery?: { resources: ResourceItem[]; nextCursor: string | null };
  webhook?: WebhookState; signingSecret?: string; delivered?: boolean; receiverStatus?: number | null;
};
