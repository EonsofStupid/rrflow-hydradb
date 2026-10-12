'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, BookOpen, Brain, Clock, Database, RefreshCw, TriangleAlert, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeshSnapshot } from '@/lib/mesh-contracts';
import { useActivity } from '@/components/transparency/activity-provider';
import { VerifyHydraButton } from '@/components/transparency/verify-button';
import { AskBrain } from './ask-brain';
import { BrainMesh } from './brain-mesh';
import { formatCount, isToday, timeAgo } from './format';
import { LearningFeed } from './learning-feed';
import { RaindropCard } from './raindrop-card';

const REFRESH_MS = 10_000;

/**
 * How RRFLOW works through a task. `isLive` is honest: only steps that run
 * against real HydraDB data today are marked live; the rest are what we are building next.
 */
const REASONING_STEPS = [
  { title: 'Understand the task', detail: 'Find the service, goal and what is affected.', isLive: false },
  { title: 'Open the right knowledge', detail: 'Ask the relevant brains, not everything at once.', isLive: true },
  { title: 'Follow the links', detail: 'Move from a service to its setup, decisions and past problems.', isLive: false },
  { title: 'Check the evidence', detail: 'Only accept a result that has proof attached.', isLive: false },
  { title: 'Act and observe', detail: 'Do the work within its permissions and watch what happens.', isLive: false },
  { title: 'Remember the lesson', detail: 'The team records lessons; automated learning is next.', isLive: true },
] as const;

type Ticker = { label: string; value: string; hint: string; icon: typeof Brain };

const buildTickers = (snapshot: MeshSnapshot, now: number): Ticker[] => {
  const ready = snapshot.brains.filter(brain => brain.state === 'ready').length;
  const sum = (pick: (brain: MeshSnapshot['brains'][number]) => number | null): number | null => {
    const counts = snapshot.brains.map(pick);
    return counts.some(count => count === null) ? null : counts.reduce<number>((total, count) => total + (count ?? 0), 0);
  };
  const latencies = snapshot.brains.map(brain => brain.latencyMs).filter((value): value is number => value !== null);
  return [
    { label: 'Brains online', value: `${ready} / ${snapshot.brains.length}`, hint: 'Ready for ingestion and retrieval', icon: Brain },
    { label: 'Memories', value: formatCount(sum(brain => brain.memories)), hint: 'Lessons, decisions and notes', icon: BookOpen },
    { label: 'Knowledge passages', value: formatCount(sum(brain => brain.knowledge)), hint: 'Indexed sections of documents the brains have read', icon: Database },
    { label: 'Recorded today', value: snapshot.learningError ? '—' : formatCount(snapshot.learning.filter(item => isToday(item.at, now)).length), hint: 'Entries in the current memory feed', icon: Activity },
    { label: 'HydraDB response', value: latencies.length ? `${Math.max(...latencies)} ms` : '—', hint: 'Slowest brain this refresh', icon: Zap },
    { label: 'Last update', value: timeAgo(snapshot.checkedAt, now), hint: `Refreshes every ${REFRESH_MS / 1000} seconds`, icon: Clock },
  ];
};

