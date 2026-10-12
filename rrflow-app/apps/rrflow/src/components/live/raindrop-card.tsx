'use client';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActivity } from '@/components/transparency/activity-provider';
import { timeAgo } from './format';

/** Organization of the verified rrflow-hydradb project (read back in the Raindrop UI on 2026-10-12). */
const RAINDROP_ORG = 'ea2ca283';

/**
 * A drop falls into the pool each time Raindrop accepts something this session.
 * Keyed by the accepted count so a new delivery replays the animation; nothing animates for a failure.
 */
const RaindropPool = ({ accepted, isMonitored }: { accepted: number; isMonitored: boolean }) => (
  <svg viewBox="0 0 80 96" className="h-24 w-20 shrink-0" aria-hidden>
    <style>{`@keyframes rrflowDropFall{0%{transform:translateY(-30px);opacity:0}15%{opacity:1}70%{transform:translateY(34px);opacity:1}100%{transform:translateY(38px);opacity:0}}
      @keyframes rrflowRipple{0%{rx:2;ry:1;opacity:.9}100%{rx:30;ry:6;opacity:0}}
      @keyframes rrflowIdle{0%{transform:translateY(-30px);opacity:0}20%{opacity:.35}80%{transform:translateY(34px);opacity:.35}100%{transform:translateY(38px);opacity:0}}
      .rrflow-drop{animation:rrflowDropFall .9s cubic-bezier(.5,0,.75,0) forwards}
      .rrflow-ripple{animation:rrflowRipple 1s ease-out .75s both}
      .rrflow-idle{animation:rrflowIdle 3.6s ease-in infinite}
      @media (prefers-reduced-motion: reduce){.rrflow-drop,.rrflow-ripple,.rrflow-idle{animation:none;opacity:0}}`}</style>
    <ellipse cx={40} cy={80} rx={30} ry={6} fill="none" stroke="#38bdf8" strokeOpacity={0.35} />
    {isMonitored && <path d="M40 22c0 0-7 9-7 14a7 7 0 0 0 14 0c0-5-7-14-7-14z" fill="#38bdf8" className="rrflow-idle" />}
    {accepted > 0 && (
      <g key={accepted}>
        <path d="M40 22c0 0-9 11-9 18a9 9 0 0 0 18 0c0-7-9-18-9-18z" fill="#38bdf8" className="rrflow-drop" />
        <ellipse cx={40} cy={80} rx={2} ry={1} fill="none" stroke="#38bdf8" strokeWidth={2} className="rrflow-ripple" />
      </g>
    )}
  </svg>
);

/** Plain-language view of what RRFLOW sends to Raindrop and whether Raindrop actually accepted it. */
export const RaindropCard = ({ project, isMonitored, now }: { project: string | null; isMonitored: boolean; now: number }) => {
  const { entries, setPanelOpen } = useActivity();
  const deliveries = entries.flatMap(entry => entry.receipts).filter(receipt => receipt.service === 'Raindrop');
  const accepted = deliveries.filter(receipt => receipt.outcome === 'ok');
  const events = accepted.filter(receipt => receipt.endpoint.endsWith('/events/track')).length;
  const verdicts = accepted.filter(receipt => receipt.endpoint.endsWith('/signals/track')).length;
  const failed = deliveries.length - accepted.length;
  const last = deliveries[0];

  return (
    <section aria-labelledby="raindrop-heading" className="rounded-lg border border-sky-400/40 bg-sky-400/[0.03] p-4">
      <div className="flex items-start gap-4">
        <RaindropPool accepted={accepted.length} isMonitored={isMonitored} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="raindrop-heading" className="text-lg font-semibold">Quality monitoring · Raindrop</h2>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs',
              isMonitored ? 'border-sky-400/50 text-sky-800 dark:text-sky-300' : 'border-border text-muted-foreground')}>
              <span className={cn('size-2 rounded-full', isMonitored ? 'bg-sky-400' : 'bg-muted-foreground/40')} aria-hidden />
              {isMonitored && project ? `Reporting to project ${project}` : 'Not configured'}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Searches, generated knowledge interfaces, and your feedback report real delivery results here.
            Counts cover this browser session. Open Raindrop for the full project history and quality investigation.
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
            <div><dt className="text-xs text-muted-foreground">Events accepted</dt><dd className="font-semibold tabular-nums">{events}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Verdicts accepted</dt><dd className="font-semibold tabular-nums">{verdicts}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Failed deliveries</dt><dd className={cn('font-semibold tabular-nums', failed > 0 && 'text-rose-400')}>{failed}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            {last
              ? `Last delivery: ${last.action} · ${last.httpStatus === null ? 'no response' : `HTTP ${last.httpStatus}`} · ${timeAgo(last.at, now)}`
              : 'Counts cover this browser session. Ask a brain to send the first one.'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {isMonitored && project && (
              <a href={`https://app.raindrop.ai/events?org=${RAINDROP_ORG}&project=${encodeURIComponent(project)}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/50 px-3 py-1.5 hover:bg-sky-400/10">
                Open project in Raindrop <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
            {deliveries.length > 0 && (
              <button type="button" onClick={() => setPanelOpen(true)} className="text-xs underline underline-offset-2 hover:text-foreground">
                See each delivery
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
