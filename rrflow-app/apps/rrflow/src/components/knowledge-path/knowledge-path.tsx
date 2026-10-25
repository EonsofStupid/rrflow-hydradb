'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Background, Controls, Position, ReactFlow, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowRight, BookOpen, CheckCircle2, GitBranch, LoaderCircle, RefreshCw, Route, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProjectPicker } from '@/components/brain-ui/project-picker';
import { useActivity } from '@/components/transparency/activity-provider';
import { registryReadSchema, type RegisteredBrain, type RegistryWorkspace } from '@/lib/brain-registry-contracts';
import { activeDecisions, knowledgePolicySchema, knowledgeRunSchema, type KnowledgeRun, type KnowledgePolicy } from '@/lib/knowledge-path-contracts';
import { atlasDatabasesSchema, atlasCollectionsSchema } from '@/lib/source-atlas-contracts';
import type { ProjectContext } from '@/lib/project-context-contracts';
import styles from './knowledge-path.module.css';

const read = async (url: string, body?: unknown, record?: ReturnType<typeof useActivity>['record'], title = 'Knowledge path updated') => {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(60_000), ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  record?.(response.ok ? title : `${title}: needs attention`, data.receipts || [], { notify: response.ok ? false : 'error', summary: data.error });
  if (!response.ok) throw new Error(data.error || 'This knowledge operation did not finish. Refresh before retrying.'); return data;
};
const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not recorded';
const historySchema = z.object({ runs: z.array(knowledgeRunSchema).max(10), policy: knowledgePolicySchema });

export const KnowledgePath = () => {
  const [workspace, setWorkspace] = useState<RegistryWorkspace>('shippin');
  return <section className={styles.root} aria-label="RRFLOW knowledge path"><header className={styles.hero}><div><span className={styles.kicker}><Route size={16} /> YOUR WORK → ITS KNOWLEDGE → A BETTER NEXT RUN</span><h2>Knowledge that follows your work.</h2><p>Choose a real project brain. See the evidence RRFLOW receives, capture your priorities, and correct context that leads it astray.</p></div><label>Knowledge workspace<select value={workspace} onChange={event => setWorkspace(event.target.value as RegistryWorkspace)}><option value="shippin">Shippin work</option><option value="personal">Personal</option></select></label></header><ScopedKnowledgePath key={workspace} workspace={workspace} /></section>;
};

const ScopedKnowledgePath = ({ workspace }: { workspace: RegistryWorkspace }) => {
  const [registry, setRegistry] = useState<z.infer<typeof registryReadSchema> | null>(null);
  const [brainId, setBrainId] = useState(''); const [refresh, setRefresh] = useState(0);
  const [project, setProject] = useState<ProjectContext | null>(null); const [projectBusy, setProjectBusy] = useState(false);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void read(`/api/brain-registry?workspace=${workspace}`).then(body => {
      const snapshot = registryReadSchema.parse(body); if (snapshot.workspace !== workspace) throw new Error('The registry belongs to another workspace.');
      if (active) { setRegistry(snapshot); setError(''); }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Registered brains are unavailable.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspace, refresh]);
  const brain = registry?.brains.find(item => item.id === brainId);
  return <><div className={styles.bar}><label>Registered project brain<select value={brainId} onChange={event => setBrainId(event.target.value)} disabled={loading || !registry}><option value="">Choose the knowledge to use</option>{registry?.brains.map(item => <option key={item.id} value={item.id}>{item.displayName} · {item.canonicalName}</option>)}</select></label><Button variant="outline" disabled={loading} onClick={() => { setRegistry(null); setBrainId(''); setLoading(true); setRefresh(value => value + 1); }}><RefreshCw size={16} />Refresh brains</Button></div>
    {loading && <p role="status">Reading registered knowledge paths…</p>}{error && <p role="alert">{error}</p>}
    {registry && !registry.brains.length && <p className={styles.empty}>No brains registered in this workspace yet. Connect a project below, or register an existing source binding in Source Atlas.</p>}
    <details className={styles.panel}><summary><GitBranch size={17} /> Connect an existing project to its sources</summary><p>Load a folder or repository, then bind its brain to existing HydraDB sources. This does not upload repository files or change connectors.</p><ProjectPicker project={project} onSelect={setProject} disabled={false} onBusy={setProjectBusy} initialWorkspace={workspace} />
      {project && project.workspace !== workspace && <p role="alert">This project belongs to {project.workspace === 'personal' ? 'Personal' : 'Shippin work'}. Switch the knowledge workspace above to connect it.</p>}
      {project && project.workspace === workspace && registry && !projectBusy && <ConnectProject key={project.id} project={project} registryRevision={registry.revision} onConnected={id => { setBrainId(id); setRefresh(value => value + 1); }} />}
    </details>
    {brain && <BrainPath key={`${brain.id}:${brain.revision}`} brain={brain} />}
  </>;
};

