import { z } from 'zod';
import type { ExploreItem } from './explore-contracts';

export const organizationDatabases = ['default-tenant', 'rrflow_specialist', 'shippin_cloud', 'shippin_ai', 'shipping_buzz'] as const;
export const organizationDatabaseSchema = z.enum(organizationDatabases);
export const destinationSchema = z.enum(['personal', 'shippin', 'review']);
export type Destination = z.infer<typeof destinationSchema>;
export const destinationNames = { personal: 'Personal', shippin: 'Shippin work', review: 'Needs review' } as const;
export const organizationDatabaseNames: Record<typeof organizationDatabases[number], string> = {
  'default-tenant': 'Personal inbox · Gmail & repositories', rrflow_specialist: 'Shippin · company knowledge',
  shippin_cloud: 'shippin.cloud', shippin_ai: 'shippin.ai', shipping_buzz: 'shipping.buzz',
};
export const decisionSchema = z.object({
  key: z.string(), destination: destinationSchema, note: z.string(), updatedAt: z.string(), sourceVersion: z.string(),
});
export type OrganizationDecision = z.infer<typeof decisionSchema>;
export type OrganizationItem = {
  key: string; source: ExploreItem; sourceVersion: string; provider: string;
  suggested: Destination; destination: Destination; reason: string; matchedProject: string | null;
  decision: OrganizationDecision | null; changedSinceReview: boolean;
};
export type OrganizationSnapshot = {
  database: typeof organizationDatabases[number]; items: OrganizationItem[]; checkedAt: string;
  requestIds: string[]; errors: string[]; decisionsAvailable: boolean; sampleLimit: number;
};
export const organizationInputSchema = z.object({
  database: organizationDatabaseSchema, key: z.string().regex(/^[a-f0-9]{64}$/),
  sourceVersion: z.string().regex(/^[a-f0-9]{64}$/), destination: destinationSchema,
  note: z.string().trim().max(240).default(''), expectedUpdatedAt: z.string().datetime().nullable(),
}).strict();

/** Conservative rules: inbox membership alone never proves personal intent. */
export const suggestOrganization = (source: ExploreItem, database: string): { destination: Destination; reason: string; matchedProject: string | null } => {
  const explicit = [source.metadata.workspace, source.additionalMetadata.workspace].filter(value => typeof value === 'string').map(value => String(value).toLowerCase());
  if (explicit.includes('personal') && explicit.some(value => ['shippin', 'business', 'work'].includes(value))) return { destination: 'review', reason: 'The source has conflicting Personal and work labels. Your decision is needed.', matchedProject: null };
  if (explicit.includes('personal')) return { destination: 'personal', reason: 'The source explicitly carries a Personal workspace label.', matchedProject: null };
  if (explicit.some(value => ['shippin', 'business', 'work'].includes(value))) return { destination: 'shippin', reason: 'The source explicitly carries a work workspace label.', matchedProject: null };
  const text = [source.title, ...['repository', 'repo', 'url', 'source_url', 'project'].flatMap(key => [source.metadata[key], source.additionalMetadata[key]])].filter(value => typeof value === 'string').join(' ').toLowerCase();
  const projects = ['shippin.cloud', 'shippin.ai', 'shipping.buzz'].filter(project => new RegExp(`(^|[^a-z0-9.-])${project.replace('.', '\\.')}(?=$|[^a-z0-9.-])`).test(text));
  if (projects.length > 1) return { destination: 'review', reason: 'More than one Shippin service is mentioned. Review which project should use this context.', matchedProject: null };
  if (projects.length === 1) return { destination: 'shippin', reason: `The title or source metadata explicitly mentions ${projects[0]}. This is a suggestion, not a content assessment.`, matchedProject: projects[0] };
  if (database !== 'default-tenant') return { destination: 'shippin', reason: 'This source already lives in a dedicated Shippin database. Its existing workspace provides the routing signal.', matchedProject: database === 'rrflow_specialist' ? null : organizationDatabaseNames[database as keyof typeof organizationDatabaseNames] ?? null };
  return { destination: 'review', reason: 'There is no explicit workspace or Shippin project signal. Inbox location alone cannot tell us whether this is personal or work.', matchedProject: null };
};
