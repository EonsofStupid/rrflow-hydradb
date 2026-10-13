import { z } from 'zod';

export const PUBLIC_DEMO_DATABASE = 'rrflow_public_demo';
export const PUBLIC_DEMO_COLLECTION = 'rrflow_demo';
export const PUBLIC_DEMO_ID = 'v1';
const repository = 'EonsofStupid/rrflow-hydradb';
export const publicDemoSourceIds = ['personal-reading', 'personal-weekend', 'personal-learning', 'work-overview', 'work-context', 'work-sync'] as const;
const workPaths: Record<string, string> = {
  'work-overview': 'rrflow-app/README.md',
  'work-context': 'rrflow-app/docs/rrflow/CONTEXT_AND_LEARNING.md',
  'work-sync': 'rrflow-app/docs/rrflow/GITHUB_SYNC.md',
};
const pinnedSource = (url: string, path: string) => {
  const prefix = `https://github.com/${repository}/blob/`;
  if (!url.startsWith(prefix)) return false;
  const rest = url.slice(prefix.length);
  return /^[a-f0-9]{40}\//.test(rest) && rest.slice(41) === path;
};
const sourceSchema = z.object({
  id: z.enum(publicDemoSourceIds), title: z.string().min(1).max(160),
  scope: z.enum(['personal', 'shippin', 'review']), kind: z.enum(['illustrative', 'public-repository']),
  summary: z.string().min(1).max(1200), reason: z.string().min(1).max(800), sourceUrl: z.string().max(500).nullable(),
}).strict().superRefine((source, context) => {
  if (source.id.startsWith('personal-')) {
    if (source.scope !== 'personal' || source.kind !== 'illustrative' || source.sourceUrl !== null) context.addIssue({ code: 'custom', message: 'Personal demo examples must be illustrative and have no private source link.' });
  } else if (source.scope !== 'shippin' || source.kind !== 'public-repository' || !source.sourceUrl || !pinnedSource(source.sourceUrl, workPaths[source.id])) {
    context.addIssue({ code: 'custom', message: 'Work demo sources must use an explicitly allowed public document at a pinned revision.' });
  }
});

export const publicDemoSnapshotSchema = z.object({
  version: z.literal(1), updatedAt: z.string().datetime(), sources: z.array(sourceSchema).length(6),
  learning: z.object({
    failureRunUrl: z.literal(`https://github.com/${repository}/actions/runs/38321136137`),
    passingRunUrl: z.literal(`https://github.com/${repository}/actions/runs/38322254472`),
    ruleUrl: z.literal(`https://github.com/${repository}/blob/8775997805e99a430cd8aba4a049b4ba35d90a0e/rrflow-app/apps/rrflow/tests/connectome.spec.ts#L44`),
    cause: z.string().min(1).max(1200), correction: z.string().min(1).max(1200), practice: z.string().min(1).max(1200),
  }).strict(),
}).strict().refine(snapshot => new Set(snapshot.sources.map(source => source.id)).size === 6, 'The curated source identities must be unique.');

export type PublicDemoSnapshot = z.infer<typeof publicDemoSnapshotSchema>;
export type PublicDemoResponse = {
  snapshot: PublicDemoSnapshot | null;
  checkedAt: string;
  requestId: string | null;
  storage: 'HydraDB';
  error?: string;
};