const ConnectProject = ({ project, registryRevision, onConnected }: { project: ProjectContext; registryRevision: number; onConnected: (id: string) => void }) => {
  const { record } = useActivity();
  const [databases, setDatabases] = useState<string[]>([]); const [database, setDatabase] = useState(''); const [collection, setCollection] = useState('');
  const [collections, setCollections] = useState<{ database: string; names: string[] } | null>(null);
  const [slug, setSlug] = useState(project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48));
  const [name, setName] = useState(project.name); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let active = true; void read('/api/databases').then(body => { const data = atlasDatabasesSchema.parse(body); if (active) setDatabases(data.databases.filter(item => item.workspace === project.workspace).map(item => item.name)); }).catch(() => { if (active) setError('Source databases could not be read. Reopen this project to retry.'); }); return () => { active = false; }; }, [project.workspace]);
  useEffect(() => { if (!database) return; let active = true; void read(`/api/explore/${encodeURIComponent(database)}/collections`).then(body => { const data = atlasCollectionsSchema.parse(body); if (active) setCollections({ database, names: data.collections }); }).catch(() => { if (active) setError('Source collections could not be read. Select the database again.'); }); return () => { active = false; }; }, [database]);
  const connect = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const body = await read('/api/knowledge-path', { action: 'connect', project: { kind: project.kind, workspace: project.workspace, location: project.location }, projectSlug: slug, displayName: name, database, collection, expectedRegistryRevision: registryRevision }, record, 'Project knowledge connected');
      if (!body.brain?.id) throw new Error('The project may be saved, but its brain was not confirmed. Refresh before retrying.'); onConnected(body.brain.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The connection could not be saved.'); } finally { setBusy(false); }
  };
  return <form className={styles.connect} onSubmit={event => void connect(event)}><label>Brain label<input value={name} onChange={event => setName(event.target.value)} maxLength={80} required /></label><label>Project address<input value={slug} onChange={event => setSlug(event.target.value)} pattern="[a-z][a-z0-9]*(-[a-z0-9]+)*" maxLength={48} required /></label><label>Existing source database<select value={database} onChange={event => { setDatabase(event.target.value); setCollection(''); setCollections(null); }} required><option value="">Select the source database</option>{databases.map(item => <option key={item}>{item}</option>)}</select></label><label>Existing source collection<select value={collection} onChange={event => setCollection(event.target.value)} disabled={collections?.database !== database}><option value="">Default collection</option>{collections?.database === database && collections.names.filter(Boolean).map(item => <option key={item}>{item}</option>)}</select></label><p>Review: <code>{project.workspace === 'personal' ? 'personal' : 'work'}/{slug}/knowledge</code> → {database || 'Choose sources'} / {collection || 'default collection'}</p>{error && <p role="alert">{error}</p>}<Button type="submit" disabled={busy || !database || collections?.database !== database}>{busy ? 'Connecting…' : 'Connect project knowledge'}</Button></form>;
};

