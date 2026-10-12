import 'server-only';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { avenueSchema, brainCatalog, brainIdSchema, brainSchema, newRunSchema, runSchema, type BrainId, type BrainDetail, type Workspace, type ReviewRun } from './contracts';
import type { ServiceReceipt } from './mesh-contracts';

const database = process.env.HYDRA_DB_DATABASE || 'seniordev';
const collection = process.env.HYDRA_DB_COLLECTION || 'rrflow';
const workspaceId = 'shippin';
const graphResponse = z.object({ success: z.boolean(), data: z.unknown(), meta: z.object({ request_id: z.string().optional() }).optional() });

/** Native hosted Cypher transport; callers own the graph model and parameterized queries. */
const query = async <T>(cypher: string, params: Record<string, unknown>, schema: z.ZodType<T>, receipts?: ServiceReceipt[]): Promise<{ data: T; requestId?: string }> => {
  const key = process.env.HYDRA_DB_API_KEY;
  if (!key) throw new Error('HydraDB credential is unavailable. Start this workspace through Infisical.');
  const started = performance.now();
  const receipt: ServiceReceipt = { service: 'HydraDB', action: 'Read versioned engineering knowledge', method: 'POST', endpoint: '/byog/query', database, at: new Date().toISOString(), httpStatus: null, outcome: 'failed', requestId: null, latencyMs: null };
  try {
  const response = await fetch('https://api.hydradb.com/byog/query', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(35_000),
    headers: { Authorization: `Bearer ${key}`, 'API-Version': '2', 'Content-Type': 'application/json' },
    body: JSON.stringify({ database, collection, query: cypher, params }),
  });
  receipt.httpStatus = response.status;
  receipt.requestId = response.headers.get('x-request-id');
  if (!response.ok) throw new Error(`HydraDB request failed (${response.status}). Please retry the operation.`);
  const body = graphResponse.parse(await response.json());
  receipt.requestId = body.meta?.request_id ?? receipt.requestId;
  if (!body.success) throw new Error('HydraDB could not complete this request.');
  const data = schema.parse(body.data);
  receipt.outcome = 'ok';
  return { data, requestId: receipt.requestId ?? undefined };
  } catch (error) {
    receipt.error = error instanceof z.ZodError ? 'HydraDB returned an unexpected knowledge format.' : error instanceof Error ? error.message : 'Knowledge could not be loaded.';
    throw new Error(receipt.error);
  } finally {
    receipt.latencyMs = Math.round(performance.now() - started);
    receipts?.push(receipt);
  }
};

const brainProjection = `b.ext_id AS id, b.name AS name, b.subtitle AS subtitle,
b.description AS description, b.color AS color, b.kind AS kind,
b.questions AS questions, b.avenues AS avenues, b.source_title AS sourceTitle,
b.source_url AS sourceUrl, b.revision AS revision`;
const runProjection = `r.ext_id AS id, r.goal AS goal, r.stack AS stack, r.created_at AS createdAt,
r.status AS status, r.brain_ids AS brainIds, r.avenue_count AS avenueCount, r.question_count AS questionCount`;

export const getWorkspace = async (): Promise<Workspace> => {
  try {
    const [brains, runs, edges] = await Promise.all([
      query(`MATCH (w:Workspace {ext_id: $workspace})-[:HAS_BRAIN]->(b:Brain)
        WHERE b.ready = true RETURN ${brainProjection} ORDER BY b.position LIMIT 20`,
      { workspace: workspaceId }, z.array(brainSchema)),
      query(`MATCH (w:Workspace {ext_id: $workspace})-[:HAS_RUN]->(r:ReviewRun)
        RETURN ${runProjection} ORDER BY r.created_at DESC LIMIT 20`,
      { workspace: workspaceId }, z.array(runSchema)),
      query(`MATCH (a:Brain)-[r]->(b:Brain) RETURN a.ext_id AS source, b.ext_id AS target, type(r) AS kind LIMIT 30`, {}, z.array(z.object({ source: z.string(), target: z.string(), kind: z.string() }))),
    ]);
    return { brains: brains.data, runs: runs.data, edges: edges.data, evidence: { database, collection, requestIds: [brains.requestId, runs.requestId, edges.requestId].filter((id): id is string => !!id) }, connected: true, checkedAt: new Date().toISOString() };
  } catch (error) {
    return { brains: [], runs: [], edges: [], connected: false, checkedAt: new Date().toISOString(), error: error instanceof Error ? error.message : 'Unable to read the workspace.' };
  }
};

