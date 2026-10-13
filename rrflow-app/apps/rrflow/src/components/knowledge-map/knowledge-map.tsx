'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { BookOpen, BrainCircuit, ChevronRight, Clock3, ExternalLink, Lightbulb, Network, RefreshCw, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RelationGraph } from '@/components/explore/relation-graph';
import type { BrainId, Workspace } from '@/lib/contracts';
import type { ExploreItem, ExploreItemDetail, ExploreListResponse } from '@/lib/explore-contracts';
import type { DatabaseSummary } from '@/lib/databases-contracts';
import styles from './knowledge-map.module.css';

const QdrantSources = dynamic(() => import('@/components/qdrant/qdrant-sources').then(module => module.QdrantSources), { loading: () => <p role="status">Reading Qdrant source libraries…</p> });

type Item = ExploreItem & { database: string };
const date = (value: string | null) => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Update time unavailable';
const kind = (item: Item) => item.kind === 'knowledge' ? 'Source' : item.metadata.kind === 'quirk' ? 'Tool lesson' : ['practice', 'best_practice'].includes(String(item.metadata.kind)) ? 'Best practice' : 'Memory';

export const KnowledgeMap = ({ workspace, onExplore, onWork, onManage }: { workspace: Workspace | null; onExplore: (id: BrainId) => void; onWork: () => void; onManage: () => void }) => {
  const [scope, setScope] = useState<'personal' | 'shippin'>('personal');
  const [sourceView, setSourceView] = useState<'hydra' | 'qdrant'>('hydra');
  const [database, setDatabase] = useState('default-tenant');
  const [databases, setDatabases] = useState<DatabaseSummary[]>([]);
  const [databaseError, setDatabaseError] = useState('');
  const [collections, setCollections] = useState<{ database: string; names: string[]; error?: string } | null>(null);
  const [chosenCollection, setChosenCollection] = useState<{ database: string; name: string } | null>(null);
  const collection = chosenCollection?.database === database ? chosenCollection.name : collections?.database === database && collections.names.includes('gmail') ? 'gmail' : '';
  const collectionsReady = collections?.database === database;
  const [items, setItems] = useState<Item[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState('All context');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Item | null>(null);
  const [detail, setDetail] = useState<ExploreItemDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const trigger = useRef<HTMLElement | null>(null);
  const requestNumber = useRef(0);
  const refreshNumber = useRef(0);
  const loadDatabases = useCallback(async () => {
    try {
      const response = await fetch('/api/databases', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || body.error) throw new Error(body.error || 'Database status is unavailable.');
      setDatabases(body.databases); setDatabaseError(body.warnings?.join(' ') || '');
    } catch (error) { setDatabaseError(error instanceof Error ? error.message : 'Database status is unavailable.'); }
  }, []);
  useEffect(() => { void loadDatabases(); }, [loadDatabases]);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/explore/${database}/collections`, { cache: 'no-store', signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Collections could not load.');
        if (!controller.signal.aborted) setCollections({ database, names: body.collections });
      } catch { if (!controller.signal.aborted) setCollections({ database, names: [], error: 'Named source collections could not load. Only the default collection is shown.' }); }
    })();
    return () => controller.abort();
  }, [database]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!collectionsReady) return;
    const version = ++refreshNumber.current;
    setBusy(true);
    const targets = database === 'rrflow_specialist' && !collection ? [['seniordev', 'memory'], [database, 'knowledge']] : [[database, 'memory'], [database, 'knowledge']];
    const responses = await Promise.allSettled(targets.map(async ([sourceDatabase, type]) => {
      const response = await fetch(`/api/explore/${sourceDatabase}/items?kind=${type}&pageSize=100${collection ? `&collection=${encodeURIComponent(collection)}` : ''}`, { cache: 'no-store', signal });
      const body = await response.json();
      if (!response.ok) throw new Error(`${sourceDatabase}: ${body.error || 'Context could not be loaded.'}`);
      return (body as ExploreListResponse).items.map(item => ({ ...item, database: sourceDatabase }));
    }));
    if (signal?.aborted || version !== refreshNumber.current) return;
    const loaded = responses.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    if (responses.some(result => result.status === 'fulfilled')) {
      setItems(loaded.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? '')));
      setCheckedAt(new Date().toISOString());
    }
    setErrors(responses.flatMap(result => result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : 'Context could not be loaded.'] : []));
    setBusy(false);
  }, [database, collection, collectionsReady]);
  useEffect(() => {
    const abort = new AbortController();
    void refresh(abort.signal);
    const timer = setInterval(() => { if (!document.hidden) { void refresh(abort.signal); void loadDatabases(); } }, 30_000);
    return () => { abort.abort(); clearInterval(timer); };
  }, [refresh, loadDatabases]);
  const chooseDatabase = (name: string) => {
    if (name === database) { setFilter('All context'); setSearch(''); void refresh(); return; }
    refreshNumber.current++; requestNumber.current++;
    setItems([]); setCheckedAt(null); setErrors([]); setSelected(null); setDetail(null); setFilter('All context'); setSearch(''); setCollections(null); setChosenCollection(null); setBusy(true); setDatabase(name);
  };
  const chooseScope = (value: 'personal' | 'shippin') => { setScope(value); chooseDatabase(value === 'personal' ? 'default-tenant' : 'rrflow_specialist'); };
  const scopeName = (item: Item) => item.database === 'seniordev' ? 'Shared engineering practice' : scope === 'personal' ? 'Personal context' : 'Shippin context';
  const scopedDatabases = databases.filter(item => item.workspace === scope);
  const currentDatabase = databases.find(item => item.name === database);
  const openItem = async (item: Item) => {
    if (!selected) trigger.current = document.activeElement as HTMLElement;
    const current = ++requestNumber.current;
    setSelected(item); setDetail(null); setDetailError('');
    try {
      const query = new URLSearchParams({ kind: item.kind, ...(item.collection ? { collection: item.collection } : {}) });
      const response = await fetch(`/api/explore/${item.database}/items/${encodeURIComponent(item.id)}?${query}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'This context could not be opened.');
      if (requestNumber.current === current) setDetail(body);
    } catch (error) { if (requestNumber.current === current) setDetailError(error instanceof Error ? error.message : 'Context could not be opened.'); }
  };
  const categories = ['All context', 'Memory', 'Tool lesson', 'Best practice', 'Source'];
  const visible = items.filter(item => (filter === 'All context' || kind(item) === filter) && `${item.title} ${kind(item)} ${Object.values(item.metadata).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const edges = (workspace?.edges || []).map(edge => ({ source: workspace?.brains.find(brain => brain.id === edge.source)?.name || edge.source, target: workspace?.brains.find(brain => brain.id === edge.target)?.name || edge.target, relation: edge.kind === 'EXTENDS' ? 'builds on' : edge.kind === 'COMPOSES' ? 'works with' : edge.kind }));
  return <section className={styles.root} aria-label="Living connectome">
    <div className={styles.hero}><div><span className={styles.kicker}><Network size={15} /> YOUR CONTEXT, CONNECTED</span><h2>See what your mind knows.</h2><p>Open a skill. Follow a lesson. Inspect the source. Your knowledge stays understandable as it grows.</p></div><Button variant="outline" onClick={() => void refresh()} disabled={busy}><RefreshCw size={15} className={busy ? 'spin' : ''} />{busy ? 'Reading context…' : 'Refresh context'}</Button></div>
    <div className={styles.scopes}><div className={scope === 'personal' ? styles.activeScope : undefined}><span>PERSONAL</span><strong>Your life & ambitions</strong><p>Your existing default-tenant database belongs here, including its Gmail and GitHub context. Review proposed placements and save corrections in the Context inbox; a database membership alone does not classify every record.</p><button aria-pressed={scope === 'personal'} onClick={() => chooseScope('personal')}>Personal context <ChevronRight size={15} /></button></div><div className={scope === 'shippin' ? styles.activeScope : undefined}><span>SHIPPIN · WORK</span><strong>Three services. Shared understanding.</strong><p>shippin.ai · shippin.cloud · shipping.buzz</p><button aria-pressed={scope === 'shippin'} onClick={() => chooseScope('shippin')}>Shippin context <ChevronRight size={15} /></button><button onClick={onWork}>Open a project workflow <ChevronRight size={15} /></button></div></div>
    <div className={styles.databaseBar}><label>Knowledge database<select value={database} onChange={event => chooseDatabase(event.target.value)}>{!scopedDatabases.some(item => item.name === database) && <option value={database}>{database}</option>}{scopedDatabases.map(item => <option key={item.name} value={item.name}>{item.name}{item.ready === false ? ' · preparing' : ''}</option>)}</select></label><p>{scope === 'personal' ? 'Personal' : 'Shippin work'} · {currentDatabase ? currentDatabase.ready === true ? 'Ready in HydraDB' : currentDatabase.status || 'Readiness not yet confirmed' : 'Checking database status…'}</p><Button variant="outline" onClick={onManage}>Create or manage databases</Button></div>
    {databaseError && <p role="alert">{databaseError}</p>}
    <div className={styles.databaseBar}><label>Source collection<select aria-label="Source collection" value={collection} disabled={!collectionsReady} onChange={event => { refreshNumber.current++; requestNumber.current++; setItems([]); setSelected(null); setDetail(null); setCheckedAt(null); setErrors([]); setChosenCollection({ database, name: event.target.value }); }}><option value="">Default collection</option>{collections?.database === database && collections.names.filter(Boolean).map(name => <option key={name} value={name}>{name}</option>)}</select></label><p>Choose Gmail, GitHub, or another connected collection to inspect its actual sources.</p></div>
    {collections?.database === database && collections.error && <p role="alert">{collections.error}</p>}
    <div className={styles.products} aria-label="Connected products"><a href="https://github.com/digohq/app-starter" target="_blank" rel="noreferrer"><strong>Digo app-starter</strong><span>Our TypeScript application foundation</span><ExternalLink size={14} /></a><a href="https://dashboard.hydradb.com/graph" target="_blank" rel="noreferrer"><strong>HydraDB graph</strong><span>Open the native knowledge graph</span><ExternalLink size={14} /></a><a href="https://dashboard.hydradb.com/context" target="_blank" rel="noreferrer"><strong>HydraDB context</strong><span>Inspect the native source library</span><ExternalLink size={14} /></a></div>
    <div className={styles.connectome}>
      <div className={styles.visual}><div className={styles.sectionHead}><h3><BrainCircuit size={18} /> Shared engineering knowledge</h3><span>{workspace?.brains.length ?? '—'} disciplines</span></div><p>Shared research for your projects. Click a skill to reveal its knowledge avenues.</p><RelationGraph edges={edges} height={290} onSelect={name => { const brain = workspace?.brains.find(item => item.name === name); if (brain) onExplore(brain.id); }} /><div className={styles.skills}>{workspace?.brains.map(brain => <button key={brain.id} onClick={() => onExplore(brain.id)} aria-label={`Open ${brain.name} avenues`}><span>{brain.name}</span><strong>{brain.avenues}<small> avenues</small></strong></button>)}</div></div>
      <div className={styles.growth}><Sparkles size={25} /><h3>Knowledge you can inspect.</h3><p>Research, lessons, and sources have distinct roles. Every item opens its evidence and recorded relationships.</p><dl><div><dt>Research questions</dt><dd>{workspace?.brains.reduce((sum, brain) => sum + brain.questions, 0) ?? '—'}</dd></div><div><dt>Memories in this view</dt><dd>{items.filter(item => item.kind === 'memory').length}</dd></div><div><dt>Sources in this view</dt><dd>{items.filter(item => item.kind === 'knowledge').length}</dd></div></dl><p className={styles.fine}><Clock3 size={13} /> Read from HydraDB {date(checkedAt)}. Refreshes every 30 seconds while visible. Up to 100 items per scope.</p><a href="https://dashboard.hydradb.com/context" target="_blank" rel="noreferrer">Open HydraDB context <ExternalLink size={13} /></a></div>
    </div>
    <div className={styles.providerSwitch} aria-label="Context data providers"><button aria-pressed={sourceView === 'hydra'} onClick={() => setSourceView('hydra')}>HydraDB memories & sources</button><button aria-pressed={sourceView === 'qdrant'} onClick={() => setSourceView('qdrant')}>Qdrant source records</button><p>{sourceView === 'hydra' ? 'Actual stored records from the selected database and collection. Open an item to inspect its content, relationships and request receipts.' : 'Read the original Qdrant records and their HydraDB import status. Source records become knowledge after import; they are not labeled as generated memories.'}</p></div>
    {sourceView === 'qdrant' ? <QdrantSources /> : <div className={styles.library}><div className={styles.sectionHead}><div><h3>Latest context avenues</h3><p>Choose a memory or source to see what it means and where it connects.</p></div><label className={styles.search}><Search size={16} /><span className="sr-only">Find context</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a memory, lesson, or source…" /></label></div><div className={styles.filters}>{categories.map(category => <button key={category} aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}<span>{category === 'All context' ? items.length : items.filter(item => kind(item) === category).length}</span></button>)}</div>
      {errors.map(error => <p role="alert" key={error}>{error} {checkedAt && 'Available context remains visible.'}</p>)}
      <div className={styles.cards}>{visible.map(item => <button key={`${item.database}:${item.id}`} className={styles.card} onClick={() => void openItem(item)}><span className={styles.type}>{item.kind === 'memory' ? <Lightbulb size={15} /> : <BookOpen size={15} />}{kind(item)}</span><strong>{item.title}</strong><span className={styles.tags}>{typeof item.metadata.tool === 'string' && <span>{item.metadata.tool}</span>}<span>{scopeName(item)}</span><span>{item.additionalMetadata.source_system === 'qdrant' ? 'Qdrant → HydraDB' : 'HydraDB'}</span></span><span className={styles.cardFoot}><span>{date(item.timestamp)}</span><ChevronRight size={15} /></span></button>)}</div>
      {!busy && !visible.length && <p className={styles.empty}>{errors.length ? 'Some context could not be read. Refresh to retry.' : 'No matching context in this view. Try another type or search.'}</p>}
    </div>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) { setSelected(null); requestNumber.current++; } }}><DialogContent className={styles.dialog} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}><DialogHeader><DialogTitle>{selected?.title || 'Context'}</DialogTitle><DialogDescription>{selected ? `${kind(selected)} · ${scopeName(selected)} · ${date(selected.timestamp)}` : 'Source-backed context'}</DialogDescription></DialogHeader>{selected && <div className={styles.detail}><div className={styles.provenance}><strong>{selected.additionalMetadata.source_system === 'qdrant' ? 'Qdrant source stored in HydraDB' : selected.kind === 'memory' ? 'Memory read from HydraDB' : 'Source read from HydraDB'}</strong><span>{selected.database} / {selected.collection || 'default collection'}</span><span>Recorded update: {date(selected.timestamp)}</span><code>{selected.id}</code>{typeof selected.additionalMetadata.qdrant_collection === 'string' && <span>Original Qdrant collection: {selected.additionalMetadata.qdrant_collection}</span>}{typeof selected.additionalMetadata.source_version === 'string' && <code>Source revision: {selected.additionalMetadata.source_version}</code>}</div><h3>What this tells us</h3>{selected.description && <p>{selected.description}</p>}{typeof selected.additionalMetadata.evidence === 'string' && <p className={styles.evidence}>{selected.additionalMetadata.evidence}</p>}{detailError && <p role="alert">{detailError}</p>}{!detail && !detailError && <p role="status">Opening context and connections from HydraDB…</p>}{detail && <>{detail.content && <pre>{detail.content}</pre>}{!detail.content && !selected.description && !selected.additionalMetadata.evidence && <p>No readable body was returned for this item.</p>}{detail.failures.map(failure => <p role="alert" key={failure.call}>{failure.call}: {failure.message}</p>)}<h3>How it connects</h3>{detail.relations.length ? <><RelationGraph edges={detail.relations.map(relation => ({ source: relation.source.name, target: relation.target.name, relation: relation.predicate }))} height={260} /><ul>{detail.relations.slice(0, 12).map((relation, index) => <li key={index}><strong>{relation.source.name}</strong> {relation.predicate.replaceAll('_', ' ')} <strong>{relation.target.name}</strong>{relation.synthesized && ' · inferred relationship'}</li>)}</ul></> : <p>{detail.failures.some(failure => failure.call === 'relations') ? 'Relationships could not be loaded.' : 'No entity relationships were returned for this item.'}</p>}{detail.subgraph.sources.length > 0 && <div className={styles.neighbors}>{detail.subgraph.sources.filter(source => source.id !== selected.id).map(source => <button key={source.id} onClick={() => void openItem({ ...selected, id: source.id, title: source.title, description: null, metadata: {}, additionalMetadata: {} })}>{source.title}<ChevronRight size={14} /></button>)}</div>}<details><summary>Source and retrieval evidence</summary><p>{selected.database} · {selected.collection || 'default collection'}</p><p>{selected.id}</p>{detail.requestIds.map(id => <p key={id}>{id}</p>)}</details></>}</div>}</DialogContent></Dialog>
  </section>;
};
