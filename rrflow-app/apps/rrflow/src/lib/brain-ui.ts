import 'server-only';
import { randomUUID } from 'node:crypto';
import { getBrain } from './knowledge';
import { brainCatalog, type BrainId } from './contracts';
import { trackEvent } from './raindrop';
import { BRAIN_UI_CATALOG, type BrainUiMessage, type BrainUiModel, type BrainUiComponent } from './brain-ui-contracts';
import type { ServiceReceipt } from './mesh-contracts';

const composition = (stack: BrainId): BrainId[] => [...new Set<BrainId>(['core', stack, ...(['react', 'nextjs'].includes(stack) ? ['typescript' as const] : [])])];

export const streamBrainWorkspace = async (input: { goal: string; stack: BrainId }, emit: (message: BrainUiMessage) => void, verificationRun = false) => {
  const ids = composition(input.stack);
  const eventId = randomUUID();
  const model: BrainUiModel = {
    eventId, ...input, database: process.env.HYDRA_DB_DATABASE || 'seniordev', collection: process.env.HYDRA_DB_COLLECTION || 'rrflow', startedAt: new Date().toISOString(),
    status: { phase: 'loading', completed: 0, total: ids.length, message: 'Loading the engineering core and your specialists from HydraDB…' },
    brains: [], avenues: [], failures: [], receipts: [], observation: { status: 'waiting' },
  };
  emit({ version: 'v0.9.1', createSurface: { surfaceId: eventId, catalogId: BRAIN_UI_CATALOG } });
  const update = () => {
    const components: BrainUiComponent[] = [
      { id: 'status', component: 'WorkflowStatus', path: '/status' },
      ...model.brains.map((_, index): BrainUiComponent => ({ id: `brain-${index}`, component: 'BrainSummary', path: `/brains/${index}` })),
      ...model.avenues.map((_, index): BrainUiComponent => ({ id: `avenue-${index}`, component: 'AvenueCard', path: `/avenues/${index}` })),
      { id: 'observation', component: 'Observation', path: '/observation' },
    ];
    emit({ version: 'v0.9.1', updateDataModel: { surfaceId: eventId, path: '/', value: model } });
    emit({ version: 'v0.9.1', updateComponents: { surfaceId: eventId, components: [{ id: 'root', component: 'Column', children: components.map(component => component.id) }, ...components] } });
  };
  update();
  const terms = [...new Set(input.goal.toLowerCase().match(/[a-z][a-z0-9]{3,}/g) || [])];
  // Parallel native reads: each completed brain can render while slower reads continue.
  await Promise.all(ids.map(async id => {
    const receipts: ServiceReceipt[] = [];
    const started = performance.now();
    try {
      const detail = await getBrain(id, receipts);
      if (!detail || !detail.avenues.length) throw new Error('No research avenues are available. Import the research from Connections, then retry.');
      model.brains.push({ brain: detail.brain, requestIds: detail.requestIds, latencyMs: Math.round(performance.now() - started) });
      model.brains.sort((a, b) => ids.indexOf(a.brain.id) - ids.indexOf(b.brain.id));
      const ranked = detail.avenues.map(avenue => {
        const content = `${avenue.title} ${avenue.questions.map(question => question.text).join(' ')}`.toLowerCase();
        return { avenue, matches: terms.filter(term => content.includes(term)) };
      }).sort((a, b) => b.matches.length - a.matches.length || a.avenue.order - b.avenue.order);
      for (const { avenue, matches } of ranked.slice(0, 3)) model.avenues.push({
        ...avenue, brainId: id, sourceTitle: detail.brain.sourceTitle, sourceUrl: detail.brain.sourceUrl, revision: detail.brain.revision,
        selection: matches.length ? `Matches words in your goal: ${matches.join(', ')}.` : 'Foundation avenue in source order; no matching goal words.',
      });
      model.avenues.sort((a, b) => ids.indexOf(a.brainId) - ids.indexOf(b.brainId));
    } catch (error) {
      model.failures.push({ brainId: id, message: error instanceof Error ? error.message : `${brainCatalog[id].name} could not be loaded.` });
    } finally {
      model.receipts.push(...receipts);
      model.status.completed += 1;
      model.status.message = `${model.status.completed} of ${ids.length} knowledge reads finished. ${model.brains.length} available.`;
      update();
    }
  }));
  model.status.phase = model.failures.length ? model.brains.length ? 'partial' : 'failed' : 'ready';
  model.status.message = model.status.phase === 'ready' ? 'Your knowledge workspace is ready. Open an avenue to see what needs checking.' : model.status.phase === 'partial' ? 'Some knowledge is available. Retry to load the missing specialists.' : 'Knowledge could not be loaded. Check the connection, then retry.';
  model.observation = { status: 'pending' };
  update();
  // Evidence has already been sent. This awaited delivery cannot delay its first render.
  const delivery = await trackEvent({
    event_id: eventId, user_id: verificationRun ? 'rrflow-playwright' : 'jesse', event: 'brain_ui_generated',
    properties: { kind: 'deterministic_knowledge_ui', verification_run: verificationRun, protocol: 'a2ui-v0.9.1', catalog: BRAIN_UI_CATALOG, outcome: model.status.phase, brains: model.brains.map(item => item.brain.id), avenues: model.avenues.length, failed_brains: model.failures.map(item => item.brainId), hydradb_request_ids: model.brains.flatMap(item => item.requestIds), revisions: model.brains.map(item => item.brain.revision) },
  }, 'Reported brain-generated interface quality to Raindrop');
  if (delivery.receipt) model.receipts.push(delivery.receipt);
  model.observation = {
    status: delivery.status, ...(delivery.error ? { error: delivery.error } : {}),
    ...(delivery.status === 'accepted' ? { eventUrl: `https://app.raindrop.ai/events?project=${encodeURIComponent(process.env.RAINDROP_PROJECT_ID || 'rrflow-hydradb')}&event=${eventId}` } : {}),
  };
  update();
};
