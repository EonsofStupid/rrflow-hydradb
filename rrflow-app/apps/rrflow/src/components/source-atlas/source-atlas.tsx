'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BookOpen, Database, Fingerprint, GitBranch, Map, RefreshCw, Route, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { databaseWorkspaceNames, type DatabaseWorkspace } from '@/lib/databases-contracts';
import { meshCatalog } from '@/lib/mesh-contracts';
import { SYNC_DATABASE, SYNC_COLLECTION } from '@/lib/repository-sync-contracts';
import {
  atlasCollectionsSchema, atlasConnectionsSchema, atlasDatabasesSchema, atlasDetailSchema, atlasItemsSchema,
  atlasProjectsSchema, atlasSyncSchema, brainNamePlanSchema, plannedBrainName, type AtlasDatabase, type AtlasItem,
} from '@/lib/source-atlas-contracts';
import styles from './source-atlas.module.css';

type Read<T> = { status: 'loading' } | { status: 'failed'; error: string } | { status: 'ready'; data: T; readAt: string };
// A changed scope or refresh has no old data to render; an aborted response cannot cross the boundary.
const useRead = <T,>(url: string, schema: z.ZodType<T>, revision: number): Read<T> => {
  const key = `${url}:${revision}`;
  const [result, setResult] = useState<{ key: string; value: Read<T> } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        const body = await response.json();
        if (!response.ok || body.error) throw new Error(typeof body.error === 'string' ? body.error : 'This source could not be read. Refresh to retry.');
        const parsed = schema.safeParse(body);
        if (!parsed.success) throw new Error('This source returned an unexpected response. Its contents are unverified.');
        if (!controller.signal.aborted) setResult({ key, value: { status: 'ready', data: parsed.data, readAt: new Date().toISOString() } });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, value: { status: 'failed', error: error instanceof Error ? error.message : 'This source could not be read.' } });
      }
    })();
    return () => controller.abort();
  }, [key, url, schema]);
  return result?.key === key ? result.value : { status: 'loading' };
};

const time = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not recorded';
const label = (database: string) => database === 'default-tenant' ? 'Personal knowledge' : Object.hasOwn(meshCatalog, database) ? meshCatalog[database as keyof typeof meshCatalog].name : database;
const ReadStatus = ({ state, name }: { state: Read<unknown>; name: string }) => state.status === 'failed' ? <p role="alert" className={styles.notice}>{name}: {state.error}</p> : state.status === 'loading' ? <p role="status">Reading {name.toLowerCase()}…</p> : null;

