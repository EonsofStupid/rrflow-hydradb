import { z } from 'zod';
import { avenueSchema, brainIdSchema, brainSchema } from './contracts';
import { projectContextSchema, projectIdSchema } from './project-context-contracts';

export const BRAIN_UI_CATALOG = 'https://shippin.cloud/a2ui/brain-workspace/v1';
export const brainUiInput = z.object({
  goal: z.string().trim().min(8, 'Describe the work in at least 8 characters.').max(1000),
  stack: brainIdSchema.exclude(['core']),
  projectId: projectIdSchema.optional(),
  projectWorkspace: z.enum(['personal', 'shippin']).optional(),
}).strict();
export const brainUiFeedbackInput = z.object({
  eventId: z.string().uuid(), verdict: z.enum(['helpful', 'missing_context']),
}).strict();

const receiptSchema = z.object({
  service: z.enum(['HydraDB', 'Raindrop']), action: z.string(), method: z.enum(['GET', 'POST']),
  endpoint: z.string(), database: z.string().nullable(), httpStatus: z.number().nullable(),
  outcome: z.enum(['ok', 'failed']), requestId: z.string().nullable(), latencyMs: z.number().nullable(),
  at: z.string(), error: z.string().optional(),
});
export const brainUiModelSchema = z.object({
  eventId: z.string().uuid(), goal: z.string(), stack: brainIdSchema,
  database: z.string(), collection: z.string(), startedAt: z.string(),
  project: projectContextSchema.optional(),
  status: z.object({ phase: z.enum(['loading', 'ready', 'partial', 'failed']), completed: z.number(), total: z.number(), message: z.string() }),
  brains: z.array(z.object({ brain: brainSchema, requestIds: z.array(z.string()), latencyMs: z.number() })),
  avenues: z.array(avenueSchema.extend({ brainId: brainIdSchema, sourceTitle: z.string(), sourceUrl: z.string(), revision: z.string(), selection: z.string() })),
  failures: z.array(z.object({ brainId: brainIdSchema, message: z.string() })),
  receipts: z.array(receiptSchema),
  observation: z.object({ status: z.enum(['waiting', 'pending', 'accepted', 'failed', 'not_configured']), error: z.string().optional(), eventUrl: z.string().url().optional() }),
});
export type BrainUiModel = z.infer<typeof brainUiModelSchema>;

// This client advertises one deliberately small catalog. It never executes server-provided code.
export const brainUiComponentSchema = z.discriminatedUnion('component', [
  z.object({ id: z.string(), component: z.literal('Column'), children: z.array(z.string()).max(80) }).strict(),
  z.object({ id: z.string(), component: z.literal('WorkflowStatus'), path: z.literal('/status') }).strict(),
  z.object({ id: z.string(), component: z.literal('BrainSummary'), path: z.string().regex(/^\/brains\/\d+$/) }).strict(),
  z.object({ id: z.string(), component: z.literal('AvenueCard'), path: z.string().regex(/^\/avenues\/\d+$/) }).strict(),
  z.object({ id: z.string(), component: z.literal('Observation'), path: z.literal('/observation') }).strict(),
]);
export type BrainUiComponent = z.infer<typeof brainUiComponentSchema>;
const surfaceId = z.string().uuid();
const version = z.literal('v0.9.1');
export const brainUiMessageSchema = z.union([
  z.object({ version, createSurface: z.object({ surfaceId, catalogId: z.literal(BRAIN_UI_CATALOG) }).strict() }).strict(),
  z.object({ version, updateComponents: z.object({ surfaceId, components: z.array(brainUiComponentSchema).min(1).max(80) }).strict() }).strict(),
  z.object({ version, updateDataModel: z.object({ surfaceId, path: z.literal('/'), value: brainUiModelSchema }).strict() }).strict(),
  z.object({ version, deleteSurface: z.object({ surfaceId }).strict() }).strict(),
]);
export type BrainUiMessage = z.infer<typeof brainUiMessageSchema>;
export type BrainUiSurface = { id: string; components: Record<string, BrainUiComponent>; model: BrainUiModel | null };

export const applyBrainUiMessage = (surface: BrainUiSurface | null, input: unknown): BrainUiSurface | null => {
  const message = brainUiMessageSchema.parse(input);
  if ('createSurface' in message) {
    if (surface) throw new Error('The interface already exists.');
    return { id: message.createSurface.surfaceId, components: {}, model: null };
  }
  const payload = 'updateComponents' in message ? message.updateComponents : 'updateDataModel' in message ? message.updateDataModel : message.deleteSurface;
  if (!surface || payload.surfaceId !== surface.id) throw new Error('The interface update belongs to a different request.');
  if ('deleteSurface' in message) return null;
  if ('updateDataModel' in message) return { ...surface, model: message.updateDataModel.value };
  const components = { ...surface.components };
  for (const component of message.updateComponents.components) components[component.id] = component;
  if (Object.keys(components).length > 80) throw new Error('The generated interface exceeds its component limit.');
  const visited = new Set<string>();
  const referenced = new Set<string>();
  for (const component of Object.values(components)) if (component.component === 'Column') for (const child of component.children) {
    if (referenced.has(child)) throw new Error('A component may appear only once in this catalog.');
    referenced.add(child);
  }
  const visit = (id: string, ancestors: Set<string>) => {
    if (ancestors.has(id)) throw new Error('The generated interface contains a circular component reference.');
    if (visited.has(id)) return;
    const component = components[id];
    if (component?.component === 'Column') for (const child of component.children) visit(child, new Set([...ancestors, id]));
    visited.add(id);
  };
  for (const id of Object.keys(components)) visit(id, new Set());
  return { ...surface, components };
};

/** JSONL framing tolerates split network chunks and rejects truncated or oversized messages. */
export const readBrainUiStream = async (response: Response, onMessage: (message: BrainUiMessage) => void) => {
  if (!response.body) throw new Error('No interface stream was returned.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  const consume = () => {
    let end: number;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1);
      if (line) onMessage(brainUiMessageSchema.parse(JSON.parse(line)));
    }
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 2_000_000) throw new Error('The interface stream exceeded its size limit.');
      buffer += decoder.decode(chunk.value, { stream: true }); consume();
    }
    buffer += decoder.decode(); consume();
    if (buffer.trim()) throw new Error('The interface stream ended before its last message finished.');
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
};