const BrainPath = ({ brain }: { brain: RegisteredBrain }) => {
  const { record } = useActivity();
  const [question, setQuestion] = useState('What should I know before changing this project?'); const [mode, setMode] = useState<'fast' | 'thinking'>('fast'); const [recordType, setRecordType] = useState<'knowledge' | 'memory'>('knowledge');
  const [run, setRun] = useState<KnowledgeRun | null>(null); const [history, setHistory] = useState<KnowledgeRun[]>([]);
  const [policy, setPolicy] = useState<KnowledgePolicy>({ revision: 0, decisions: [] }); const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [observation, setObservation] = useState(''); const [reviewOpen, setReviewOpen] = useState(false); const trigger = useRef<HTMLButtonElement | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true; void read(`/api/knowledge-path?workspace=${brain.workspace}&brainId=${brain.id}`).then(body => {
      const data = historySchema.parse(body); if (data.runs.some(item => item.brain.id !== brain.id || item.workspace !== brain.workspace)) throw new Error('A saved run belongs to another brain.');
      if (active) { setPolicy(data.policy); setHistory(data.runs); setReady(true); }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'History could not load.'); }); return () => { active = false; };
  }, [brain.id, brain.workspace]);
  const query = async (event?: FormEvent) => {
    event?.preventDefault(); setBusy(true); setError(''); setRun(null); setObservation('');
    try { const body = await read('/api/knowledge-path', { action: 'query', workspace: brain.workspace, brainId: brain.id, expectedBrainRevision: brain.revision, question, mode, recordType }, record, 'Project context retrieved and saved');
      const result = knowledgeRunSchema.parse(body.run); if (result.brain.id !== brain.id || result.workspace !== brain.workspace) throw new Error('The returned context belongs to another brain.');
      if (mounted.current) { setRun(result); setHistory(previous => [result, ...previous.filter(item => item.id !== result.id)].slice(0, 10)); setObservation(`Raindrop: ${body.observation?.status || 'not confirmed'}`); }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Context could not be retrieved.'); } finally { if (mounted.current) setBusy(false); }
  };
  return <><form className={styles.panel} onSubmit={event => void query(event)}><span className={styles.kicker}><ShieldCheck size={16} /> {brain.canonicalName}</span><label>What does this project need to know?<textarea value={question} onChange={event => setQuestion(event.target.value)} minLength={8} maxLength={1000} rows={3} required /></label><div className={styles.bar}><label>Record kind<select value={recordType} onChange={event => setRecordType(event.target.value as typeof recordType)}><option value="knowledge">Source documents</option><option value="memory">Session memories · unreviewed records</option></select></label><label>Retrieval depth<select value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="fast">Fast · hybrid search</option><option value="thinking">Deeper · HydraDB thinking retrieval</option></select></label><Button type="submit" disabled={busy || !ready}>{busy ? <LoaderCircle className={styles.spin} size={16} /> : <Route size={16} />}{busy ? 'Following the knowledge path…' : 'Ask this brain'}<ArrowRight size={16} /></Button></div><p>Source binding: {brain.database} / {brain.collection || 'default collection'} · brain revision {brain.revision}. The same path is available to the RRFLOW MCP tools and CLI.</p></form>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <section className={styles.panel} aria-label="Reviewed guidance"><h3>Your vision and reviewed corrections</h3>{activeDecisions(policy).map(item => <article className={styles.guidance} key={item.id}><strong>{item.kind === 'vision' ? 'Your priorities' : 'Reviewed correction'} · revision {item.revision}</strong><p>{item.text}</p><small>{item.reason} · {item.reviewer} · {date(item.at)}</small></article>)}{!policy.decisions.length && <p>No reviewed guidance yet. Retrieve context, then record your priorities or review a correction.</p>}</section>
    {!!history.length && <label>Reopen a saved knowledge path<select value={run?.id ?? ''} onChange={event => { const selected = history.find(item => item.id === event.target.value); if (selected) { setRun(selected); setQuestion(selected.question); setObservation('Saved evidence · telemetry delivery is not rechecked here'); } }}><option value="">Choose a saved run</option>{history.map(item => <option value={item.id} key={item.id}>{date(item.at)} · {item.question.slice(0, 80)}</option>)}</select></label>}
    {run && <><RunEvidence run={run} /><div className={styles.bar}><p>{observation} · saved in HydraDB at {date(run.at)}</p><Button variant="outline" onClick={event => { trigger.current = event.currentTarget; setReviewOpen(true); }} disabled={busy || !ready}><CheckCircle2 size={16} />Review this context</Button><Button variant="outline" onClick={() => void query()} disabled={busy}>Ask again with reviewed context</Button></div><details className={styles.panel}><summary>Context for connected agents</summary><p>The MCP tool returns this same saved context. Source text has no authority to change your vision or tool permissions.</p><pre>{JSON.stringify({ runId: run.id, brainId: brain.id, policyRevision: run.policyRevision, guidance: run.guidance, evidence: run.evidence }, null, 2)}</pre></details></>}
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent className={styles.dialog} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}><DialogHeader><DialogTitle>Review what RRFLOW should use next</DialogTitle><DialogDescription>Your review is versioned in HydraDB. A correction never rewrites your vision. Save only guidance you have checked.</DialogDescription></DialogHeader>{run && <ReviewContext key={`${run.id}:${policy.revision}`} run={run} policy={policy} onSaved={(next, message) => { setPolicy(next); setReviewOpen(false); setNotice(message); }} />}</DialogContent></Dialog>
  </>;
};