export const SourceAtlas = ({ onManage, onWork }: { onManage: () => void; onWork: () => void }) => {
  const [scope, setScope] = useState<DatabaseWorkspace>('personal');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const reducedMotion = useReducedMotion();
  const databases = useRead('/api/databases', atlasDatabasesSchema, revision);
  const connections = useRead('/api/connections', atlasConnectionsSchema, revision);
  const sync = useRead('/api/repository-sync', atlasSyncSchema, revision);
  const current = databases.status === 'ready' ? databases.data.databases.filter(item => item.workspace === scope) : [];
  const unresolved = databases.status === 'ready' ? databases.data.databases.filter(item => !item.workspace) : [];
  const chosen = current.find(item => item.name === selected);
  const busy = [databases, connections, sync].some(read => read.status === 'loading');
  const overview = connections.status === 'ready' ? connections.data.overview : null;
  const checkpoint = sync.status === 'ready' ? sync.data.state : null;
  const receipts = [databases, connections, sync].flatMap(read => read.status === 'ready' ? read.data.receipts : []);

  return <section className={styles.root} aria-label="Source Atlas">
    <div className={styles.hero}>
      <div><span className={styles.eyebrow}><Map size={15} /> SOURCE ATLAS</span><h2>A place for every source.<br />A reason for every connection.</h2><p>Follow your Personal and Shippin knowledge from its origin to the brain that holds it. Open a brain to read the actual stored sources and memories.</p></div>
      <div className={styles.heroAction}><Button variant="outline" onClick={() => { setSelected(null); setRevision(value => value + 1); }} disabled={busy}><RefreshCw size={15} className={busy ? 'spin' : ''} />{busy ? 'Checking sources…' : 'Refresh Atlas'}</Button><span>Live reads on open and refresh</span></div>
    </div>
    <div className={styles.scopes} role="group" aria-label="Atlas workspace">
      {(['personal', 'shippin', 'practice'] as const).map(value => <button key={value} aria-pressed={scope === value} onClick={() => { setSelected(null); setScope(value); }}><span>{value === 'personal' ? <Fingerprint size={19} /> : value === 'shippin' ? <GitBranch size={19} /> : <ShieldCheck size={19} />}{databaseWorkspaceNames[value]}</span><small>{value === 'personal' ? 'Life, ambitions & private context' : value === 'shippin' ? 'Products, projects & company context' : 'Research, tool lessons & standards'}</small></button>)}
    </div>
    <div className={styles.readout}><span><Database size={15} /> {databases.status === 'ready' ? current.length : 'Unknown number of'} assigned databases in this view</span><span>Database check: {databases.status === 'ready' ? time(databases.data.checkedAt) : 'Unverified'}</span></div>
    <ReadStatus state={databases} name="Database assignments" />
    {databases.status === 'ready' && databases.data.warnings?.map(warning => <p className={styles.notice} role="alert" key={warning}>{warning}</p>)}
    <ReadStatus state={connections} name="Connections" />
    {overview && !overview.connectorListAvailable && <p role="alert" className={styles.notice}>Connector inventory is unavailable. An empty route list does not mean there are no connections.</p>}
    {overview?.warnings.map(warning => <p role="alert" className={styles.notice} key={warning}>{warning}</p>)}
    <div className={styles.brains}>
      {current.map(database => {
        const routes = overview?.connectors.filter(connector => connector.database === database.name && connector.workspace === scope) ?? [];
        return <motion.article className={styles.brain} key={database.name} initial={reducedMotion ? false : { y: 8 }} animate={{ y: 0 }} transition={{ duration: .18 }}>
          <div className={styles.cardHead}><Database size={21} /><span>{database.ready === true ? 'Ready for ingestion' : database.ready === false ? 'Not ready for ingestion' : 'Readiness unverified'}</span></div>
          <h3>{label(database.name)}</h3><code>{database.name}</code>
          <p>{routes.length ? `${routes.length} connector default${routes.length === 1 ? '' : 's'} point here.` : overview?.connectorListAvailable ? 'No connector defaults point here. Other ingestion routes may exist.' : 'Connector routes are unverified.'}</p>
          <div className={styles.tags}>{routes.map(route => <span key={route.id}>{route.provider} → {route.collection || 'default collection'}{route.needsAttention ? ' · needs attention' : ''}</span>)}{database.name === SYNC_DATABASE && checkpoint && <span>GitHub repository files → {SYNC_COLLECTION}</span>}</div>
          <Button variant="outline" onClick={event => { trigger.current = event.currentTarget; setSelected(database.name); }}>Inspect {label(database.name)}</Button>
        </motion.article>;
      })}
    </div>
    {databases.status === 'ready' && !current.length && <p>No databases with a verified assignment were returned for this workspace.</p>}
    <div className={styles.columns}>
      <Projects key={scope} scope={scope} revision={revision} onWork={onWork} />
      <section className={styles.panel} aria-label="Development lifecycle evidence"><span className={styles.eyebrow}><Route size={15} /> THE PRODUCT LEARNS FROM ITS OWN WORK</span><h3>Repository → checks → knowledge</h3><p>The recorded sync below belongs to the RRFLOW Work repository. It does not establish a link for other projects.</p>
        {scope !== 'shippin' ? <p>Switch to Shippin work to inspect the repository checkpoint and its Raindrop delivery.</p> : <><ReadStatus state={sync} name="Repository checkpoint" />{sync.status === 'ready' && (checkpoint ? <><strong>{checkpoint.repository}</strong><dl className={styles.facts}><div><dt>Source commit</dt><dd><code>{checkpoint.commit}</code></dd></div><div><dt>Source update</dt><dd>{time(checkpoint.sourceAt)}</dd></div><div><dt>Latest sync phase</dt><dd>{checkpoint.phase}</dd></div><div><dt>Sources searchable / total</dt><dd>{checkpoint.searchable} / {checkpoint.total}</dd></div><div><dt>Processing completed</dt><dd>{checkpoint.completed}</dd></div><div><dt>Failed sources</dt><dd>{checkpoint.failed}</dd></div><div><dt>Last successful sync</dt><dd>{time(checkpoint.lastSuccessfulAt)}</dd></div><div><dt>Raindrop delivery</dt><dd>{checkpoint.raindrop.status}</dd></div><div><dt>Checkpoint checked</dt><dd>{time(sync.data.checkedAt)}</dd></div></dl>{checkpoint.error && <p role="alert">{checkpoint.error}</p>}{checkpoint.runUrl && <a href={checkpoint.runUrl} target="_blank" rel="noreferrer">Inspect GitHub sync run ↗</a>}<p className={styles.fine}>Delivery acceptance is not proof of improvement. CI outcomes and reviewed corrections are inspected in the Learning trail; automatic rule promotion is not active.</p></> : <p>No saved repository sync checkpoint was returned.</p>)}</>}
      </section>
    </div>
    <section className={styles.panel} aria-label="Atlas reconciliation"><h3>Needs a placement decision</h3><p>These are owner-visible records with no verified workspace assignment. Their names do not grant access or determine where they belong.</p>
      {databases.status !== 'ready' ? <p>Unassigned databases cannot be determined until the catalog loads.</p> : unresolved.length ? <ul>{unresolved.map(item => <li key={item.name}><code>{item.name}</code> · {item.status || 'Workspace assignment needed'}</li>)}</ul> : <p>No unassigned databases were returned.</p>}
      {overview?.unassigned.map(item => <p key={item.id}>{item.provider} → <code>{item.database}</code>: {item.reason}</p>)}
      <Button variant="outline" onClick={onManage}>Review database assignments</Button>
    </section>
    <NamePlanner />
    <details className={styles.panel}><summary>Read evidence and current boundaries</summary><p>This Atlas reads existing HydraDB records. Brain cards are native databases; logical brain IDs, aliases and project-to-brain assignments have not been migrated. Connector arrows show configured defaults; individual resource overrides may differ. Stored source timestamps do not prove freshness.</p><p>Qdrant source imports remain available under Memories & context → Qdrant source records.</p>{receipts.map((receipt, index) => <p className={styles.fine} key={index}>{receipt.action} · {receipt.outcome} · {receipt.requestId || 'No request ID returned'}</p>)}</details>
    <Dialog open={!!chosen} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className={styles.dialog} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}><DialogHeader><DialogTitle>{chosen ? label(chosen.name) : 'Brain sources'}</DialogTitle><DialogDescription>Actual records and connector defaults for this database. No source is moved by inspecting it.</DialogDescription></DialogHeader>{chosen && <div className={styles.inspector}>
      <code>{chosen.name}</code><h3>How sources arrive</h3><p className={styles.fine}>Connector defaults only. Resource overrides and other ingestion paths are not enumerated here.</p>
      {overview?.connectorListAvailable ? <>{overview.connectors.filter(item => item.database === chosen.name && item.workspace === chosen.workspace).map(item => <div className={styles.route} key={item.id}><strong>{item.provider} → {item.collection || 'default collection'}</strong><span>{item.lifecycle} · sync {item.syncStatus}{item.needsAttention ? ' · needs attention' : ''}</span><dl className={styles.facts}><div><dt>Last sync attempt</dt><dd>{time(item.lastAttempt)}</dd></div><div><dt>Last successful sync</dt><dd>{time(item.lastSuccess)}</dd></div><div><dt>Active resources</dt><dd>{item.resources ?? 'Unknown'}</dd></div></dl></div>)}{!overview.connectors.some(item => item.database === chosen.name && item.workspace === chosen.workspace) && <p>No connector defaults point here.</p>}</> : <p>Connector routes are unverified.</p>}
      {chosen.name === SYNC_DATABASE && <p>Repository-file sync: <code>{SYNC_COLLECTION}</code>. Its checkpoint is shown in Shippin work.</p>}
      <Records key={`${chosen.name}:${revision}`} database={chosen} revision={revision} />
    </div>}</DialogContent></Dialog>
  </section>;
};