export const LiveMesh = ({ embedded = false }: { embedded?: boolean }) => {
  const [snapshot, setSnapshot] = useState<MeshSnapshot | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef<AbortController | null>(null);
  const { record, recordBackground } = useActivity();

  /** Automatic refreshes are logged quietly; a refresh the person asks for is announced. */
  const refresh = useCallback(async (isRequested = false) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/mesh', { cache: 'no-store', signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'RRFLOW could not read the brains.');
      const next = body as MeshSnapshot;
      setSnapshot(next);
      setFailure(next.connected ? null : next.error ?? 'HydraDB could not be reached.');
      if (isRequested) {
        const failed = next.receipts.filter(receipt => receipt.outcome === 'failed').length;
        record(failed ? `Refreshed from HydraDB with ${failed} failed call${failed === 1 ? '' : 's'}` : 'Refreshed from HydraDB', next.receipts, {
          summary: `${next.receipts.length} live calls · slowest ${Math.max(0, ...next.receipts.map(receipt => receipt.latencyMs ?? 0))} ms`,
        });
      } else {
        recordBackground(next.receipts);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      // Keep the last good picture on screen and say plainly that it is old.
      const message = error instanceof Error ? error.message : 'RRFLOW could not read the brains.';
      setFailure(message);
      if (isRequested) record('Refresh failed', [], { notify: 'error', summary: message });
    } finally {
      if (inFlight.current === controller) setIsRefreshing(false);
    }
  }, [record, recordBackground]);

  useEffect(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), REFRESH_MS);
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    return () => { clearInterval(poll); clearInterval(clock); inFlight.current?.abort(); };
  }, [refresh]);

  const isLive = !!snapshot?.connected && !failure;

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <p className="inline-flex items-center gap-2" aria-live="polite">
              <span className={cn('size-2.5 rounded-full', isLive ? 'animate-pulse bg-emerald-400' : 'bg-amber-400')} aria-hidden />
              {isLive ? 'Live from HydraDB' : snapshot ? 'Showing the last update' : 'Connecting to HydraDB…'}
            </p>
            {snapshot && (
              <p className="inline-flex items-center gap-2">
                <span className={cn('size-2.5 rounded-full', snapshot.isMonitored ? 'bg-sky-400' : 'bg-muted-foreground/40')} aria-hidden />
                {snapshot.isMonitored ? 'Raindrop reporting configured' : 'Raindrop reporting not configured'}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <VerifyHydraButton />
            <button type="button" onClick={() => void refresh(true)} disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60">
              <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} aria-hidden /> Refresh now
            </button>
          </div>
        </div>
        {!embedded && <><h1 className="mt-4 text-2xl font-bold sm:text-3xl">RRFLOW specialist brains</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Explore the knowledge, decisions and lessons behind your Shippin services.</p></>}
      </header>

      {failure && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
          <span>{snapshot ? `The latest refresh failed, so this is the picture from ${timeAgo(snapshot.checkedAt, now)}. ` : ''}{failure}</span>
        </p>
      )}

      {!snapshot ? (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6" aria-busy="true" aria-label="Loading live figures">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-lg border border-border bg-card" />)}
        </div>
      ) : (
        <>
          <section aria-label="Live figures" className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {buildTickers(snapshot, now).map(ticker => (
              <div key={ticker.label} className="rounded-lg border border-border bg-card p-4">
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><ticker.icon className="size-4" aria-hidden />{ticker.label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{ticker.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{ticker.hint}</p>
              </div>
            ))}
          </section>

          <section aria-labelledby="reasoning-heading" className="rounded-lg border border-border bg-card p-4">
            <h2 id="reasoning-heading" className="text-lg font-semibold">How RRFLOW works through a task</h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {REASONING_STEPS.map((step, index) => (
                <li key={step.title} className={cn('rounded-md border p-3', step.isLive ? 'border-emerald-400/50 bg-emerald-400/5' : 'border-border')}>
                  <p className="text-xs text-muted-foreground">Step {index + 1} · {step.isLive ? 'Live now' : 'Next'}</p>
                  <p className="mt-1 font-medium">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                </li>
              ))}
            </ol>
          </section>

          <BrainMesh brains={snapshot.brains} shippinContext={snapshot.shippinContext} otherDatabases={snapshot.otherDatabases}
            raindropProject={snapshot.raindropProject} now={now} />

          <RaindropCard project={snapshot.raindropProject} isMonitored={snapshot.isMonitored} now={now} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <LearningFeed items={snapshot.learning} now={now} error={snapshot.learningError} requestId={snapshot.learningRequestId} />
            <AskBrain />
          </div>
        </>
      )}
    </div>
  );
};
