'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, Database, ExternalLink, GitBranch, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActivity } from '@/components/transparency/activity-provider';
import { SYNC_REPOSITORY, type RepositorySyncSnapshot } from '@/lib/repository-sync-contracts';

const stamp = (at: string | null | undefined) => at ? new Date(at).toLocaleString() : 'Not recorded yet';
const phases = { ingesting: 'Sending changed files', indexing: 'Making knowledge searchable', searchable: 'Ready to use', failed: 'Needs attention' };

export const RepositorySync = () => {
  const [snapshot, setSnapshot] = useState<RepositorySyncSnapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const { record, recordBackground, setPanelOpen } = useActivity();
  const refresh = useCallback(async (manual = false) => {
    if (active.current) return;
    active.current = true; setBusy(true);
    try {
      const response = await fetch('/api/repository-sync', { cache: 'no-store' });
      const body = await response.json() as RepositorySyncSnapshot;
      if (manual) record('Checked GitHub knowledge sync', body.receipts ?? [], { notify: response.ok ? 'info' : 'error' });
      else recordBackground(body.receipts ?? []);
      if (!response.ok || body.error) throw new Error(body.error || 'Could not check repository sync.');
      setSnapshot(body); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Repository sync status is unavailable.'); }
    finally { active.current = false; setBusy(false); }
  }, [record, recordBackground]);
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30_000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  const state = snapshot?.state;
  const pending = state ? Math.max(0, state.total - state.searchable - state.failed) : null;
  return <section aria-label="GitHub knowledge sync" className="rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Code becomes shared knowledge</p><h2 className="mt-1 text-xl font-semibold">GitHub → Company brain</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Pushing to main updates the brain with changed source files and retires removed files. This panel reads the workflow&apos;s checkpoint directly from HydraDB.</p></div>
      <Button variant="outline" onClick={() => void refresh(true)} disabled={busy}><RefreshCw className={busy ? 'motion-safe:animate-spin' : ''} aria-hidden />{busy ? 'Checking sync…' : 'Check sync now'}</Button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/50 p-3 text-sm">{error}{snapshot && ' Showing the last successfully checked status below.'}</p>}
    <div className="my-5 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <a href={`https://github.com/${SYNC_REPOSITORY}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-xl border bg-background p-4 text-sm font-medium"><GitBranch className="size-5 shrink-0" aria-hidden /><span className="break-all">{SYNC_REPOSITORY}</span><ExternalLink className="size-4 shrink-0" aria-hidden /></a>
      <ArrowRight className="mx-auto size-5 rotate-90 text-muted-foreground sm:rotate-0" aria-hidden />
      <div className="flex items-center gap-3 rounded-xl border bg-background p-4"><Database className="size-5" aria-hidden /><div className="text-sm"><p className="font-medium">Company brain</p><p className="text-xs text-muted-foreground">HydraDB · rrflow_specialist</p></div></div>
    </div>
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-semibold">{state?.phase === 'searchable' ? <CheckCircle2 className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden /> : state?.phase === 'failed' ? <CircleAlert className="size-5 text-destructive" aria-hidden /> : <Clock3 className="size-5" aria-hidden />}{state ? phases[state.phase] : snapshot ? 'Waiting for the first GitHub sync' : 'Reading the sync checkpoint…'}</div>
    {state ? <>
      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Ready to search', state.searchable], ['Still processing', pending], ['Indexing failures', state.failed], ['Files retired', state.deleted]].map(([label, value]) => <div key={label} className="rounded-xl border bg-background/70 p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd></div>)}</dl>
      <p className="mt-3 text-sm text-muted-foreground">{state.accepted} of {state.changed} changed files accepted in this run. {state.completed} of {state.total} sources have finished all indexing stages.</p>
      {state.error && <p role="alert" className="mt-3 rounded-lg border border-destructive/50 p-3 text-sm">{state.error} Open the workflow below and rerun failed jobs after resolving the cause.</p>}
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Latest source change</dt><dd>{stamp(state.sourceAt)} · {state.commit.slice(0, 8)}</dd></div><div><dt className="text-muted-foreground">Workflow last updated</dt><dd>{stamp(state.updatedAt)}</dd></div><div><dt className="text-muted-foreground">Last successful sync</dt><dd>{stamp(state.lastSuccessfulAt)}</dd></div><div><dt className="text-muted-foreground">Raindrop observation</dt><dd>{state.raindrop.status === 'accepted' ? `Event accepted${state.raindrop.httpStatus ? ` · HTTP ${state.raindrop.httpStatus}` : ''}` : state.raindrop.status === 'failed' ? 'Delivery failed — knowledge status is separate' : 'Waiting for the workflow to report'}</dd></div></dl>
      <details className="mt-4 rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Sync evidence and native request IDs</summary><p className="mt-2 break-all text-muted-foreground">Raindrop event: {state.raindrop.eventId}</p><ul className="mt-2 space-y-1 font-mono text-xs">{state.requestIds.map((id, index) => <li key={`${id}-${index}`} className="break-all">{id}</li>)}</ul><p className="mt-2 text-muted-foreground">Ready to search means HydraDB reported graph_creation or completed. It does not claim a model was trained.</p></details>
    </> : snapshot && <p className="mt-3 text-sm text-muted-foreground">The repository workflow has not recorded a checkpoint yet. A push to main or a manual workflow run starts it.</p>}
    <div className="mt-5 flex flex-wrap items-center gap-4 text-sm"><a className="inline-flex items-center gap-1 underline underline-offset-4" href={state?.runUrl ?? `https://github.com/${SYNC_REPOSITORY}/actions/workflows/hydradb-sync.yml`} target="_blank" rel="noreferrer">Open GitHub sync workflow<ExternalLink className="size-3" aria-hidden /></a><Button variant="ghost" size="sm" onClick={() => setPanelOpen(true)}>Inspect sync requests</Button><p className="text-xs text-muted-foreground">Last checked: {stamp(snapshot?.checkedAt)} · Refreshes every 30 seconds while visible</p></div>
  </section>;
};
