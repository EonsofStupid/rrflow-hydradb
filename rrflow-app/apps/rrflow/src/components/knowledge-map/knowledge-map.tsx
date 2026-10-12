'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, BrainCircuit, ChevronRight, Clock3, ExternalLink, Lightbulb, Network, RefreshCw, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RelationGraph } from '@/components/explore/relation-graph';
import type { BrainId, Workspace } from '@/lib/contracts';
import type { ExploreItem, ExploreItemDetail, ExploreListResponse } from '@/lib/explore-contracts';
import styles from './knowledge-map.module.css';

type Item = ExploreItem & { database: string };
const date = (value: string | null) => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Update time unavailable';
const kind = (item: Item) => item.kind === 'knowledge' ? 'Source' : item.metadata.kind === 'quirk' ? 'Tool lesson' : item.metadata.kind === 'practice' ? 'Best practice' : 'Memory';

export const KnowledgeMap = ({ workspace, onExplore, onWork }: { workspace: Workspace | null; onExplore: (id: BrainId) => void; onWork: () => void }) => {
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
  const refresh = useCallback(async () => {
    setBusy(true);
    const responses = await Promise.allSettled([
      ['seniordev', 'memory'], ['rrflow_specialist', 'knowledge'],
    ].map(async ([database, type]) => {
      const response = await fetch(`/api/explore/${database}/items?kind=${type}&pageSize=100`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(`${database}: ${body.error || 'Context could not be loaded.'}`);
      return (body as ExploreListResponse).items.map(item => ({ ...item, database }));
    }));
    const loaded = responses.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    if (responses.some(result => result.status === 'fulfilled')) {
      setItems(loaded.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? '')));
      setCheckedAt(new Date().toISOString());
    }
    setErrors(responses.flatMap(result => result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : 'Context could not be loaded.'] : []));
    setBusy(false);
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 30_000); return () => clearInterval(timer); }, [refresh]);
  const openItem = async (item: Item) => {
    trigger.current = document.activeElement as HTMLElement;
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
    <div className={styles.scopes}><div><span>PERSONAL</span><strong>Your life & ambitions</strong><p>Personal routing and its review inbox are being established. Company records below are kept in the Shippin scope.</p></div><div className={styles.activeScope}><span>SHIPPIN · WORK</span><strong>Three services. Shared understanding.</strong><p>shippin.ai · shippin.cloud · shipping.buzz</p><button onClick={onWork}>Open a project workflow <ChevronRight size={15} /></button></div></div>
    <div className={styles.connectome}>
      <div className={styles.visual}><div className={styles.sectionHead}><h3><BrainCircuit size={18} /> Engineering knowledge</h3><span>{workspace?.brains.length ?? '—'} disciplines</span></div><p>Click a connected skill to reveal its knowledge avenues.</p><RelationGraph edges={edges} height={290} onSelect={name => { const brain = workspace?.brains.find(item => item.name === name); if (brain) onExplore(brain.id); }} /><div className={styles.skills}>{workspace?.brains.map(brain => <button key={brain.id} onClick={() => onExplore(brain.id)} aria-label={`Open ${brain.name} avenues`}><span>{brain.name}</span><strong>{brain.avenues}<small> avenues</small></strong></button>)}</div></div>
      <div className={styles.growth}><Sparkles size={25} /><h3>Knowledge you can inspect.</h3><p>Research, lessons, and sources have distinct roles. Every item opens its evidence and recorded relationships.</p><dl><div><dt>Research questions</dt><dd>{workspace?.brains.reduce((sum, brain) => sum + brain.questions, 0) ?? '—'}</dd></div><div><dt>Memories in this view</dt><dd>{items.filter(item => item.kind === 'memory').length}</dd></div><div><dt>Sources in this view</dt><dd>{items.filter(item => item.kind === 'knowledge').length}</dd></div></dl><p className={styles.fine}><Clock3 size={13} /> Read from HydraDB {date(checkedAt)}. Refreshes every 30 seconds while visible. Up to 100 items per scope.</p><a href="https://dashboard.hydradb.com/context" target="_blank" rel="noreferrer">Open HydraDB context <ExternalLink size={13} /></a></div>
    </div>
    <div className={styles.library}><div className={styles.sectionHead}><div><h3>Latest context avenues</h3><p>Choose a memory or source to see what it means and where it connects.</p></div><label className={styles.search}><Search size={16} /><span className="sr-only">Find context</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a memory, lesson, or source…" /></label></div><div className={styles.filters}>{categories.map(category => <button key={category} aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}<span>{category === 'All context' ? items.length : items.filter(item => kind(item) === category).length}</span></button>)}</div>
      {errors.map(error => <p role="alert" key={error}>{error} {checkedAt && 'Available context remains visible.'}</p>)}
      <div className={styles.cards}>{visible.map(item => <button key={`${item.database}:${item.id}`} className={styles.card} onClick={() => void openItem(item)}><span className={styles.type}>{item.kind === 'memory' ? <Lightbulb size={15} /> : <BookOpen size={15} />}{kind(item)}</span><strong>{item.title}</strong><span className={styles.tags}>{typeof item.metadata.tool === 'string' && <span>{item.metadata.tool}</span>}<span>{item.database === 'seniordev' ? 'Engineering practice' : 'Shippin context'}</span></span><span className={styles.cardFoot}><span>{date(item.timestamp)}</span><ChevronRight size={15} /></span></button>)}</div>
      {!busy && !visible.length && <p className={styles.empty}>{errors.length ? 'Some context could not be read. Refresh to retry.' : 'No matching context in this view. Try another type or search.'}</p>}
    </div>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) { setSelected(null); requestNumber.current++; } }}><DialogContent className={styles.dialog} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}><DialogHeader><DialogTitle>{selected?.title || 'Context'}</DialogTitle><DialogDescription>{selected ? `${kind(selected)} · ${selected.database === 'seniordev' ? 'Engineering practice' : 'Shippin context'} · ${date(selected.timestamp)}` : 'Source-backed context'}</DialogDescription></DialogHeader>{selected && <div className={styles.detail}><h3>What this tells us</h3>{selected.description && <p>{selected.description}</p>}{typeof selected.additionalMetadata.evidence === 'string' && <p className={styles.evidence}>{selected.additionalMetadata.evidence}</p>}{detailError && <p role="alert">{detailError}</p>}{!detail && !detailError && <p role="status">Opening context and connections from HydraDB…</p>}{detail && <>{detail.content && <pre>{detail.content}</pre>}{!detail.content && !selected.description && !selected.additionalMetadata.evidence && <p>No readable body was returned for this item.</p>}{detail.failures.map(failure => <p role="alert" key={failure.call}>{failure.call}: {failure.message}</p>)}<h3>How it connects</h3>{detail.relations.length ? <><RelationGraph edges={detail.relations.map(relation => ({ source: relation.source.name, target: relation.target.name, relation: relation.predicate }))} height={260} /><ul>{detail.relations.slice(0, 12).map((relation, index) => <li key={index}><strong>{relation.source.name}</strong> {relation.predicate.replaceAll('_', ' ')} <strong>{relation.target.name}</strong>{relation.synthesized && ' · inferred relationship'}</li>)}</ul></> : <p>{detail.failures.some(failure => failure.call === 'relations') ? 'Relationships could not be loaded.' : 'No entity relationships were returned for this item.'}</p>}{detail.subgraph.sources.length > 0 && <div className={styles.neighbors}>{detail.subgraph.sources.filter(source => source.id !== selected.id).map(source => <button key={source.id} onClick={() => void openItem({ ...selected, id: source.id, title: source.title, description: null, metadata: {}, additionalMetadata: {} })}>{source.title}<ChevronRight size={14} /></button>)}</div>}<details><summary>Source and retrieval evidence</summary><p>{selected.database} · {selected.collection || 'default collection'}</p><p>{selected.id}</p>{detail.requestIds.map(id => <p key={id}>{id}</p>)}</details></>}</div>}</DialogContent></Dialog>
  </section>;
};
