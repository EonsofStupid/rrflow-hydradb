import { z } from 'zod';

/**
 * The brain mesh: each brain is its own HydraDB database (a hard isolation
 * boundary), so RRFLOW reads them side by side rather than in one query.
 */
export const meshBrainIds = ['rrflow_specialist', 'shippin_cloud', 'shippin_ai', 'shipping_buzz', 'seniordev'] as const;
export const meshBrainIdSchema = z.enum(meshBrainIds);
export type MeshBrainId = z.infer<typeof meshBrainIdSchema>;
export type MeshRole = 'company' | 'service' | 'practice';

export const meshCatalog: Record<MeshBrainId, { name: string; role: MeshRole; purpose: string }> = {
  rrflow_specialist: {
    name: 'Company brain',
    role: 'company',
    purpose: 'The company knowledge scope for team decisions, plans and research.',
  },
  shippin_cloud: {
    name: 'shippin.cloud',
    role: 'service',
    purpose: 'Dedicated specialist for the cloud platform: its setup, launch checks and history.',
  },
  shippin_ai: {
    name: 'shippin.ai',
    role: 'service',
    purpose: 'Dedicated specialist for the AI product: its setup, launch checks and history.',
  },
  shipping_buzz: {
    name: 'shipping.buzz',
    role: 'service',
    purpose: 'Dedicated specialist for shipping.buzz: its setup, launch checks and history.',
  },
  seniordev: {
    name: 'Senior dev practices',
    role: 'practice',
    purpose: 'Recorded lessons and tool quirks for the team to consult during future work.',
  },
};

/** Brains are grouped by project so it is always clear which knowledge belongs to which work. */
export type ProjectGroup = 'shippin' | 'practice';
export const meshGroupOf: Record<MeshBrainId, ProjectGroup> = {
  rrflow_specialist: 'shippin', shippin_cloud: 'shippin', shippin_ai: 'shippin', shipping_buzz: 'shippin', seniordev: 'practice',
};
export const projectGroups: Record<ProjectGroup, { name: string; summary: string }> = {
  shippin: {
    name: 'Shippin cluster',
    summary: 'shippin.cloud, shippin.ai and shipping.buzz, each with its own specialist brain, sharing one company brain for context.',
  },
  practice: {
    name: 'Engineering practice',
    summary: 'Lessons and tool quirks RRFLOW applies to every project, not tied to one service.',
  },
};

/** One document held in a brain, as listed by HydraDB. */
export type ContextSource = { id: string; title: string; kind: string | null; updatedAt: string | null };

export type BrainState = 'ready' | 'warming_up' | 'unreachable';

export type BrainPulse = {
  id: MeshBrainId;
  state: BrainState;
  memories: number | null;
  knowledge: number | null;
  latencyMs: number | null;
  requestId: string | null;
  error?: string;
  statsError?: string;
  statsRequestId?: string | null;
};

export type LearningItem = {
  id: string;
  brain: MeshBrainId;
  title: string;
  kind: string;
  tool: string | null;
  agent: string | null;
  at: string | null;
  evidence: string | null;
};

/**
 * One real HTTP call RRFLOW made to an outside service, returned to the browser
 * so every action can show exactly what happened. Built from the actual
 * response; never from a template.
 */
export type ServiceReceipt = {
  service: 'HydraDB' | 'Raindrop';
  /** What the call was for, in plain words. */
  action: string;
  method: 'GET' | 'POST';
  endpoint: string;
  database: string | null;
  httpStatus: number | null;
  outcome: 'ok' | 'failed';
  requestId: string | null;
  latencyMs: number | null;
  at: string;
  error?: string;
};

export type MeshSnapshot = {
  connected: boolean;
  checkedAt: string;
  brains: BrainPulse[];
  learning: LearningItem[];
  learningError?: string;
  learningRequestId?: string | null;
  /** Whether answers are being reported to Raindrop for quality monitoring. */
  isMonitored: boolean;
  /** The Raindrop project this server reports to, or null when reporting is off. */
  raindropProject: string | null;
  /** What the Shippin cluster's company brain actually holds, listed live. */
  shippinContext: { sources: ContextSource[]; total: number | null; requestId: string | null; error?: string };
  /** Databases on this HydraDB key that are not part of the mesh; null if the listing failed. */
  otherDatabases: string[] | null;
  receipts: ServiceReceipt[];
  error?: string;
};

/** Result of the "Verify with HydraDB" check: live calls made just now, nothing cached. */
export type VerifyResult = {
  checkedAt: string;
  databases: string[];
  brains: { id: MeshBrainId; isListed: boolean; isReady: boolean | null; memories: number | null; knowledge: number | null }[];
  isHealthy: boolean;
  receipts: ServiceReceipt[];
};

export const recallModes = ['fast', 'thinking'] as const;
export type RecallMode = (typeof recallModes)[number];

export const recallInputSchema = z.object({
  brain: meshBrainIdSchema,
  question: z.string().trim().min(3, 'Ask a question of at least 3 characters.').max(500),
  mode: z.enum(recallModes).default('fast'),
});
export type RecallInput = z.infer<typeof recallInputSchema>;

export type RecallHit = { title: string; excerpt: string; sourceId: string | null };

export type RecallResult = {
  eventId: string;
  brain: MeshBrainId;
  question: string;
  mode: RecallMode;
  hits: RecallHit[];
  requestId: string | null;
  latencyMs: number;
  telemetry: { status: 'accepted' | 'failed' | 'not_configured'; error?: string };
  receipts: ServiceReceipt[];
};

export const feedbackInputSchema = z.object({
  eventId: z.string().uuid(),
  isHelpful: z.boolean(),
});
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
