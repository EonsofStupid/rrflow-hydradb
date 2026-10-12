'use client';
import { BookOpen, Bot, Building2, Cloud, Database, FileText, KeyRound, Megaphone, Radar } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  meshCatalog, meshGroupOf, projectGroups,
  type BrainPulse, type BrainState, type MeshBrainId, type MeshSnapshot, type ProjectGroup,
} from '@/lib/mesh-contracts';
import { formatCount, timeAgo } from './format';

const ICONS: Record<MeshBrainId, typeof Cloud> = {
  rrflow_specialist: Building2, shippin_cloud: Cloud, shippin_ai: Bot, shipping_buzz: Megaphone, seniordev: BookOpen,
};
const ROLE_LABEL = { company: 'Shared context for the cluster', service: 'Service specialist', practice: 'Practices and lessons' } as const;
const STATE_LABEL: Record<BrainState, string> = { ready: 'Ready', warming_up: 'Warming up', unreachable: 'Not reachable' };
const STATE_DOT: Record<BrainState, string> = { ready: 'bg-emerald-400', warming_up: 'bg-amber-400', unreachable: 'bg-rose-500' };
const STATE_STROKE: Record<BrainState, string> = { ready: '#34d399', warming_up: '#fbbf24', unreachable: '#f43f5e' };
const KIND_LABEL: Record<string, string> = {
  decision: 'Decision', plan: 'Plan', setup: 'Setup', instructions: 'Instructions', coordination: 'Coordination', research: 'Research',
};

/**
 * Node positions in the diagram. The Shippin cluster sits inside one boundary with its
 * company brain at the centre; the practice brain sits outside because it serves every project.
 */
const LAYOUT: Record<MeshBrainId, { x: number; y: number; labelDx: number; labelDy: number; anchor: 'start' | 'middle' | 'end' }> = {
  rrflow_specialist: { x: 200, y: 136, labelDx: 34, labelDy: 4, anchor: 'start' },
  shippin_cloud: { x: 80, y: 84, labelDx: 0, labelDy: -24, anchor: 'middle' },
  shippin_ai: { x: 200, y: 62, labelDx: 0, labelDy: -24, anchor: 'middle' },
  shipping_buzz: { x: 320, y: 84, labelDx: 0, labelDy: -24, anchor: 'middle' },
  seniordev: { x: 200, y: 246, labelDx: 0, labelDy: 32, anchor: 'middle' },
};