const Projects = ({ scope, revision, onWork }: { scope: DatabaseWorkspace; revision: number; onWork: () => void }) => scope === 'practice' ? <section className={styles.panel}><h3>Engineering practice</h3><p>Practice is a distinct scope. Cross-project reuse does not establish Personal or Work ownership of each record.</p></section> : <ProjectList scope={scope} revision={revision} onWork={onWork} />;
const ProjectList = ({ scope, revision, onWork }: { scope: 'personal' | 'shippin'; revision: number; onWork: () => void }) => {
  const projects = useRead(`/api/project-context?workspace=${scope}`, atlasProjectsSchema, revision);
  return <section className={styles.panel} aria-label="Saved project roadmap"><span className={styles.eyebrow}><GitBranch size={15} /> PROJECT CONTEXT</span><h3>What each project brings</h3><p>Saved folder and GitHub snapshots in this workspace. A snapshot is not a continuous sync or a confirmed project-to-brain link.</p><ReadStatus state={projects} name="Saved projects" />
    {projects.status === 'ready' && <>{projects.data.projects.filter(project => project.workspace === scope).map(project => <details className={styles.project} key={project.id}><summary>{project.name}<span>{project.kind === 'github' ? 'GitHub repository' : 'Local folder'}</span></summary><dl className={styles.facts}><div><dt>Original location</dt><dd>{project.location}</dd></div><div><dt>Saved snapshot</dt><dd>{time(project.loadedAt)}</dd></div><div><dt>Recorded revision</dt><dd><code>{project.revision}</code></dd></div><div><dt>Project identity</dt><dd><code>{project.id}</code></dd></div><div><dt>Brain assignment</dt><dd>Not recorded by the current project registry</dd></div></dl></details>)}{!projects.data.projects.some(project => project.workspace === scope) && <p>No saved project snapshots were returned for this workspace.</p>}<p className={styles.fine}>Up to 25 most recently saved project pointers. Read at {time(projects.readAt)}.</p></>}
    <Button variant="outline" onClick={onWork}>Open project workspace</Button>
  </section>;
};

