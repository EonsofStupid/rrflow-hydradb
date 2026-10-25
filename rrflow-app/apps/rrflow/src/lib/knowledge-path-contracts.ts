import { z } from 'zod';
import { brainRegistrationSchema, registryWorkspaceSchema } from './brain-registry-contracts';
import { projectContextInput } from './project-context-contracts';

const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1);
const identity = { workspace: registryWorkspaceSchema, brainId: brainRegistrationSchema.shape.id };
export const knowledgeQuerySchema = z.object({ action: z.literal('query'), ...identity,
  expectedBrainRevision: revision, question: z.string().trim().min(8).max(1000), mode: z.enum(['fast', 'thinking']).default('fast'), recordType: z.enum(['knowledge', 'memory']).default('knowledge'),
}).strict();
export const knowledgeOnboardSchema = z.object({ action: z.literal('connect'), project: projectContextInput,
  projectSlug: brainRegistrationSchema.shape.projectSlug, displayName: brainRegistrationSchema.shape.displayName,
  database: brainRegistrationSchema.shape.database, collection: brainRegistrationSchema.shape.collection, expectedRegistryRevision: revision,
}).strict();
export const knowledgeDecisionInput = z.object({ action: z.literal('review'), ...identity, runId: z.string().uuid(),
  expectedPolicyRevision: revision, kind: z.enum(['vision', 'correction']), text: z.string().trim().min(12).max(1600),
  reason: z.string().trim().min(8).max(1000), evidenceFingerprints: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(8),
  replaces: z.string().uuid().nullable(), confirm: z.literal(true),
}).strict().refine(value => value.kind !== 'correction' || value.evidenceFingerprints.length > 0, 'A correction must identify evidence from its run.');
export const knowledgeActionSchema = z.union([knowledgeQuerySchema, knowledgeOnboardSchema, knowledgeDecisionInput]);
export const knowledgeEvidenceSchema = z.object({ sourceId: z.string().min(1).max(500), chunkId: z.string().max(500),
  title: z.string().max(500), excerpt: z.string().max(4000), fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  sourceUrl: z.string().url().nullable(), sourceRevision: z.string().max(100).nullable(), sourceDate: z.string().max(100).nullable(),
  syncedAt: z.string().max(100).nullable(), sourcePath: z.string().max(1000).nullable(),
});
export const knowledgeDecisionSchema = z.object({ id: z.string().uuid(), kind: z.enum(['vision', 'correction']),
  text: z.string().max(1600), reason: z.string().max(1000), runId: z.string().uuid(), at: z.string().datetime(),
  reviewer: z.enum(['workspace-owner', 'playwright-verification']), revision, replaces: z.string().uuid().nullable(),
  evidenceFingerprints: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(8),
});
export const knowledgePolicySchema = z.object({ revision, decisions: z.array(knowledgeDecisionSchema).max(100) });
export const knowledgeRunSchema = z.object({ version: z.literal(1), id: z.string().uuid(), workspace: registryWorkspaceSchema,
  brain: brainRegistrationSchema, projectName: z.string().nullable(), projectRevision: z.string().nullable(),
  question: z.string().max(1000), mode: z.enum(['fast', 'thinking']), recordType: z.enum(['knowledge', 'memory']).default('knowledge'), at: z.string().datetime(), policyRevision: revision,
  guidance: z.array(knowledgeDecisionSchema).max(100), evidence: z.array(knowledgeEvidenceSchema).max(8),
  excluded: z.array(z.object({ fingerprint: z.string(), decisionId: z.string().uuid(), sourceId: z.string() })).max(100),
  rejectedScopeCount: z.number().int().nonnegative(), requestId: z.string().nullable(),
  route: z.array(z.string()).max(10), warnings: z.array(z.string()).max(12),
});
export type KnowledgeRun = z.infer<typeof knowledgeRunSchema>;
export type KnowledgePolicy = z.infer<typeof knowledgePolicySchema>;
export type KnowledgeDecision = z.infer<typeof knowledgeDecisionSchema>;
export type KnowledgeEvidence = z.infer<typeof knowledgeEvidenceSchema>;

/** Recorded claims are independent of source recency; only explicit superseding review retires guidance. */
export const activeDecisions = (policy: KnowledgePolicy) => {
  const ids = new Set<string>(); const superseded = new Set<string>();
  if (policy.revision !== policy.decisions.length) throw new Error('Knowledge policy history is incomplete. Review before use.');
  for (const [index, item] of policy.decisions.entries()) {
    if (ids.has(item.id) || item.revision !== index + 1 || item.replaces && (!ids.has(item.replaces) || superseded.has(item.replaces))) throw new Error('Knowledge policy history is inconsistent. Review before use.');
    if (item.replaces) {
      if (policy.decisions.find(previous => previous.id === item.replaces)?.kind !== item.kind) throw new Error('A correction cannot replace the owner’s vision.');
      superseded.add(item.replaces);
    }
    ids.add(item.id);
  }
  return policy.decisions.filter(item => !superseded.has(item.id));
};
export const applyReviewedKnowledge = (evidence: KnowledgeEvidence[], policy: KnowledgePolicy) => {
  const guidance = activeDecisions(policy);
  const excluded: KnowledgeRun['excluded'] = [];
  const accepted = evidence.filter(item => {
    const correction = guidance.find(decision => decision.kind === 'correction' && decision.evidenceFingerprints.includes(item.fingerprint));
    if (!correction) return true;
    excluded.push({ fingerprint: item.fingerprint, decisionId: correction.id, sourceId: item.sourceId }); return false;
  });
  return { evidence: accepted, guidance, excluded };
};
