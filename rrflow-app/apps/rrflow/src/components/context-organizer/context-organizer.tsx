'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Check, CheckCheck, ChevronRight, Clock3, Eye, EyeOff, Fingerprint, GitBranch, Inbox, Mail, RefreshCw, ShieldCheck, Sparkles, Split, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { destinationNames, organizationDatabases, organizationDatabaseNames, type Destination, type OrganizationItem, type OrganizationSnapshot } from '@/lib/organization-contracts';
import styles from './context-organizer.module.css';

const destinations: Destination[] = ['personal', 'shippin', 'review'];
const laneIcons = { personal: UserRound, shippin: BriefcaseBusiness, review: Fingerprint };
const clock = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const ContextOrganizer = ({ compact = false, onOpen }: { compact?: boolean; onOpen?: () => void }) => {
  const [database, setDatabase] = useState<OrganizationSnapshot['database']>('default-tenant');
  const [snapshot, setSnapshot] = useState<OrganizationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Destination | 'all'>('all');
  const [showTitles, setShowTitles] = useState(false);
  const [selected, setSelected] = useState<OrganizationItem | null>(null);
  const [destination, setDestination] = useState<Destination>('review');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const version = useRef(0);
  const trigger = useRef<HTMLElement | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const current = ++version.current; setLoading(true); setError('');
    try {
      const response = await fetch(`/api/organization?database=${database}`, { cache: 'no-store', signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'The context inbox could not load.');
      if (current === version.current && !signal?.aborted) setSnapshot(body);
    } catch (cause) { if (current === version.current && !signal?.aborted) setError(cause instanceof Error ? cause.message : 'Context could not load.'); }
    finally { if (current === version.current && !signal?.aborted) setLoading(false); }
  }, [database]);
  useEffect(() => {
    const controller = new AbortController(); void refresh(controller.signal);
    const timer = setInterval(() => { if (!document.hidden) void refresh(controller.signal); }, 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh]);
  const chooseDatabase = (value: OrganizationSnapshot['database']) => {
    version.current++; setSnapshot(null); setSelected(null); setNotice(''); setShowTitles(false); setFilter('all'); setDatabase(value);
  };
  const open = (item: OrganizationItem) => {
    trigger.current = document.activeElement as HTMLElement;
    setSelected(item); setDestination(item.destination); setNote(item.decision?.note ?? ''); setSaveError('');
  };
  const save = async () => {
    if (!selected || saving) return;
    setSaving(true); setSaveError('');
    try {
      const response = await fetch('/api/organization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ database, key: selected.key, sourceVersion: selected.sourceVersion, destination, note, expectedUpdatedAt: selected.decision?.updatedAt ?? null }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Your decision could not be saved.');
      setNotice(`${destination === 'review' ? 'Kept for review' : `Confirmed as ${destinationNames[destination]}`}. Saved in HydraDB. ${body.telemetry.status === 'accepted' ? 'Raindrop accepted the alignment review.' : 'Raindrop reporting is unavailable; your decision is saved.'}`);
      setSnapshot(previous => previous ? { ...previous, items: previous.items.map(item => item.key === selected.key ? { ...item, destination, decision: body.decision, changedSinceReview: false, reason: 'Your saved decision takes precedence over the routing suggestion.' } : item) } : previous);
      setSelected(null);
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Your decision could not be saved.'); }
    finally { setSaving(false); }
  };
  const items = snapshot?.items ?? [];
  const counts = Object.fromEntries(destinations.map(lane => [lane, items.filter(item => item.destination === lane).length])) as Record<Destination, number>;
  const confirmed = items.filter(item => item.decision && !item.changedSinceReview).length;
  const visible = items.filter(item => filter === 'all' || item.destination === filter);
  const title = (item: OrganizationItem) => showTitles ? item.source.title : item.matchedProject ? `${item.matchedProject} · ${item.provider}` : `${item.provider} ${item.source.kind === 'memory' ? 'memory' : 'source'} · title hidden`;
  const Provider = ({ item }: { item: OrganizationItem }) => item.provider === 'Gmail' ? <Mail size={18} /> : item.provider === 'GitHub' ? <GitBranch size={18} /> : <Inbox size={18} />;

  return <section className={`${styles.root} ${compact ? styles.compact : ''}`} aria-label="Context organization">
    <div className={styles.hero}>
      <div className={styles.intro}><span className={styles.eyebrow}><Split size={14} /> ONE LIFE. CLEAR CONTEXT.</span><h2>Your world.<br /><span>In the right place.</span></h2><p>Email, repositories, decisions. See what belongs to your life, what helps Shippin, and what needs your judgment.</p><div className={styles.heroActions}>{compact && <Button className="primary-button" onClick={onOpen}>Open context inbox <ArrowRight size={16} /></Button>}<span><ShieldCheck size={15} /> You stay in control</span></div></div>
      <div className={styles.flow} aria-label="How context is organized">
        <div className={styles.sourceNodes}><span><Mail size={16} /> Email</span><span><GitBranch size={16} /> Repositories</span><span><Sparkles size={16} /> Memories</span></div>
        <div className={styles.flowLine} aria-hidden="true"><i /></div>
        <div className={styles.engine}><span className={styles.engineIcon}><Split size={26} /></span><div><strong>RRFLOW aligns the context</strong><p>Source labels + project signals</p></div><span className={styles.liveDot} aria-hidden="true" /></div>
        <div className={styles.flowBranches} aria-hidden="true"><i /><i /><i /></div>
        <div className={styles.miniLanes}>{destinations.map(lane => { const Icon = laneIcons[lane]; return <div key={lane} data-lane={lane}><Icon size={18} /><strong>{destinationNames[lane]}</strong><span>{lane === 'personal' ? 'Life & ambitions' : lane === 'shippin' ? 'Projects & decisions' : 'You make the call'}</span></div>; })}</div>
        <p className={styles.flowCaption}><CheckCheck size={14} /> Your corrections become saved context for the next visit.</p>
      </div>
    </div>

    <div className={styles.toolbar}><div><span className={styles.eyebrow}>LIVE CONTEXT INBOX</span><h3>{compact ? 'A place for every piece of context.' : 'See the suggestion. Make the call.'}</h3></div><div className={styles.controls}><label className={styles.sourceSelect}>Source workspace<select aria-label="Source workspace" value={database} onChange={event => chooseDatabase(event.target.value as OrganizationSnapshot['database'])} disabled={saving}>{organizationDatabases.map(name => <option key={name} value={name}>{organizationDatabaseNames[name]}</option>)}</select></label><Button variant="outline" aria-label="Refresh context inbox" onClick={() => void refresh()} disabled={loading || saving}><RefreshCw size={15} className={loading ? 'spin' : ''} /></Button></div></div>
    <div className={styles.lanes}>{destinations.map(lane => { const Icon = laneIcons[lane]; return <button key={lane} data-lane={lane} aria-pressed={filter === lane} onClick={() => setFilter(filter === lane ? 'all' : lane)} className={styles.lane}><span className={styles.laneIcon}><Icon size={21} /></span><span className={styles.laneText}><strong>{destinationNames[lane]}</strong><small>{lane === 'personal' ? 'Your goals, growth & everyday life' : lane === 'shippin' ? 'shippin.ai · shippin.cloud · shipping.buzz' : 'Ambiguous, changed, or waiting on you'}</small></span><b>{snapshot ? counts[lane] : '—'}</b><ChevronRight size={16} /></button>; })}</div>
    <div className={styles.sampleBar}><p>{snapshot ? `${items.length} items in this sample · ${confirmed} reviewed by you` : 'Reading the latest source metadata from HydraDB…'}{snapshot && <span> · Checked {clock(snapshot.checkedAt)}</span>}</p><button onClick={() => setShowTitles(value => !value)}>{showTitles ? <EyeOff size={14} /> : <Eye size={14} />}{showTitles ? 'Hide source titles' : 'Show source titles'}</button></div>
    <p className={styles.explanation}>Suggestions organize references in this inbox. Confirmed placements stay attached to the original source in HydraDB; they do not move email or share source content between databases.</p>
    {error && <p role="alert" className={styles.error}>{error}{snapshot && ' Showing the last successful read.'}</p>}
    {snapshot?.errors.map((message, index) => <p key={index} role="alert" className={styles.error}>{message}</p>)}
    {notice && <p role="status" className={styles.notice}><Check size={16} />{notice}</p>}
    {!snapshot && loading && <div role="status" className={styles.skeleton}><i /><i /><i /></div>}
    <div className={styles.items}>{visible.slice(0, compact ? 3 : 40).map(item => <button key={item.key} className={styles.item} data-lane={item.destination} onClick={() => open(item)}><span className={styles.provider}><Provider item={item} /></span><span className={styles.itemMain}><strong>{title(item)}</strong><span>{item.reason}</span></span><span className={styles.itemStatus}><span>{item.decision && !item.changedSinceReview ? <CheckCheck size={14} /> : <Sparkles size={14} />}{destinationNames[item.destination]}</span><small>{item.decision && !item.changedSinceReview ? 'Your decision' : 'Suggested placement'}</small></span><ArrowUpRight size={16} /></button>)}</div>
    {snapshot && !visible.length && <div className={styles.empty}><CheckCheck size={24} /><h4>{items.length ? 'Nothing in this lane right now.' : 'Your inbox is ready for context.'}</h4><p>{items.length ? 'Choose another lane to inspect the available sources.' : 'Connect a source or choose another workspace. New items will be assessed when this inbox refreshes.'}</p></div>}
    <div className={styles.footer}><p><Clock3 size={14} /> Latest 40 from a bounded collection sample. Refreshes every minute while visible.</p>{compact ? <button onClick={onOpen}>Review the full inbox <ArrowRight size={14} /></button> : <details><summary>How placement works</summary><p>1. Read the native source metadata. 2. Respect your saved decisions. 3. Match explicit workspace or project signals. 4. Ask you when the evidence is unclear. This is rule-based routing, not a trained classifier. Changes to source metadata need a new review. Each read samples up to 20 sources and 20 memories from the default collection and up to six named collections, then shows the latest 40 returned items.</p>{snapshot?.requestIds.map(id => <code key={id}>{id}</code>)}</details>}</div>

    <Dialog open={!!selected} onOpenChange={value => { if (!value && !saving) setSelected(null); }}><DialogContent className={styles.dialog} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}><DialogHeader><DialogTitle>Give this context a home.</DialogTitle><DialogDescription>Your judgment takes priority. Save a placement for this source without moving the original.</DialogDescription></DialogHeader>{selected && <div className={styles.reviewBody}><div className={styles.reviewSource}><span className={styles.provider}><Provider item={selected} /></span><div><strong>{title(selected)}</strong><p>{selected.provider} · {organizationDatabaseNames[database]}</p></div></div><div className={styles.reason}><span><Sparkles size={16} /> Why this placement?</span><p>{selected.reason}</p>{selected.changedSinceReview && <p>Previous decision: {destinationNames[selected.decision!.destination]}</p>}</div><fieldset><legend>Where should this belong?</legend><div className={styles.choices}>{destinations.map(lane => { const Icon = laneIcons[lane]; return <label key={lane} data-selected={destination === lane}><input type="radio" name="destination" value={lane} checked={destination === lane} onChange={() => setDestination(lane)} disabled={saving} /><Icon size={17} />{destinationNames[lane]}</label>; })}</div></fieldset><label className={styles.note}>What should we remember about this decision? <span>Optional · stays in this source database</span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={240} rows={3} disabled={saving} placeholder="For example: this repository is a personal learning project." /></label><p className={styles.explanation}>This decision applies to this source. It does not create a rule for every future email or repository. Raindrop receives the suggestion and chosen category, without titles, source contents, or this note.</p>{saveError && <p role="alert" className={styles.error}>{saveError}</p>}<Button className="primary-button" onClick={() => void save()} disabled={saving || !snapshot?.decisionsAvailable}>{saving ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}{saving ? 'Saving your decision…' : 'Save placement'}</Button>{!snapshot?.decisionsAvailable && <p role="alert">Refresh the inbox before saving; existing decisions could not be read.</p>}</div>}</DialogContent></Dialog>
  </section>;
};