const Records = ({ database, revision }: { database: AtlasDatabase; revision: number }) => {
  const collections = useRead(`/api/explore/${encodeURIComponent(database.name)}/collections`, atlasCollectionsSchema, revision);
  const [collection, setCollection] = useState('');
  return <><h3>Sources and memories you can read</h3><ReadStatus state={collections} name="Source collections" />{collections.status === 'ready' && <><label className={styles.field}>Atlas source collection<select value={collection} onChange={event => setCollection(event.target.value)}><option value="">Default collection</option>{collections.data.collections.filter(Boolean).map(name => <option key={name} value={name}>{name}</option>)}</select></label><RecordList key={collection} database={database.name} collection={collection} revision={revision} /></>}</>;
};
const RecordList = ({ database, collection, revision }: { database: string; collection: string; revision: number }) => {
  const [kind, setKind] = useState<'knowledge' | 'memory'>('knowledge');
  const [selected, setSelected] = useState<AtlasItem | null>(null);
  const query = new URLSearchParams({ kind, pageSize: '12', ...(collection ? { collection } : {}) });
  const records = useRead(`/api/explore/${encodeURIComponent(database)}/items?${query}`, atlasItemsSchema, revision);
  const matchesSelection = records.status === 'ready' && records.data.database === database && (records.data.collection || '') === collection && records.data.kind === kind;
  return <><div className={styles.tabs} role="group" aria-label="Atlas record kinds">{(['knowledge', 'memory'] as const).map(value => <button key={value} aria-pressed={kind === value} onClick={() => { setSelected(null); setKind(value); }}>{value === 'knowledge' ? 'Stored sources' : 'Stored memories'}</button>)}</div><ReadStatus state={records} name={kind === 'knowledge' ? 'Sources' : 'Memories'} />
    {records.status === 'ready' && (matchesSelection ? <><p className={styles.fine}>Showing {records.data.items.length} of {records.data.total ?? 'an unknown total of'} records · first page, at most 12. Request: {records.data.requestId || 'not returned'}.</p>{!records.data.items.length && <p>No {kind === 'knowledge' ? 'sources' : 'memories'} were returned for this collection.</p>}<div className={styles.records}>{records.data.items.map(item => <button key={`${item.kind}:${item.id}`} onClick={() => setSelected(item)} aria-pressed={selected?.id === item.id}><BookOpen size={16} /><span><strong>{item.title}</strong><small>Source timestamp: {time(item.timestamp)}</small></span></button>)}</div></> : <p role="alert">The returned list does not match this database and collection. Refresh before inspecting it.</p>)}
    {selected && <RecordDetail key={`${selected.kind}:${selected.id}`} item={selected} database={database} collection={collection} revision={revision} />}
  </>;
};
const RecordDetail = ({ item, database, collection, revision }: { item: AtlasItem; database: string; collection: string; revision: number }) => {
  const query = new URLSearchParams({ kind: item.kind, ...((item.collection ?? collection) ? { collection: item.collection ?? collection } : {}) });
  const detail = useRead(`/api/explore/${encodeURIComponent(database)}/items/${encodeURIComponent(item.id)}?${query}`, atlasDetailSchema, revision);
  const verified = detail.status === 'ready' && detail.data.id === item.id && detail.data.database === database && detail.data.kind === item.kind && (detail.data.collection || '') === (item.collection ?? collection);
  return <section className={styles.recordDetail} aria-label="Atlas record evidence"><h4>{item.title}</h4><code>{item.id}</code><p>{item.description}</p><ReadStatus state={detail} name="Record content" />{detail.status === 'ready' && (verified ? <><pre>{detail.data.content || 'No readable source body was returned.'}</pre>{detail.data.inferredContent && <details><summary>Inferred content · separate from original source</summary><pre>{detail.data.inferredContent}</pre></details>}{detail.data.failures.map(failure => <p role="alert" key={failure.call}>{failure.call}: {failure.message}</p>)}<p className={styles.fine}>Read at {time(detail.readAt)}. Native requests: {detail.data.requestIds.join(', ') || 'not returned'}.</p></> : <p role="alert">The returned record does not match this selection. Refresh before inspecting its content.</p>)}</section>;
};