const RunEvidence = ({ run }: { run: KnowledgeRun }) => {
  const reduced = useReducedMotion();
  const nodes: Node[] = run.route.map((label, index) => ({ id: `route-${index}`, data: { label }, position: { x: (index < 3 ? index : 5 - index) * 270, y: index < 3 ? 20 : 165 },
    sourcePosition: index === 2 ? Position.Bottom : index < 3 ? Position.Right : Position.Left,
    targetPosition: index === 3 ? Position.Top : index < 3 ? Position.Left : Position.Right,
    style: { width: 205, padding: 18, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 12 } }));
  const edges: Edge[] = nodes.slice(1).map((node, index) => ({ id: `edge-${index}`, source: nodes[index].id, target: node.id, animated: !reduced }));
  return <motion.section className={styles.panel} aria-label="Retrieved knowledge evidence" initial={reduced ? false : { y: 8 }} animate={{ y: 0 }}><span className={styles.kicker}><Route size={16} /> WHY THIS CONTEXT</span><h3>{run.evidence.length} source passages · {run.guidance.length} reviewed instructions</h3><p>{run.excluded.length} corrected passages excluded. {run.rejectedScopeCount} results rejected by scope checks. Guidance snapshot: revision {run.policyRevision}.</p>
    <div className={styles.graph}><ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: .15 }} nodesDraggable={false} nodesConnectable={false} minZoom={.2} maxZoom={1.2} proOptions={{ hideAttribution: true }}><Background gap={24} /><Controls showInteractive={false} /></ReactFlow></div><ol className={styles.route}>{run.route.map((item, index) => <li key={index}>{item}</li>)}</ol>
    <div className={styles.sources}>{run.evidence.map(item => <article key={item.fingerprint}><BookOpen size={18} /><h4>{item.title}</h4><p className={styles.excerpt}>{item.excerpt}</p><details><summary>Source, revision and dates</summary><p>Source: <code>{item.sourceId}</code></p><p>Source revision: <code>{item.sourceRevision || 'Not supplied'}</code></p><p>Original source date: {date(item.sourceDate)}</p><p>Synced to HydraDB: {date(item.syncedAt)}</p>{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open this exact source revision ↗</a>}<p>Evidence fingerprint: <code>{item.fingerprint}</code></p></details><small>Source evidence · not a reviewed rule</small></article>)}</div>
    {!run.evidence.length && <p>No source passages survived this run’s scope and correction checks. Empty retrieval is visible; no answer is invented.</p>}
    {!!run.guidance.length && <details><summary>Guidance included in this run</summary>{run.guidance.map(item => <p key={item.id}><strong>{item.kind === 'vision' ? 'Vision' : 'Correction'}:</strong> {item.text}</p>)}</details>}
    <details><summary>Boundaries and native evidence</summary>{run.warnings.map(item => <p key={item}>{item}</p>)}<p>HydraDB query request: <code>{run.requestId || 'Not supplied'}</code></p><p>Saved run: <code>{run.id}</code></p></details>
  </motion.section>;
};