export const getBrain = async (id: BrainId, receipts?: ServiceReceipt[]): Promise<BrainDetail | null> => {
  const brains = await query(`MATCH (w:Workspace {ext_id: $workspace})-[:HAS_BRAIN]->(b:Brain {ext_id: $id})
    WHERE b.ready = true RETURN ${brainProjection} LIMIT 1`, { id, workspace: workspaceId }, z.array(brainSchema), receipts);
  const brain = brains.data[0];
  if (!brain) return null;
  const rows = await query(`MATCH (b:Brain {ext_id: $id})-[:HAS_AVENUE]->(a:Avenue)-[:ASKS]->(q:Question)
    WHERE a.revision = $revision
    RETURN a.ext_id AS avenueId, a.title AS title, a.domain AS domain, a.position AS avenueOrder,
    q.ext_id AS id, q.text AS text, q.term AS term, q.binding AS binding, q.position AS questionOrder
    ORDER BY a.position, q.position LIMIT 500`,
    { id, revision: brain.revision }, z.array(z.object({
      avenueId: z.string(), title: z.string(), domain: z.string(), avenueOrder: z.number(),
      id: z.string(), text: z.string(), term: z.string(), binding: z.string(), questionOrder: z.number(),
    })), receipts);
  const avenues = new Map<string, z.infer<typeof avenueSchema>>();
  for (const row of rows.data) {
    const avenue = avenues.get(row.avenueId) || { id: row.avenueId, title: row.title, domain: row.domain, order: row.avenueOrder, questions: [] };
    avenue.questions.push({ id: row.id, text: row.text, term: row.term, binding: row.binding, order: row.questionOrder });
    avenues.set(avenue.id, avenue);
  }
  return { brain, avenues: [...avenues.values()], requestIds: [brains.requestId, rows.requestId].filter((id): id is string => !!id) };
};

const sourceSchema = z.object({
  key: brainIdSchema, id: z.string(), title: z.string(), url: z.string().url(),
  modifiedAt: z.string(), content: z.string().min(100),
});

/** Preserve the author's section boundaries and exact question wording. Drafts never become pass/fail policy here. */
export const parseAvenues = (source: z.infer<typeof sourceSchema>, revision: string) => {
  const body = source.key === 'core'
    ? source.content.slice(source.content.indexOf('A. Software Design')).split('Gating by project maturity')[0]
    : source.content.slice(source.content.lastIndexOf('5. Boundary questions') + '5. Boundary questions'.length).split(/\r?\n6\. Maturity/)[0];
  const avenues: { id: string; title: string; domain: string; position: number; revision: string; questions: { id: string; text: string; term: string; binding: string; position: number }[] }[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('Domain:')) {
      if (avenues.length) avenues[avenues.length - 1].domain = line.slice(7).trim();
      continue;
    }
    const question = line.match(/^(\d+)\.\s+(.+\?.*)$/);
    if (question && avenues.length) {
      const full = question[2];
      const separator = full.indexOf(' — ');
      const binding = full.match(/Binds to:\s*(.+)/)?.[1] || '';
      const avenue = avenues[avenues.length - 1];
      avenue.questions.push({
        id: `${avenue.id}:q${question[1]}`, text: separator < 0 ? full : full.slice(0, separator),
        term: separator < 0 ? '' : full.slice(separator + 3).split('Binds to:')[0].trim(),
        binding, position: Number(question[1]),
      });
    } else if (!/^\d+\./.test(line) && !line.startsWith('*') && !line.startsWith('Status:')) {
      const title = line.replace(/^[A-M]\.\s*/, '');
      avenues.push({ id: `${source.key}:${revision}:a${avenues.length + 1}`, title, domain: '', position: avenues.length + 1, revision, questions: [] });
    }
  }
  return avenues.filter(avenue => avenue.questions.length);
};

