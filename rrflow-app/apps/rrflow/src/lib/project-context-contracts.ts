import { z } from 'zod';
import { brainIdSchema } from './contracts';

export const projectIdSchema = z.string().regex(/^project-[a-f0-9]{24}$/);
export const projectContextInput = z.object({
  kind: z.enum(['folder', 'github']),
  location: z.string().trim().min(1).max(1000),
}).strict();
export const projectContextSchema = z.object({
  id: projectIdSchema,
  kind: z.enum(['folder', 'github']),
  name: z.string(), location: z.string(), url: z.string().url().optional(),
  revision: z.string(), revisionKind: z.enum(['metadata_fingerprint', 'git_commit']),
  loadedAt: z.string(), sourceUpdatedAt: z.string().nullable(),
  stack: z.array(brainIdSchema),
  files: z.array(z.string()).max(400),
  manifests: z.array(z.object({ path: z.string(), technologies: z.array(z.string()), checks: z.array(z.string()) })).max(12),
  checks: z.array(z.object({ directory: z.string(), command: z.string(), status: z.literal('not_run') })),
  topics: z.array(z.string()),
  warnings: z.array(z.string()),
  bounds: z.object({ listedFiles: z.number(), inspectedManifests: z.number(), truncated: z.boolean() }),
});
export type ProjectContext = z.infer<typeof projectContextSchema>;
export type ProjectContextInput = z.infer<typeof projectContextInput>;
export const projectSummarySchema = projectContextSchema.pick({ id: true, kind: true, name: true, location: true, revision: true, loadedAt: true, stack: true });
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