const NamePlanner = () => {
  const [workspace, setWorkspace] = useState<'personal' | 'work'>('work');
  const [project, setProject] = useState('shared');
  const [purpose, setPurpose] = useState<'knowledge' | 'practice' | 'catalog' | 'intake'>('knowledge');
  const input = { workspace, project, purpose };
  const parsed = brainNamePlanSchema.safeParse(input);
  return <details className={styles.panel}><summary>Plan a readable brain name</summary><p>Preview the proposed workspace / project / purpose convention. This planner validates syntax in TypeScript. It does not save a registry record, check uniqueness, rename a database, or establish an assignment.</p><div className={styles.nameFields}><label className={styles.field}>Name workspace<select value={workspace} onChange={event => setWorkspace(event.target.value as typeof workspace)}><option value="personal">Personal</option><option value="work">Shippin work</option></select></label><label className={styles.field}>Project slug<input value={project} maxLength={48} onChange={event => setProject(event.target.value)} aria-invalid={!parsed.success} aria-describedby="atlas-name-result" /></label><label className={styles.field}>Brain purpose<select value={purpose} onChange={event => setPurpose(event.target.value as typeof purpose)}>{['knowledge', 'practice', 'catalog', 'intake'].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div><p id="atlas-name-result" role="status">{parsed.success ? <>Draft name: <code>{plannedBrainName(input)}</code></> : 'Use 1–48 lowercase letters or numbers, starting with a letter, with single hyphens between words.'}</p><p className={styles.fine}>SWAG retains your vision and reviewed decisions. Provider releases are evidence to assess against that vision; automatic adoption and rule promotion are not active.</p></details>;
};
