'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, BrainCircuit, Check, ChevronRight,
  Circle, CircleAlert, Database, Fingerprint, GitBranch, Layers3,
  LoaderCircle, Menu, Moon, Network, Plus, Search, ShieldCheck, Sparkles, Sun,
  Workflow, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { brainCatalog, brainIds, type BrainDetail, type BrainId, type ReviewRun, type Workspace } from '@/lib/contracts';
import { cn } from '@/lib/utils';
import { SignOut } from '@/components/access/sign-out';

const LiveMesh = dynamic(() => import('@/components/live/live-mesh').then(module => module.LiveMesh), { loading: () => <div className="loading-bar">Opening the live specialist brains…</div> });
const BrainWorkspace = dynamic(() => import('@/components/brain-ui/brain-workspace').then(module => module.BrainWorkspace), { loading: () => <div className="loading-bar" role="status">Opening your brain workspace…</div> });
const KnowledgeMap = dynamic(() => import('@/components/knowledge-map/connectome').then(module => module.Connectome), { loading: () => <div className="loading-bar" role="status">Opening your connected context…</div> });
const ConnectionsConsole = dynamic(() => import('@/components/connections/connections-console').then(module => module.ConnectionsConsole), { loading: () => <div className="loading-bar">Loading connector controls…</div> });
const RepositorySync = dynamic(() => import('@/components/repository-sync/repository-sync').then(module => module.RepositorySync));
const DatabaseManager = dynamic(() => import('@/components/databases/database-manager').then(module => module.DatabaseManager), { loading: () => <div role="status" className="loading-bar">Loading your databases…</div> });
const ContextOrganizer = dynamic(() => import('@/components/context-organizer/context-organizer').then(module => module.ContextOrganizer), { loading: () => <div role="status" className="loading-bar">Opening your context inbox…</div> });
const LearningTrail = dynamic(() => import('@/components/learning/learning-trail').then(module => module.LearningTrail));
const QdrantSources = dynamic(() => import('@/components/qdrant/qdrant-sources').then(module => module.QdrantSources));
type View = 'overview' | 'organize' | 'connectome' | 'live' | 'brains' | 'brain-ui' | 'reviews' | 'improvement' | 'connections' | 'databases';
const navigation = [
  { id: 'overview', label: 'Overview', icon: Layers3 },
  { id: 'organize', label: 'Context inbox', icon: Fingerprint },
  { id: 'connectome', label: 'Connectome', icon: Network },
  { id: 'brain-ui', label: 'Brain workspace', icon: Sparkles },
  { id: 'live', label: 'Specialist brains', icon: Network },
  { id: 'brains', label: 'Engineering disciplines', icon: BrainCircuit },
  { id: 'reviews', label: 'Review work', icon: Workflow },
  { id: 'improvement', label: 'Learning trail', icon: Sparkles },
  { id: 'databases', label: 'Databases', icon: Database },
  { id: 'connections', label: 'Connections', icon: Network },
] as const;
const positions: Record<BrainId, { x: number; y: number }> = {
  core: { x: 50, y: 45 }, rust: { x: 22, y: 21 }, go: { x: 78, y: 21 },
  react: { x: 18, y: 69 }, nextjs: { x: 82, y: 69 }, typescript: { x: 50, y: 85 },
};
const brainMarks: Record<BrainId, string> = { core: '◎', rust: 'Rs', go: 'Go', react: '⚛', nextjs: 'N', typescript: 'TS' };

const readableTime = (date: string) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const BrainMark = ({ id, large = false }: { id: BrainId; large?: boolean }) =>
  <span aria-hidden="true" className={cn('brain-mark', `tone-${brainCatalog[id].color}`, large && 'large')}>{brainMarks[id]}</span>;