const MeshDiagram = ({ brains }: { brains: BrainPulse[] }) => {
  const centre = LAYOUT.rrflow_specialist;
  const ready = brains.filter(brain => brain.state === 'ready').length;
  return (
    <svg viewBox="0 0 400 296" className="h-auto w-full" role="img"
      aria-label={`Brain map: the Shippin cluster holds four brains around its company brain; the engineering practice brain sits outside it. ${ready} of ${brains.length} brains ready. Lines show intended roles, not live cross-database queries.`}>
      <style>{`@keyframes rrflowPulse{0%{r:26;opacity:.5}100%{r:44;opacity:0}}.rrflow-pulse{animation:rrflowPulse 2.4s ease-out infinite}
        @media (prefers-reduced-motion: reduce){.rrflow-pulse{animation:none}}`}</style>
      <rect x={12} y={14} width={376} height={176} rx={14} fill="rgb(52 211 153 / 0.04)" stroke="#34d399" strokeOpacity={0.45} strokeDasharray="4 4" />
      <text x={24} y={30} className="fill-emerald-400 text-[10px] font-semibold tracking-widest">SHIPPIN CLUSTER</text>
      <text x={24} y={212} className="fill-current text-[10px] font-semibold tracking-widest">ENGINEERING PRACTICE</text>
      {brains.filter(brain => brain.id !== 'rrflow_specialist').map(brain => {
        const node = LAYOUT[brain.id];
        return (
          <line key={brain.id} x1={centre.x} y1={centre.y} x2={node.x} y2={node.y}
            stroke={STATE_STROKE[brain.state]} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="6 6" />
        );
      })}
      <circle cx={centre.x} cy={centre.y} r={26} fill="none" stroke="#34d399" className="rrflow-pulse" />
      {brains.map(brain => {
        const node = LAYOUT[brain.id];
        const isCentre = brain.id === 'rrflow_specialist';
        return (
          <g key={brain.id}>
            <circle cx={node.x} cy={node.y} r={isCentre ? 24 : 15} fill="rgb(15 23 42)" stroke={STATE_STROKE[brain.state]} strokeWidth={2} />
            <text x={node.x + node.labelDx} y={node.y + node.labelDy} textAnchor={node.anchor} className="fill-current text-[11px]">
              {meshCatalog[brain.id].name}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const BrainCard = ({ brain }: { brain: BrainPulse }) => {
  const info = meshCatalog[brain.id];
  const Icon = ICONS[brain.id];
  return (
    <article className={cn('min-w-0 rounded-lg border border-border bg-card p-4 text-card-foreground', info.role === 'company' && 'col-span-full')}
      aria-labelledby={`brain-${brain.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-md bg-muted p-2"><Icon className="size-5" aria-hidden /></span>
          <div className="min-w-0">
            <h3 id={`brain-${brain.id}`} className="break-words font-semibold">{info.name}</h3>
            <p className="text-xs text-muted-foreground">{ROLE_LABEL[info.role]}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs">
          <span className={cn('size-2 rounded-full', STATE_DOT[brain.state])} aria-hidden />
          {STATE_LABEL[brain.state]}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{info.purpose}</p>
      <dl className="mt-3 flex gap-6 text-sm">
        <div><dt className="text-xs text-muted-foreground">Memories</dt><dd className="font-semibold tabular-nums">{formatCount(brain.memories)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Knowledge passages</dt><dd className="font-semibold tabular-nums">{formatCount(brain.knowledge)}</dd></div>
      </dl>
      {brain.state === 'ready' && brain.memories === 0 && brain.knowledge === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">No indexed memories or knowledge passages reported.</p>
      )}
      {brain.error && <p className="mt-2 text-xs text-rose-400">{brain.error}</p>}
      {brain.statsError && <p className="mt-2 text-xs text-muted-foreground">{brain.statsError}</p>}
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">Technical evidence</summary>
        <p className="mt-1 font-mono">HydraDB database: {brain.id}</p>
        <p className="font-mono">Response time: {brain.latencyMs === null ? 'no answer' : `${brain.latencyMs} ms`}</p>
        <p className="font-mono break-all">Request ID: {brain.requestId ?? 'none'}</p>
        <p className="font-mono break-all">Statistics request ID: {brain.statsRequestId ?? 'none'}</p>
      </details>
    </article>
  );
};

/** The documents the cluster shares as context; real titles from HydraDB, newest first. */
const ClusterContext = ({ context, now }: { context: MeshSnapshot['shippinContext']; now: number }) => (
  <section aria-labelledby="cluster-context-heading" className="col-span-full rounded-lg border border-border bg-background/40 p-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 id="cluster-context-heading" className="font-semibold">What the cluster knows</h3>
      <p className="text-xs text-muted-foreground">
        {context.total === null ? 'Document count unavailable' : `${formatCount(context.total)} documents in the company brain`}
      </p>
    </div>
    <p className="text-sm text-muted-foreground">
      The team&apos;s own working documents, synced automatically whenever they change. Every Shippin specialist draws on this context.
    </p>
    {context.error ? (
      <p role="alert" className="mt-3 rounded-md border border-border p-3 text-sm">{context.error}</p>
    ) : context.sources.length === 0 ? (
      <p className="mt-3 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">No documents listed yet.</p>
    ) : (
      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {context.sources.slice(0, 8).map(source => {
          const [path, heading] = source.title.split(' — ');
          return (
            <li key={source.id} className="flex min-w-0 items-start gap-2 rounded-md border border-border p-2">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={source.title}>{heading ?? path}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {source.kind ? `${KIND_LABEL[source.kind] ?? source.kind} · ` : ''}{heading ? path : ''} · {timeAgo(source.updatedAt, now)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    )}
    {context.sources.length > 8 && (
      <p className="mt-2 text-xs text-muted-foreground">and {context.sources.length - 8} more documents.</p>
    )}
    {context.requestId && <p className="mt-2 break-all font-mono text-xs text-muted-foreground">Listing request ID: {context.requestId}</p>}
  </section>
);

const ProjectFacts = ({ raindropProject }: { raindropProject: string | null }) => (
  <ul className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="Shippin cluster boundaries">
    <li className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"><Database className="size-3.5" aria-hidden />4 HydraDB brains</li>
    <li className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"><KeyRound className="size-3.5" aria-hidden />Secrets: Infisical project rrflow-hydradb</li>
    <li className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
      <Radar className="size-3.5" aria-hidden />{raindropProject ? `Monitoring: Raindrop project ${raindropProject}` : 'Monitoring: Raindrop not configured'}
    </li>
  </ul>
);

const GroupFrame = ({ group, className, children }: { group: ProjectGroup; className?: string; children: React.ReactNode }) => (
  <section aria-labelledby={`group-${group}`} className={cn('rounded-xl border p-4', className)}>
    <h3 id={`group-${group}`} className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{projectGroups[group].name}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{projectGroups[group].summary}</p>
    {children}
  </section>
);

type BrainMeshProps = Pick<MeshSnapshot, 'brains' | 'shippinContext' | 'otherDatabases' | 'raindropProject'> & { now: number };

export const BrainMesh = ({ brains, shippinContext, otherDatabases, raindropProject, now }: BrainMeshProps) => {
  const inGroup = (group: ProjectGroup) => brains.filter(brain => meshGroupOf[brain.id] === group);
  return (
    <section aria-labelledby="mesh-heading" className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="self-start rounded-lg border border-border bg-card p-4 lg:sticky lg:top-4">
        <h2 id="mesh-heading" className="text-lg font-semibold">The brain mesh</h2>
        <p className="text-sm text-muted-foreground">
          Brains are grouped by project. Each brain is its own HydraDB database; a search asks one brain at a time.
        </p>
        <div className="mt-4 text-muted-foreground"><MeshDiagram brains={brains} /></div>
      </div>
      <div className="min-w-0 space-y-4">
        <GroupFrame group="shippin" className="border-emerald-400/40 bg-emerald-400/[0.03]">
          <ProjectFacts raindropProject={raindropProject} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {inGroup('shippin').map(brain => <BrainCard key={brain.id} brain={brain} />)}
            <ClusterContext context={shippinContext} now={now} />
          </div>
        </GroupFrame>
        <GroupFrame group="practice" className="border-border">
          <div className="mt-4 grid gap-4">{inGroup('practice').map(brain => <BrainCard key={brain.id} brain={brain} />)}</div>
        </GroupFrame>
        <section aria-labelledby="other-databases" className="rounded-xl border border-dashed border-border p-4">
          <h3 id="other-databases" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Personal and other source databases</h3>
          {otherDatabases === null ? (
            <p className="mt-1 text-sm text-muted-foreground">The database listing could not be read on this refresh.</p>
          ) : otherDatabases.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">None. Every database this key can reach is shown above.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">default-tenant is your Personal database, including connected Gmail and GitHub context. The Shippin specialist brains remain separate. Automatic classification and human corrections are still being developed.</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {otherDatabases.map(name => <li key={name} className="rounded-full border border-border px-2.5 py-1 font-mono text-xs">{name}</li>)}
              </ul>
            </>
          )}
        </section>
      </div>
    </section>
  );
};
