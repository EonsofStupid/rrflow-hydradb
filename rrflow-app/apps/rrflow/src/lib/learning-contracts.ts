import { z } from 'zod';

const checkStatus = z.enum(['passed', 'failed', 'skipped', 'unknown']);
const sourceUrl = z.string().url().startsWith('https://github.com/EonsofStupid/rrflow-hydradb/blob/');
export const learningEvidenceSchema = z.object({
  version: z.literal(1), id: z.string().regex(/^learning-[a-f0-9]{32}$/), kind: z.enum(['ci', 'local-verification']), repository: z.literal('EonsofStupid/rrflow-hydradb'), commit: z.string().regex(/^[a-f0-9]{40}$/), runUrl: z.string().url().startsWith('https://github.com/EonsofStupid/rrflow-hydradb/actions/runs/').nullable(), at: z.iso.datetime(), conclusion: z.enum(['passed', 'failed', 'unknown']),
  checks: z.array(z.object({ name: z.string().min(1).max(250), status: checkStatus, sourcePath: z.string().nullable(), line: z.number().int().min(1).nullable(), rule: z.object({ id: z.string().min(1).max(100), title: z.string().min(1).max(250), sourceUrl, explanation: z.string().min(1).max(1000) }).strict() }).strict()).min(1).max(1000),
  schema: z.object({ version: z.literal('1.0'), path: z.literal('rrflow-app/scripts/learning-evidence.schema.json'), sha256: z.string().regex(/^[a-f0-9]{64}$/), sourceUrl }).strict(),
  capture: z.object({ mode: z.enum(['automatic-ci', 'local-verification', 'imported-ci']), tool: z.literal('Playwright + GitHub Actions') }).strict(),
}).strict();
export type LearningEvidence = z.infer<typeof learningEvidenceSchema>;
export const lessonInputSchema = z.object({
  evidenceId: z.string().min(1).max(250), checkName: z.string().min(1).max(250), checkRuleId: z.string().min(1).max(100),
  cause: z.string().trim().min(8).max(800), correction: z.string().trim().min(8).max(800), practice: z.string().trim().min(8).max(800),
  validationEvidenceId: z.string().max(250).nullable(),
}).strict();
export const reviewedLessonSchema = lessonInputSchema.extend({
  id: z.string(), at: z.string(), sourceCommit: z.string(), rule: learningEvidenceSchema.shape.checks.element.shape.rule,
  status: z.enum(['candidate', 'reviewed-with-follow-up']), validationCommit: z.string().nullable(),
});
export type ReviewedLesson = z.infer<typeof reviewedLessonSchema>;
export type LearningSnapshot = {
  evidence: LearningEvidence[]; lessons: ReviewedLesson[];
  dogfood: { id: string; title: string; at: string | null; path: string | null; sha256: string | null }[];
  checkedAt: string; errors: string[]; requestIds: string[];
};