export const Dashboard = ({ protectedSession = false }: { protectedSession?: boolean }) => {
  const [view, setView] = useState<View>('overview');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selected, setSelected] = useState<BrainId>('core');
  const [detail, setDetail] = useState<BrainDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [newReview, setNewReview] = useState(false);
  const [review, setReview] = useState<ReviewRun | null>(null);
  const [reviewError, setReviewError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const detailRequest = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/workspace', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load the workspace.');
      setWorkspace(previous => !body.connected && previous?.brains.length
        ? { ...previous, connected: false, error: body.error }
        : body as Workspace);
      setError(body.error || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to connect.');
      setWorkspace(previous => previous ? { ...previous, connected: false } : previous);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setMounted(true); }, []);

  const loadBrain = useCallback(async (id: BrainId) => {
    const request = ++detailRequest.current;
    setSelected(id); setDetail(null); setDetailError('');
    try {
      const response = await fetch(`/api/brains/${id}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load this brain.');
      if (request === detailRequest.current) setDetail(body as BrainDetail);
    } catch (cause) {
      if (request === detailRequest.current) setDetailError(cause instanceof Error ? cause.message : 'Unable to load this brain.');
    }
  }, []);
  useEffect(() => {
    if (workspace?.brains.length) void loadBrain(selected);
  }, [workspace, selected, loadBrain]);

  const handleImport = async () => {
    setBusy(true); setError(''); setNotice('Importing your six research documents into HydraDB…');
    try {
      const response = await fetch('/api/research/import', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Import could not finish. It is safe to retry.');
      setNotice('Your research is connected. Every question retains its source and draft status.');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Import failed.'); setNotice(''); }
    finally { setBusy(false); }
  };
  const handleNavigate = (next: View) => { setView(next); setMobileNav(false); setSearch(''); };
  const handleDeleteReview = async () => {
    if (!review) return;
    setBusy(true); setReviewError('');
    try {
      const response = await fetch(`/api/reviews/${review.id}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to delete this plan.');
      setReview(null); setNotice('The review plan was deleted. Your research is unchanged.');
      await refresh();
    } catch (cause) { setReviewError(cause instanceof Error ? cause.message : 'Unable to delete this plan.'); }
    finally { setBusy(false); }
  };
  const handleExplore = (id: BrainId) => { void loadBrain(id); setDrawer(true); };
  const brains = workspace?.brains || [];
  const totals = brains.reduce((total, brain) => ({ questions: total.questions + brain.questions, avenues: total.avenues + brain.avenues }), { questions: 0, avenues: 0 });
  const visibleBrains = brains.filter(brain => `${brain.name} ${brain.subtitle} ${brain.description}`.toLowerCase().includes(search.toLowerCase()));
  const currentBrain = brains.find(brain => brain.id === selected);
  const hasBrains = brains.length > 0;
  const displayName = navigation.find(item => item.id === view)?.label || 'Overview';

  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#main">Skip to workspace</a>
      {mobileNav && <button aria-label="Close navigation" className="nav-scrim" onClick={() => setMobileNav(false)} />}
      <aside className={cn('sidebar', mobileNav && 'is-open')}>
        <Link className="wordmark" href="/" aria-label="RRFLOW home"><span className="logo-symbol"><Workflow size={23} /></span> rrflow<span className="wordmark-dot">.</span></Link>
        <div className="workspace-switch"><span className="workspace-avatar">r.</span><div><strong>RRFLOW workspace</strong><small>Personal + Shippin work</small></div></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          {navigation.map(item => <button key={item.id} onClick={() => handleNavigate(item.id)} aria-current={view === item.id ? 'page' : undefined} className={cn('nav-item', view === item.id && 'active')}><item.icon size={18} /><span>{item.label}</span>{item.id === 'brains' && <span className="nav-count">{brains.length || '—'}</span>}</button>)}
        </nav>
        <div className="sidebar-note"><span className="eyebrow"><Fingerprint size={15} /> YOUR KNOWLEDGE, CONNECTED</span><p>One connected mind.<br />Every decision traceable.</p><div className="mini-path"><i /><span /><i /><span /><i /></div></div>
        <div className="sidebar-bottom">
          <div className="powered"><Database size={16} /><div><strong>Powered by HydraDB</strong><small>One place for knowledge & work</small></div></div>
          <div className="user"><span className="avatar">J</span><div><strong>Jesse</strong><small>Local workspace</small></div><span className="local-chip">LOCAL</span></div>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={14} /><strong>{displayName}</strong></div>
          <div className="topbar-actions">{protectedSession && <SignOut />}<span className={cn('connection-pill', workspace?.connected && 'connected')}><span className="status-dot" />{workspace?.connected ? 'HydraDB connected' : workspace ? 'Connection needed' : 'Connecting'}</span><span className="topbar-divider" /><button className="icon-button theme-toggle" aria-label={mounted && resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>{mounted && resolvedTheme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><span className="avatar small">J</span></div>
        </header>

        <main id="main" tabIndex={-1}>
          <div className="page-heading"><div><div className="eyebrow accent"><span className="tiny-line" /> CONTEXT, WITH EVIDENCE</div><h1>{view === 'overview' ? 'Your context. Working together.' : displayName}</h1><p>{view === 'overview' ? 'Personal life and Shippin work, organized with evidence and your judgment.' : view === 'organize' ? 'Understand every placement. Confirm what fits. Correct what does not.' : view === 'connectome' ? 'Memories, research, and source connections — all in one explorable view.' : view === 'live' ? 'Live knowledge and memory for your company and service specialists.' : view === 'brain-ui' ? 'A living workspace, populated from your knowledge and measured with Raindrop.' : view === 'brains' ? 'Explore the research and questions behind every specialist.' : view === 'reviews' ? 'Make the work explicit, then gather the evidence to verify it.' : view === 'improvement' ? 'Learn from measured outcomes. Keep every revision traceable.' : 'See what is connected and what still needs to be configured.'}</p></div><Button className="primary-button" onClick={() => setNewReview(true)} disabled={!hasBrains || !workspace?.connected}><Plus size={16} />Start a review</Button></div>

          {error && <div role="alert" className="message error"><CircleAlert size={18} /><span>{error}{hasBrains && !workspace?.connected && <small className="stale-notice">Showing the last successful read from {readableTime(workspace!.checkedAt)}.</small>}</span><Button variant="ghost" size="sm" onClick={() => void refresh()}>Retry connection</Button></div>}
          {notice && <div role="status" className="message notice">{busy ? <LoaderCircle size={18} className="spin" /> : <Check size={18} />}<span>{notice}</span></div>}
          {!workspace && !error && <div className="loading-bar" role="status"><LoaderCircle size={17} className="spin" />Connecting to your knowledge workspace…</div>}
          {workspace?.connected && !hasBrains && <section className="onboarding glass"><div className="onboarding-orb"><BrainCircuit size={35} /></div><div><span className="eyebrow accent">YOUR FOUNDATION IS READY</span><h2>Give your specialist its knowledge.</h2><p>Import your six existing research documents. RRFLOW will connect each question to its source and organize it into knowledge avenues.</p><p className="fine-print">Research drafts remain drafts. Importing does not validate their claims.</p><Button className="primary-button" onClick={handleImport} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <ArrowDownToLine size={16} />}Import research into HydraDB</Button></div></section>}

          {view === 'overview' && <><ContextOrganizer compact onOpen={() => handleNavigate('organize')} /><section aria-label="Live context and quality" className="mb-8"><LiveMesh embedded dashboard><BrainWorkspace compact /></LiveMesh></section></>}
          {view === 'organize' && <ContextOrganizer />}

          {hasBrains && (view === 'overview' || view === 'brains') && <>
            <div className="stats-strip">
              <Stat icon={<BrainCircuit size={18} />} value={brains.length} label="Engineering disciplines" note="Within the senior dev brain" />
              <Stat icon={<GitBranch size={18} />} value={totals.avenues} label="Knowledge avenues" note="Open the right path" />
              <Stat icon={<ShieldCheck size={18} />} value={totals.questions} label="Review questions" note="Grounded in your research" />
              <Stat icon={<BookOpen size={18} />} value={brains.length} label="Source documents" note="Versioned & traceable" />
            </div>
            {view === 'overview' && <div className="mind-grid">
              <section className="connectome glass" aria-label="Knowledge connectome">
                <div className="section-head"><div><h2><Network size={17} /> The connectome</h2><p>Select a brain to explore its knowledge.</p></div><span className="subtle-pill"><span className="status-dot" /> LIVE GRAPH</span></div>
                <div className="graph-surface">
                  <div className="graph-grid" /><div className="graph-glow" />
                  <svg className="graph-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    {(workspace?.edges || []).map(edge => { const a = positions[edge.source as BrainId]; const b = positions[edge.target as BrainId]; return a && b ? <path key={`${edge.source}-${edge.target}-${edge.kind}`} d={`M ${a.x} ${a.y} Q 50 ${(a.y + b.y) / 2} ${b.x} ${b.y}`} className={cn(edge.source === selected || edge.target === selected ? 'edge-active' : '', edge.kind === 'COMPOSES' && 'edge-composes')} /> : null; })}
                  </svg>
                  {brains.map(brain => <button key={brain.id} style={{ '--node-x': `${positions[brain.id].x}%`, '--node-y': `${positions[brain.id].y}%` } as CSSProperties} className={cn('graph-node', brain.id === 'core' && 'core-node', selected === brain.id && 'selected')} onClick={() => void loadBrain(brain.id)} aria-label={`Select ${brain.name} brain`} aria-pressed={selected === brain.id}><BrainMark id={brain.id} large={brain.id === 'core'} /><strong>{brain.id === 'core' ? 'Engineering core' : brain.name}</strong><small>{brain.id === 'core' ? 'SWEBOK-aligned foundation' : brain.subtitle}</small></button>)}
                </div>
                <div className="graph-footer"><span><i className="legend-line" /> Shared foundation</span><span><i className="legend-line dashed" /> Composable knowledge</span><span className="graph-help">Click to explore <ArrowUpRight size={12} /></span></div>
              </section>
              <section className="inspector glass" aria-label="Selected brain">
                <div className="inspector-top"><BrainMark id={selected} /><span className="draft-pill">Research draft</span></div>
                <div className="eyebrow">{currentBrain?.kind || 'BRAIN'}</div><h2>{currentBrain?.name}</h2><p>{currentBrain?.description}</p>
                <div className="inspector-counts"><div><strong>{currentBrain?.avenues}</strong><small>Avenues</small></div><div><strong>{currentBrain?.questions}</strong><small>Questions</small></div></div>
                <h3>Knowledge avenues</h3>
                {detailError && <p role="alert" className="inline-error">{detailError}</p>}
                {!detail && !detailError ? <div className="detail-loading"><LoaderCircle size={17} className="spin" />Loading from HydraDB…</div> : <div className="avenue-preview">{detail?.avenues.slice(0, 3).map(avenue => <button key={avenue.id} onClick={() => setDrawer(true)}><span className="avenue-dot" /><span>{avenue.title}</span><ChevronRight size={14} /></button>)}</div>}
                <Button variant="outline" className="explore-button" onClick={() => setDrawer(true)}>Explore this brain <ArrowRight size={15} /></Button>
                <div className="source-footnote"><BookOpen size={13} />Sourced from your research. Ready for review.</div>
              </section>
            </div>}
            <section className="library-section">
              <div className="library-heading"><div><h2>Your knowledge library <span className="number-tag">{brains.length}</span></h2><p>Specialists that share a foundation and bring their own expertise.</p></div><label className="search-input"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a brain…" aria-label="Find a brain" /><span>⌕</span></label></div>
              <div className="brain-cards">{visibleBrains.map(brain => <button key={brain.id} className="brain-card glass" onClick={() => handleExplore(brain.id)} aria-label={`Explore ${brain.name}`}><div className="brain-card-top"><BrainMark id={brain.id} /><ArrowUpRight size={17} /></div><h3>{brain.name}</h3><p>{brain.subtitle}</p><div className="brain-card-footer"><span>{brain.avenues} avenues</span><span>{brain.questions} questions</span></div></button>)}</div>
              {visibleBrains.length === 0 && <div className="empty-small">No brains match “{search}”. Try a language or area of work.</div>}
            </section>
          </>}

          {(view === 'reviews' || (view === 'overview' && hasBrains)) && <section className="reviews-section glass"><div className="section-head"><div><h2><Workflow size={17} /> {view === 'overview' ? 'Work in motion' : 'Your reviews'}</h2><p>Saved plans and the evidence still needed to complete them.</p></div><span className="number-tag">{workspace?.runs.length || 0}</span></div>{workspace?.runs.length ? <div className="run-list">{workspace.runs.map(run => <button className="run-row" key={run.id} onClick={() => setReview(run)}><span className="run-icon"><GitBranch size={19} /></span><span className="run-title"><strong>{run.goal}</strong><small>{brainCatalog[run.stack].name} · {run.questionCount} questions · {readableTime(run.createdAt)}</small></span><span className="waiting-pill">Needs evidence</span><ChevronRight size={16} /></button>)}</div> : <div className="empty-review"><div><h3>Start with a clear goal.</h3><p>Choose a specialist. Open the relevant knowledge. Know what needs checking.</p></div><Button variant="outline" onClick={() => setNewReview(true)} disabled={!hasBrains}>Create your first review <ArrowRight size={15} /></Button></div>}</section>}
          {view === 'improvement' && <LearningTrail />}
          {view === 'live' && <LiveMesh embedded />}
          {view === 'brain-ui' && <BrainWorkspace />}
          {view === 'connectome' && <KnowledgeMap workspace={workspace} onExplore={handleExplore} onWork={() => setView('brain-ui')} onManage={() => setView('databases')} />}
          {view === 'databases' && <DatabaseManager />}
          {view === 'connections' && <Connections evidence={workspace?.evidence} connected={workspace?.connected || false} brains={brains.length} busy={busy} onImport={handleImport} onRefresh={() => void refresh()} />}
          {view === 'connections' && <><QdrantSources /><DatabaseManager /><RepositorySync /><ConnectionsConsole /></>}
          <footer className="page-footer"><span>Built on <a href="https://github.com/digohq/app-starter" target="_blank" rel="noreferrer">Digo app-starter</a> <span>·</span> Knowledge lives in HydraDB</span><span><span className="status-dot" /> Methodical by design.</span></footer>
        </main>
      </div>
      <Dialog open={drawer} onOpenChange={setDrawer}><DialogContent className="brain-dialog"><DialogHeader><DialogTitle><span className="dialog-title-row"><BrainMark id={selected} />{brainCatalog[selected].name}</span></DialogTitle><DialogDescription>Explore the source-backed avenues in this brain. These questions are draft research; answers and pass conditions have not been evaluated.</DialogDescription></DialogHeader>{detail && <><div className="source-banner"><BookOpen size={18} /><div><strong>{detail.brain.sourceTitle}</strong><a href={detail.brain.sourceUrl} target="_blank" rel="noreferrer">Open original research <ArrowUpRight size={13} /></a><small>Source revision {detail.brain.revision.slice(0, 8)} · Version claims need verification</small><details className="request-evidence"><summary>View retrieval evidence</summary>{detail.requestIds.map(id => <code key={id}>{id}</code>)}</details></div></div><div className="avenue-list">{detail.avenues.map(avenue => <details key={avenue.id}><summary><span>{avenue.title}</span><span>{avenue.questions.length} questions</span></summary>{avenue.domain && <p className="domain-label">{avenue.domain}</p>}<ol>{avenue.questions.map(question => <li key={question.id}><p>{question.text}</p><small>{question.term}</small>{question.binding && <div className="binding"><Fingerprint size={12} />Needs: {question.binding}</div>}</li>)}</ol></details>)}</div></>}{!detail && <div role="status" className="detail-loading">{detailError || 'Loading knowledge from HydraDB…'}</div>}</DialogContent></Dialog>
      <ReviewForm open={newReview} onOpenChange={setNewReview} onSaved={async saved => { setNewReview(false); setReview(saved); setNotice('Review saved to HydraDB. The next step is gathering evidence.'); await refresh(); }} />
      <Dialog open={!!review} onOpenChange={open => { if (!open) setReview(null); }}><DialogContent className="review-dialog"><DialogHeader><DialogTitle>Your review plan</DialogTitle><DialogDescription>The relevant knowledge is connected. Evidence and execution are still required.</DialogDescription></DialogHeader>{review && <><h3 className="review-goal">{review.goal}</h3><div className="review-brains">{review.brainIds.map(id => <span className="subtle-pill" key={id}><BrainMark id={id} />{brainCatalog[id].name}</span>)}</div><div className="review-steps">{[{ title: 'Define the work', description: 'Goal and specialist selected by you.', done: true }, { title: 'Open the knowledge', description: `${review.avenueCount} avenues and ${review.questionCount} draft questions retrieved from HydraDB.`, done: true }, { title: 'Gather evidence', description: 'Connect the repository, diff, requirements, and test results.', done: false }, { title: 'Review and verify', description: 'Evaluate each applicable question. Missing evidence stays unknown.', done: false }, { title: 'Learn from the outcome', description: 'Compare a candidate improvement in Raindrop before promotion.', done: false }].map((step, index) => <div key={step.title} className={cn('review-step', step.done && 'done')}><span>{step.done ? <Check size={15} /> : index + 1}</span><div><h4>{step.title}</h4><p>{step.description}</p></div></div>)}</div><div className="honesty-note"><CircleAlert size={16} /><p>This is a saved, deterministic planning flow. No code execution, AI assessment, or automated improvement has run.</p></div><div className="record-id">Saved {readableTime(review.createdAt)} · Record {review.id.slice(0, 8)}</div>{reviewError && <p role="alert" className="inline-error">{reviewError}</p>}<Button variant="ghost" size="sm" onClick={handleDeleteReview} disabled={busy}><Trash2 size={14} />Delete plan</Button></>}</DialogContent></Dialog>
    </div>
  );
};

const Stat = ({ icon, value, label, note }: { icon: React.ReactNode; value: number; label: string; note: string }) =>
  <div className="stat"><div className="stat-label">{icon}{label}</div><strong>{value.toLocaleString()}</strong><small>{note}</small></div>;

const ReviewForm = ({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: (review: ReviewRun) => Promise<void> }) => {
  const [goal, setGoal] = useState('');
  const [stack, setStack] = useState<Exclude<BrainId, 'core'>>('nextjs');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef<{ id: string; goal: string; stack: string } | null>(null);
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    if (!attempt.current || attempt.current.goal !== goal || attempt.current.stack !== stack) attempt.current = { id: crypto.randomUUID(), goal, stack };
    try {
      const response = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attempt.current) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save your review.');
      await onSaved(body as ReviewRun); setGoal(''); attempt.current = null;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save.'); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={next => { if (!saving) onOpenChange(next); }}><DialogContent className="review-dialog"><DialogHeader><DialogTitle>What are you shipping?</DialogTitle><DialogDescription>Start with the outcome. RRFLOW will connect the right research and prepare a review plan.</DialogDescription></DialogHeader><form onSubmit={handleSubmit} className="review-form"><label htmlFor="review-goal">The work to review</label><textarea id="review-goal" required minLength={8} maxLength={1000} value={goal} onChange={event => setGoal(event.target.value)} placeholder="For example: Review the Next.js dashboard before launching shippin.cloud" rows={4} /><label htmlFor="review-stack">Which specialist should lead?</label><select id="review-stack" value={stack} onChange={event => setStack(event.target.value as Exclude<BrainId, 'core'>)}>{brainIds.filter(id => id !== 'core').map(id => <option key={id} value={id}>{brainCatalog[id].name} — {brainCatalog[id].subtitle}</option>)}</select><div className="composition-note"><GitBranch size={17} /><p>Engineering core + {brainCatalog[stack].name}{stack === 'nextjs' || stack === 'react' ? ' + TypeScript' : ''}<small>Chosen explicitly. No repository detection has run.</small></p></div>{error && <p role="alert" className="inline-error">{error}</p>}<Button className="primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <Workflow size={16} />}{saving ? 'Connecting the knowledge…' : 'Create review plan'}</Button></form></DialogContent></Dialog>;
};


const Connections = ({ evidence, connected, brains, busy, onImport, onRefresh }: { evidence?: Workspace['evidence']; connected: boolean; brains: number; busy: boolean; onImport: () => void; onRefresh: () => void }) => <div className="connection-grid"><section className="glass connection-card"><Database size={25} /><span className={cn('connection-pill', connected && 'connected')}><span className="status-dot" />{connected ? 'Connected' : 'Needs attention'}</span><h2>HydraDB</h2><p>Your authoritative graph for brains, source revisions, knowledge avenues, and review plans.</p><dl><div><dt>Database</dt><dd>{evidence?.database || 'Awaiting connection'}</dd></div><div><dt>Access</dt><dd>Server only · Infisical</dd></div><div><dt>Knowledge</dt><dd>{brains} imported brains</dd></div></dl><div className="button-row"><Button variant="outline" onClick={onRefresh}>Check connection</Button><Button variant="outline" onClick={onImport} disabled={busy || !connected}>{busy ? <LoaderCircle className="spin" size={15} /> : <ArrowDownToLine size={15} />}Reimport research</Button></div></section><section className="glass connection-card"><Network size={25} /><span className="waiting-pill">Not connected</span><h2>Your infrastructure</h2><p>The next expansion connects this engineering mind to the systems you run.</p><ul className="planned-systems"><li><Circle size={11} />Tailnet discovery</li><li><Circle size={11} />Cisco dedicated servers</li><li><Circle size={11} />Proxmox · WI / TX / VA</li><li><Circle size={11} />Homelab & service mapping</li></ul><div className="source-footnote"><ShieldCheck size={14} />No infrastructure has been discovered or changed.</div></section></div>;