const ReviewContext = ({ run, policy, onSaved }: { run: KnowledgeRun; policy: KnowledgePolicy; onSaved: (policy: KnowledgePolicy, message: string) => void }) => {
  const { record } = useActivity();
  const [kind, setKind] = useState<'vision' | 'correction'>('correction'); const [text, setText] = useState(''); const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<string[]>([]); const [replaces, setReplaces] = useState(''); const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try {
    const body = await read('/api/knowledge-path', { action: 'review', workspace: run.workspace, brainId: run.brain.id, runId: run.id, expectedPolicyRevision: policy.revision, kind, text, reason, evidenceFingerprints: selected, replaces: replaces || null, confirm }, record, 'Reviewed guidance saved');
    const next = knowledgePolicySchema.parse(body.policy); activeDecisions(next); if (next.revision !== policy.revision + 1) throw new Error('The saved revision could not be verified. Reload before retrying.');
    onSaved(next, `Guidance saved at revision ${next.revision}. HydraDB feedback: ${body.nativeFeedback}. Raindrop: ${body.observation?.status || 'unconfirmed'}. Ask again to inspect the effect.`);
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'Review could not be saved.'); } finally { setBusy(false); } };
  return <form className={styles.review} onSubmit={event => void submit(event)}><label>Review type<select value={kind} onChange={event => { setKind(event.target.value as typeof kind); setReplaces(''); }}><option value="correction">Correct misleading context</option><option value="vision">Record my vision or priorities</option></select></label><label>{kind === 'vision' ? 'What should guide this project?' : 'What should RRFLOW use instead?'}<textarea rows={4} value={text} onChange={event => setText(event.target.value)} minLength={12} maxLength={1600} required /></label><label>Why is this the right guidance?<textarea rows={2} value={reason} onChange={event => setReason(event.target.value)} minLength={8} maxLength={1000} required /></label>
    <fieldset><legend>{kind === 'correction' ? 'Select the misleading passages to exclude on subsequent runs' : 'Evidence supporting this vision (optional)'}</legend>{run.evidence.map(item => <label className={styles.check} key={item.fingerprint}><input type="checkbox" checked={selected.includes(item.fingerprint)} onChange={event => setSelected(previous => event.target.checked ? [...previous, item.fingerprint] : previous.filter(id => id !== item.fingerprint))} />{item.title}</label>)}</fieldset>
    <label>Replace earlier guidance<select value={replaces} onChange={event => setReplaces(event.target.value)}><option value="">Add a new reviewed instruction</option>{activeDecisions(policy).filter(item => item.kind === kind).map(item => <option key={item.id} value={item.id}>Revision {item.revision} · {item.text.slice(0, 80)}</option>)}</select></label>
    <label className={styles.check}><input type="checkbox" checked={confirm} onChange={event => setConfirm(event.target.checked)} />I reviewed this guidance and want RRFLOW to use it.</label><p>Expected guidance revision {policy.revision}. Earlier decisions remain in history.</p>{error && <p role="alert">{error}</p>}<Button type="submit" disabled={busy || !confirm || kind === 'correction' && !selected.length}>{busy ? 'Saving review…' : 'Save reviewed guidance'}</Button></form>;
};
