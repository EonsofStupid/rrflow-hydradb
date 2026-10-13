import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { learningEvidenceSchema, reviewedLessonSchema, type LearningSnapshot, type lessonInputSchema, type ReviewedLesson } from './learning-contracts';
import { listItems } from './explore';
import { trackEvent } from './raindrop';

const database = 'rrflow_specialist';
const collection = 'rrflow_learning';
const native = async (query: string, params: Record<string, unknown>, requestIds: string[]) => {
  const key = process.env.HYDRA_DB_API_KEY;
  if (!key) throw new Error('Start through Infisical to read learning evidence.');
  const response = await fetch('https://api.hydradb.com/byog/query', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${key}`, 'API-Version': '2', 'Content-Type': 'application/json' }, body: JSON.stringify({ database, collection, query, params }) });
  if (!response.ok) throw new Error(`HydraDB evidence request failed (HTTP ${response.status}).`);
  const body = z.object({ success: z.literal(true), data: z.array(z.object({ state: z.string() })), meta: z.object({ request_id: z.string().optional() }).optional() }).parse(await response.json());
  const id = body.meta?.request_id ?? response.headers.get('x-request-id'); if (id) requestIds.push(id);
  return body.data.map(item => JSON.parse(item.state) as unknown);
};
export const readLearning = async (): Promise<LearningSnapshot> => {
  const result: LearningSnapshot = { evidence: [], lessons: [], dogfood: [], checkedAt: new Date().toISOString(), errors: [], requestIds: [] };
  const [evidence, lessons, dogfood] = await Promise.allSettled([
    native('MATCH (e:LearningEvidence) RETURN e.state AS state ORDER BY e.at DESC LIMIT 20', {}, result.requestIds).then(rows => z.array(learningEvidenceSchema).parse(rows)),
    native('MATCH (l:ReviewedLesson) RETURN l.state AS state ORDER BY l.at DESC LIMIT 20', {}, result.requestIds).then(rows => z.array(reviewedLessonSchema).parse(rows)),
    listItems(database, { kind: 'knowledge', page: 1, pageSize: 100 }),
  ]);
  if (evidence.status === 'fulfilled') result.evidence = evidence.value.sort((a, b) => b.at.localeCompare(a.at)); else result.errors.push('CI evidence could not be read. Its status is unknown until refresh succeeds.');
  if (lessons.status === 'fulfilled') result.lessons = lessons.value; else result.errors.push('Reviewed lessons could not be read.');
  if (dogfood.status === 'fulfilled') {
    if (dogfood.value.requestId) result.requestIds.push(dogfood.value.requestId);
    result.dogfood = dogfood.value.items.filter(item => item.id.startsWith('workspace:')).map(item => ({ id: item.id, title: item.title, at: item.timestamp, path: typeof item.additionalMetadata.path === 'string' ? item.additionalMetadata.path : null, sha256: typeof item.additionalMetadata.sha256 === 'string' ? item.additionalMetadata.sha256 : null })).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')).slice(0, 8);
  } else result.errors.push('Workspace dogfooding documents could not be read.');
  return result;
};

export const saveReviewedLesson = async (input: z.infer<typeof lessonInputSchema>, verification: boolean) => {
  const requestIds: string[] = [];
  const records = await native('MATCH (e:LearningEvidence) WHERE e.ext_id IN $ids RETURN e.state AS state', { ids: [input.evidenceId, input.validationEvidenceId].filter(Boolean) }, requestIds);
  const evidence = z.array(learningEvidenceSchema).parse(records);
  const failed = evidence.find(item => item.id === input.evidenceId);
  const matching = failed?.checks.filter(item => item.name === input.checkName && item.rule.id === input.checkRuleId && item.status === 'failed') ?? [];
  const check = matching.length === 1 ? matching[0] : undefined;
  if (!failed || !check) throw new Error('Choose a recorded failing check. Its source and rule must be verifiable before saving a lesson.');
  const validation = evidence.find(item => item.id === input.validationEvidenceId);
  if (input.validationEvidenceId && (!validation || validation.repository !== failed.repository || validation.commit === failed.commit || Date.parse(validation.at) <= Date.parse(failed.at) || validation.conclusion !== 'passed' || validation.checks.filter(item => item.name === check.name && item.rule.id === check.rule.id && item.sourcePath === check.sourcePath && item.status === 'passed').length !== 1)) throw new Error('The follow-up must be a later passing run of this same check on a different commit in the same repository.');
  const at = new Date().toISOString();
  const id = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const lesson: ReviewedLesson = { ...input, id, at, sourceCommit: failed.commit, rule: check.rule, status: validation ? 'reviewed-with-follow-up' : 'candidate', validationCommit: validation?.commit ?? null };
  const stored = z.array(reviewedLessonSchema).parse(await native('MERGE (l:ReviewedLesson {ext_id: $id}) SET l.state = $state, l.at = $at RETURN l.state AS state', { id, state: JSON.stringify(lesson), at }, requestIds));
  if (stored.length !== 1 || JSON.stringify(stored[0]) !== JSON.stringify(lesson)) throw new Error('HydraDB did not confirm the saved lesson. Refresh before retrying.');
  let ingestion: 'accepted' | 'failed' = 'failed';
  try {
    const form = new FormData(); form.set('database', database); form.set('collection', 'rrflow_lessons'); form.set('type', 'knowledge'); form.set('upsert', 'true');
    form.set('app_knowledge', JSON.stringify([{ id: `reviewed-lesson:${id}`, title: `Reviewed lesson: ${check.name}`, type: 'reviewed_lesson', timestamp: at, content: { text: `Human-reviewed diagnosis: ${input.cause}\nCorrection: ${input.correction}\nPractice for future work: ${input.practice}\nRule: ${check.rule.title}\nRule source: ${check.rule.sourceUrl}\nOriginal commit: ${failed.commit}\nFollow-up commit: ${validation?.commit ?? 'Not verified'}\nState: ${lesson.status}. A passing follow-up is evidence, not proof of causation.` }, additional_metadata: { workspace: 'shippin', evidence_id: failed.id, lesson_id: id, rule_id: check.rule.id, status: lesson.status, verification_run: verification } }]));
    const response = await fetch('https://api.hydradb.com/context/ingest', { method: 'POST', headers: { Authorization: `Bearer ${process.env.HYDRA_DB_API_KEY}`, 'API-Version': '2' }, body: form, signal: AbortSignal.timeout(20_000) });
    if (response.ok) { const body = await response.json(); if (body.success === true && !body.data?.failed_count && body.data?.results?.some((item: { id?: string; status?: string; error?: string }) => item.id === `reviewed-lesson:${id}` && !item.error && ['queued', 'processing', 'completed'].includes(item.status ?? ''))) ingestion = 'accepted'; }
  } catch { /* Canonical reviewed lesson remains saved; retrieval ingestion is separately reported. */ }
  const telemetry = await trackEvent({ event_id: `reviewed-lesson-${id}`, user_id: verification ? 'rrflow-playwright' : 'jesse', event: 'reviewed_learning_evidence', properties: { status: lesson.status, source_commit: failed.commit, validation_commit: validation?.commit ?? null, rule_id: check.rule.id, verification_run: verification } }, 'Record reviewed learning evidence');
  return { lesson, ingestion, telemetry: telemetry.status, requestIds };
};
