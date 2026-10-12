import { z } from 'zod';

export const brainIds = ['core', 'rust', 'go', 'react', 'nextjs', 'typescript'] as const;
export const brainIdSchema = z.enum(brainIds);
export type BrainId = z.infer<typeof brainIdSchema>;

export const brainSchema = z.object({
  id: brainIdSchema, name: z.string(), subtitle: z.string(), description: z.string(),
  color: z.string(), kind: z.string(), questions: z.number(), avenues: z.number(),
  sourceTitle: z.string(), sourceUrl: z.string().url(), revision: z.string(),
});
export type Brain = z.infer<typeof brainSchema>;
export const questionSchema = z.object({ id: z.string(), text: z.string(), term: z.string(), binding: z.string(), order: z.number() });
export type Question = z.infer<typeof questionSchema>;
export const avenueSchema = z.object({ id: z.string(), title: z.string(), domain: z.string(), order: z.number(), questions: z.array(questionSchema) });
export type Avenue = z.infer<typeof avenueSchema>;
export type BrainDetail = { brain: Brain; avenues: Avenue[]; requestIds: string[] };
export const runSchema = z.object({
  id: z.string().uuid(), goal: z.string(), stack: brainIdSchema, createdAt: z.string(),
  status: z.literal('needs_evidence'), brainIds: z.array(brainIdSchema),
  avenueCount: z.number(), questionCount: z.number(),
});
export type ReviewRun = z.infer<typeof runSchema>;
export type Workspace = { brains: Brain[]; runs: ReviewRun[]; edges: { source: string; target: string; kind: string }[]; evidence?: { database: string; collection: string; requestIds: string[] }; connected: boolean; checkedAt: string; error?: string };
export const newRunSchema = z.object({
  id: z.string().uuid(),
  goal: z.string().trim().min(8, 'Describe the work in at least 8 characters.').max(1000),
  stack: brainIdSchema.exclude(['core']),
});
export const brainCatalog: Record<BrainId, { name: string; subtitle: string; description: string; color: string; kind: string }> = {
  core: { name: 'Engineering core', subtitle: 'SWEBOK-aligned', description: 'The shared foundation. Requirements, architecture, security, and proof that the work is done.', color: 'violet', kind: 'Foundation' },
  rust: { name: 'Rust', subtitle: 'Systems & safety', description: 'Ownership, lifetimes, safe concurrency, and deliberate failure handling.', color: 'orange', kind: 'Specialist' },
  go: { name: 'Go', subtitle: 'Services & concurrency', description: 'Clear interfaces, bounded goroutines, reliable services, and simple delivery.', color: 'cyan', kind: 'Specialist' },
  react: { name: 'React', subtitle: 'Interfaces & interaction', description: 'State, accessible interactions, component boundaries, and responsive experiences.', color: 'blue', kind: 'Specialist' },
  nextjs: { name: 'Next.js', subtitle: 'Full-stack experiences', description: 'Server and client boundaries, data access, streaming, and production readiness.', color: 'slate', kind: 'Specialist' },
  typescript: { name: 'TypeScript', subtitle: 'Contracts & correctness', description: 'Types that describe real data, checked boundaries, and dependable contracts.', color: 'indigo', kind: 'Composable' },
};