export const importResearch = async () => {
  const path = process.env.RRFLOW_RESEARCH_PATH;
  if (!path) throw new Error('Research file is not configured. Start with the workspace launch script.');
  const sources = z.array(sourceSchema).length(6).parse(JSON.parse(await readFile(path, 'utf8')));
  if (new Set(sources.map(source => source.key)).size !== 6) throw new Error('Research must contain one source for each brain.');
  const imported: string[] = [];
  for (const [position, source] of sources.entries()) {
    const revision = createHash('sha256').update(source.content).digest('hex').slice(0, 16);
    const avenues = parseAvenues(source, revision);
    if (!avenues.length || avenues.some(avenue => avenue.questions.length > 100)) throw new Error(`Unable to parse ${source.key} research safely.`);
    const questions = avenues.flatMap(avenue => avenue.questions.map(question => ({ ...question, avenue: avenue.id })));
    if (questions.length > 450) throw new Error('This source needs paginated import support.');
    const rows = z.array(z.record(z.string(), z.unknown()));
    await query(`MERGE (s:Source {ext_id: $sourceId})
      SET s.title = $title, s.url = $url, s.content = $content, s.modified_at = $modifiedAt,
      s.revision = $revision, s.status = 'draft', s.version_claims = 'unverified'
      RETURN s.ext_id AS id`,
      { sourceId: `${source.id}:${revision}`, title: source.title, url: source.url, content: source.content, modifiedAt: source.modifiedAt, revision }, rows);
    await query(`UNWIND $avenues AS row MERGE (a:Avenue {ext_id: row.id})
      SET a.title = row.title, a.domain = row.domain, a.position = row.position, a.revision = row.revision
      RETURN count(a) AS count`, { avenues: avenues.map(avenue => ({ id: avenue.id, title: avenue.title, domain: avenue.domain, position: avenue.position, revision: avenue.revision })) }, rows);
    for (let offset = 0; offset < questions.length; offset += 40) {
      await query(`UNWIND $questions AS row MATCH (a:Avenue {ext_id: row.avenue})
        MERGE (q:Question {ext_id: row.id}) SET q.text = row.text, q.term = row.term,
        q.binding = row.binding, q.position = row.position, q.status = 'draft', q.pass_when = 'unreviewed'
        MERGE (a)-[:ASKS]->(q) RETURN count(q) AS count`, { questions: questions.slice(offset, offset + 40) }, rows);
    }
    // Activate a complete immutable source revision only after all its avenues/questions exist.
    await query(`MERGE (w:Workspace {ext_id: $workspace}) SET w.name = 'Shippin workspace'
      MERGE (b:Brain {ext_id: $id})
      SET b.name = $name, b.subtitle = $subtitle, b.description = $description, b.kind = $kind, b.color = $color,
      b.questions = $questions, b.avenues = $avenues, b.source_title = $sourceTitle, b.source_url = $sourceUrl,
      b.revision = $revision, b.position = $position, b.ready = true
      MERGE (w)-[:HAS_BRAIN]->(b)
      WITH b MATCH (s:Source {ext_id: $sourceId}) MERGE (b)-[:GROUNDED_IN]->(s)
      WITH b UNWIND $avenueIds AS avenueId MATCH (a:Avenue {ext_id: avenueId})
      MERGE (b)-[:HAS_AVENUE]->(a) RETURN count(a) AS count`,
      { workspace: workspaceId, id: source.key, ...brainCatalog[source.key], questions: questions.length, avenues: avenues.length,
        sourceTitle: source.title, sourceUrl: source.url, revision, position, sourceId: `${source.id}:${revision}`, avenueIds: avenues.map(avenue => avenue.id) }, rows);
    imported.push(source.key);
  }
  await query(`MATCH (b:Brain), (core:Brain {ext_id: 'core'}) WHERE b.ext_id <> 'core'
    MERGE (b)-[:EXTENDS]->(core) RETURN count(b) AS count`, {}, z.array(z.record(z.string(), z.unknown())));
  await query(`MATCH (b:Brain), (ts:Brain {ext_id: 'typescript'}) WHERE b.ext_id IN ['react', 'nextjs']
    MERGE (b)-[:COMPOSES]->(ts) RETURN count(b) AS count`, {}, z.array(z.record(z.string(), z.unknown())));
  return { imported };
};

export const createReview = async (input: z.infer<typeof newRunSchema>): Promise<ReviewRun> => {
  const { id, goal, stack } = newRunSchema.parse(input);
  const existing = await query(`MATCH (w:Workspace {ext_id: $workspace})-[:HAS_RUN]->(r:ReviewRun {ext_id: $id})
    RETURN ${runProjection} LIMIT 1`, { workspace: workspaceId, id }, z.array(runSchema));
  if (existing.data[0]) {
    if (existing.data[0].goal !== goal || existing.data[0].stack !== stack) throw new Error('This review ID already belongs to another plan. Start a new review.');
    return existing.data[0];
  }
  const brainIds: BrainId[] = ['core', stack];
  if (stack === 'nextjs' || stack === 'react') brainIds.push('typescript');
  const details = await Promise.all(brainIds.map(id => getBrain(id)));
  if (details.some(detail => !detail)) throw new Error('Import the required research brains before creating a review.');
  const avenues = details.flatMap(detail => detail?.avenues || []);
  const questionCount = avenues.reduce((count, avenue) => count + avenue.questions.length, 0);
  const createdAt = new Date().toISOString();
  // One native statement persists the run and the exact revision-bound avenues together.
  const result = await query(`MATCH (w:Workspace {ext_id: $workspace})
    MERGE (r:ReviewRun {ext_id: $id})
    ON CREATE SET r.goal = $goal, r.stack = $stack, r.created_at = $createdAt,
      r.status = 'needs_evidence', r.brain_ids = $brainIds, r.avenue_count = $avenueCount,
      r.question_count = $questionCount
    MERGE (w)-[:HAS_RUN]->(r)
    WITH r UNWIND $avenueIds AS avenueId MATCH (a:Avenue {ext_id: avenueId})
    MERGE (r)-[:USES_AVENUE]->(a)
    WITH DISTINCT r RETURN ${runProjection}`,
    { workspace: workspaceId, id, goal, stack, createdAt, brainIds, avenueCount: avenues.length, questionCount, avenueIds: avenues.map(avenue => avenue.id) }, z.array(runSchema));
  if (!result.data[0]) throw new Error('The review could not be saved.');
  return result.data[0];
};

export const deleteReview = async (id: string): Promise<boolean> => {
  z.string().uuid().parse(id);
  const result = await query(`MATCH (w:Workspace {ext_id: $workspace})-[:HAS_RUN]->(r:ReviewRun {ext_id: $id})
    DETACH DELETE r RETURN count(*) AS deleted`, { workspace: workspaceId, id }, z.array(z.object({ deleted: z.number() })));
  return (result.data[0]?.deleted || 0) > 0;
};

