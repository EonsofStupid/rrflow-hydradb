'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  ChevronRight,
  Database,
  ExternalLink,
  FlaskConical,
  Layers,
  LoaderCircle,
  RefreshCw,
  Waypoints,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type ExploreDatabase,
  type ExploreDatabasesResponse,
  type ExploreItem,
  type ExploreItemDetail,
  type ExploreKind,
  type ExploreListResponse,
  type LabQueryInput,
  type LabQueryResponse,
  type QueryMode,
} from '@/lib/explore-contracts';
import { RelationGraph } from './relation-graph';

/**
 * Brain Explorer: HydraDB as the UI. Discovers every database the server key
 * can reach, then drills database → collection → item → content, extracted
 * relations and subgraph. Query Lab runs `POST /query` with every knob.
 *
 * Reads only through this app's `/api/explore/*` routes; the key never
 * reaches the browser. Every panel names the HydraDB call behind it and shows
 * the request id, so a non-engineer can still point at the evidence.
 */

type Fetched<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'failed'; message: string; requestId: string | null };

const useFetch = <T,>() => {
  const [state, setState] = useState<Fetched<T>>({ status: 'idle' });
  const run = useCallback(async (input: string, init?: RequestInit) => {
    setState({ status: 'loading' });
    try {
      const response = await fetch(input, { ...init, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setState({
          status: 'failed',
          message: body?.error ?? `The server answered ${response.status}.`,
          requestId: body?.requestId ?? null,
        });
        return null;
      }
      setState({ status: 'ready', data: body as T });
      return body as T;
    } catch {
      setState({ status: 'failed', message: 'RRFLOW could not reach its server.', requestId: null });
      return null;
    }
  }, []);
  return [state, run, setState] as const;
};

const formatCount = (value: number | null): string => (value === null ? 'unknown' : value.toLocaleString());

const Chip = ({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-pressed={active}
    className={cn(
      'rounded-full border px-3 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary',
    )}
  >
    {children}
  </button>
);

const Tag = ({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'strong' | 'faint' }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] leading-4',
      tone === 'strong' && 'border-primary/40 bg-primary/10 text-foreground',
      tone === 'default' && 'border-border text-muted-foreground',
      tone === 'faint' && 'border-border/60 text-muted-foreground/70',
    )}
  >
    {children}
  </span>
);

const Failure = ({ message, requestId }: { message: string; requestId: string | null }) => (
  <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
    {message}
    {requestId && <span className="ml-2 font-mono text-[11px] text-muted-foreground">request {requestId}</span>}
  </p>
);

const Spinner = () => (
  <div className="flex justify-center py-8" role="status" aria-live="polite">
    <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
    <span className="sr-only">Loading</span>
  </div>
);

// -----------------------------------------------------------------------------

export const BrainExplorer = ({ embedded = false }: { embedded?: boolean }) => {
  const [databases, loadDatabases] = useFetch<ExploreDatabasesResponse>();
  const [selectedDatabase, setDatabase] = useState<string | null>(null);
  const [collection, setCollection] = useState<string | null>(null);
  const [kind, setKind] = useState<ExploreKind>('knowledge');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ExploreItem | null>(null);
  const [tab, setTab] = useState<'browse' | 'lab'>('browse');

  const refresh = useCallback(() => loadDatabases('/api/explore'), [loadDatabases]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const list = databases.status === 'ready' ? databases.data.databases : [];
  const database = selectedDatabase ?? (list.find(entry => entry.ready) ?? list[0])?.name ?? null;
  const current = list.find((entry) => entry.name === database) ?? null;

  const pick = (name: string) => {
    setDatabase(name);
    setCollection(null);
    setPage(1);
    setSelected(null);
  };

  const Heading = embedded ? 'h2' : 'h1';

  return (
    <section aria-labelledby="explorer-heading" className={cn('space-y-5', !embedded && 'mx-auto max-w-7xl px-4 py-8')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading id="explorer-heading" className={cn('flex items-center gap-2 font-semibold', embedded ? 'text-lg' : 'text-2xl')}>
            <Boxes className="h-5 w-5" aria-hidden />
            Brain Explorer
          </Heading>
          <p className="text-sm text-muted-foreground">
            Every HydraDB brain this workspace can reach, discovered live. Drill from brain → collection → item → graph, or open the Query Lab.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={databases.status === 'loading'}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary disabled:opacity-50"
        >
          {databases.status === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Refresh
        </button>
      </div>

      {databases.status === 'failed' && <Failure message={databases.message} requestId={databases.requestId} />}

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Database className="h-4 w-4" aria-hidden />
          Brains <span className="font-normal">{list.length}</span>
          <span className="font-mono text-[10px] font-normal">GET /databases · /databases/status · /databases/stats · /databases/collections</span>
        </h3>
        {databases.status === 'loading' && list.length === 0 ? (
          <Spinner />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {list.map((entry) => (
              <DatabaseCard key={entry.name} entry={entry} selected={entry.name === database} onSelect={() => pick(entry.name)} />
            ))}
            {databases.status === 'ready' && list.length === 0 && (
              <p className="text-sm text-muted-foreground">HydraDB returned no databases for this key.</p>
            )}
          </div>
        )}
      </div>

      {current && (
        <div className="space-y-4">
          <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Explorer views">
            {(
              [
                ['browse', Layers, 'Browse'],
                ['lab', FlaskConical, 'Query Lab'],
              ] as const
            ).map(([id, Icon, text]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm',
                  tab === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {text}
              </button>
            ))}
          </div>

          {tab === 'browse' ? (
            <Browse
              current={current}
              collection={collection}
              kind={kind}
              page={page}
              selected={selected}
              onCollection={(name) => {
                setCollection(name);
                setPage(1);
                setSelected(null);
              }}
              onKind={(value) => {
                setKind(value);
                setPage(1);
                setSelected(null);
              }}
              onPage={setPage}
              onSelect={setSelected}
            />
          ) : (
            <QueryLab database={current} />
          )}
        </div>
      )}
    </section>
  );
};

const DatabaseCard = ({ entry, selected, onSelect }: { entry: ExploreDatabase; selected: boolean; onSelect: () => void }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className={cn(
      'rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring',
      selected ? 'border-primary bg-primary/5' : 'border-border',
    )}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="truncate text-sm font-semibold">{entry.name}</span>
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          entry.ready === true ? 'bg-emerald-500' : entry.ready === false ? 'animate-pulse bg-amber-500' : 'bg-muted-foreground/40',
        )}
        aria-label={entry.ready === true ? 'ready' : entry.ready === false ? 'warming up' : 'unknown'}
      />
    </div>
    <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
      <div className="flex justify-between"><dt>knowledge</dt><dd className="font-medium text-foreground">{formatCount(entry.knowledgeRows)}</dd></div>
      <div className="flex justify-between"><dt>memories</dt><dd className="font-medium text-foreground">{formatCount(entry.memoryRows)}</dd></div>
      <div className="flex justify-between"><dt>collections</dt><dd className="font-medium text-foreground">{entry.collections.length}</dd></div>
    </dl>
    {entry.error && <p className="mt-2 text-[11px] text-destructive">{entry.error}</p>}
  </button>
);

// -----------------------------------------------------------------------------
// Browse
// -----------------------------------------------------------------------------

const Browse = ({
  current,
  collection,
  kind,
  page,
  selected,
  onCollection,
  onKind,
  onPage,
  onSelect,
}: {
  current: ExploreDatabase;
  collection: string | null;
  kind: ExploreKind;
  page: number;
  selected: ExploreItem | null;
  onCollection: (name: string | null) => void;
  onKind: (kind: ExploreKind) => void;
  onPage: (page: number) => void;
  onSelect: (item: ExploreItem | null) => void;
}) => {
  const [items, loadItems] = useFetch<ExploreListResponse>();
  const [detail, loadDetail] = useFetch<ExploreItemDetail>();

  useEffect(() => {
    const params = new URLSearchParams({ kind, page: String(page), pageSize: '25' });
    if (collection) params.set('collection', collection);
    void loadItems(`/api/explore/${encodeURIComponent(current.name)}/items?${params}`);
  }, [current.name, collection, kind, page, loadItems]);

  useEffect(() => {
    if (!selected) return;
    const params = new URLSearchParams({ kind: selected.kind });
    if (selected.collection) params.set('collection', selected.collection);
    void loadDetail(`/api/explore/${encodeURIComponent(current.name)}/items/${encodeURIComponent(selected.id)}?${params}`);
  }, [current.name, selected, loadDetail]);

  const edges = useMemo(() => {
    if (detail.status !== 'ready') return [];
    return [...detail.data.relations, ...detail.data.subgraph.relations].map((relation) => ({
      source: relation.source.name,
      relation: relation.predicate,
      target: relation.target.name,
      weight: relation.confidence,
    }));
  }, [detail]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Collections</span>
        <Chip active={collection === null} onClick={() => onCollection(null)}>default</Chip>
        {current.collections.map((name) => (
          <Chip key={name} active={collection === name} onClick={() => onCollection(name)}>{name}</Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Chip active={kind === 'knowledge'} onClick={() => onKind('knowledge')}>knowledge · {formatCount(current.knowledgeRows)}</Chip>
        <Chip active={kind === 'memory'} onClick={() => onKind('memory')}>memory · {formatCount(current.memoryRows)}</Chip>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-base font-semibold">
            {kind === 'memory' ? 'Memories' : 'Sources'}
            {items.status === 'ready' && items.data.total !== null && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">{items.data.total.toLocaleString()}</span>
            )}
          </h3>
          <p className="font-mono text-[11px] text-muted-foreground">
            POST /context/list · {current.name}{collection ? ` / ${collection}` : ''}
            {items.status === 'ready' && items.data.requestId && ` · request ${items.data.requestId}`}
          </p>
          {items.status === 'loading' && <Spinner />}
          {items.status === 'failed' && <Failure message={items.message} requestId={items.requestId} />}
          {items.status === 'ready' && (
            <>
              <ul className="mt-3 max-h-[34rem] space-y-1 overflow-y-auto pr-1">
                {items.data.items.map((item) => (
                  <li key={`${item.collection}:${item.id}`}>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      aria-pressed={selected?.id === item.id}
                      className={cn(
                        'w-full rounded-md border px-3 py-2 text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring',
                        selected?.id === item.id ? 'border-primary bg-primary/5' : 'border-border',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{item.title}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.type && <Tag tone="strong">{item.type}</Tag>}
                        {Object.entries(item.metadata).slice(0, 4).map(([key, value]) => (
                          <Tag key={key}>{key}: {String(value)}</Tag>
                        ))}
                        {item.timestamp && <span className="text-[10px] text-muted-foreground">{new Date(item.timestamp).toLocaleDateString()}</span>}
                      </div>
                    </button>
                  </li>
                ))}
                {items.data.items.length === 0 && (
                  <li className="py-6 text-center text-sm text-muted-foreground">No matching items were returned for this scope.</li>
                )}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <button type="button" disabled={page === 1} onClick={() => onPage(Math.max(1, page - 1))} className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-40">Previous</button>
                <span className="text-xs text-muted-foreground">page {page}</span>
                <button type="button" disabled={items.data.items.length < 25} onClick={() => onPage(page + 1)} className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-40">Next</button>
              </div>
            </>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="truncate text-base font-semibold">{selected ? selected.title : 'Select an item'}</h3>
          <p className="font-mono text-[11px] text-muted-foreground">
            GET /context/inspect · /context/relations · /context/subgraph
            {detail.status === 'ready' && detail.data.requestIds.length > 0 && ` · ${detail.data.requestIds.length} requests`}
          </p>
          {!selected && (
            <p className="mt-3 text-sm text-muted-foreground">
              Pick a source or memory to see its stored content, the entity relations HydraDB extracted from it, and the items it is connected to.
            </p>
          )}
          {selected && detail.status === 'loading' && <Spinner />}
          {detail.status === 'failed' && <Failure message={detail.message} requestId={detail.requestId} />}
          {selected && detail.status === 'ready' && (
            <div className="mt-3 space-y-4">
              <div className="flex flex-wrap gap-1">
                <Tag tone="strong">{selected.kind}</Tag>
                {selected.collection && <Tag>{selected.collection}</Tag>}
                {Object.entries(selected.metadata).map(([key, value]) => <Tag key={key}>{key}: {String(value)}</Tag>)}
                {Object.entries(selected.additionalMetadata).map(([key, value]) => <Tag key={key} tone="faint">{key}: {String(value)}</Tag>)}
              </div>

              {detail.data.failures.length > 0 && (
                <ul className="space-y-1">
                  {detail.data.failures.map((failure) => (
                    <li key={failure.call} className="text-xs text-destructive">{failure.call}: {failure.message}</li>
                  ))}
                </ul>
              )}

              <div>
                <h4 className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Waypoints className="h-3.5 w-3.5" aria-hidden />
                  Graph · {detail.data.relations.length} relations · {detail.data.subgraph.sources.length} connected items
                  {detail.data.relationsTruncated && ' (truncated)'}
                </h4>
                <RelationGraph edges={edges} height={320} />
              </div>

              {detail.data.subgraph.sources.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Connected items</h4>
                  <ul className="flex flex-wrap gap-1">
                    {detail.data.subgraph.sources.map((source) => (
                      <li key={source.id}><Tag>{source.title}{source.depth !== null && ` · d${source.depth}`}{source.via && ` · ${source.via}`}</Tag></li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.data.relations.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">Relation evidence</summary>
                  <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                    {detail.data.relations.slice(0, 60).map((relation, index) => (
                      <li key={index} className="rounded-md border border-border px-2 py-1 text-xs">
                        <span className="font-medium">{relation.source.name}</span>
                        <span className="mx-1 text-muted-foreground">—{relation.predicate}→</span>
                        <span className="font-medium">{relation.target.name}</span>
                        {relation.confidence !== null && <span className="ml-2 text-muted-foreground">{relation.confidence.toFixed(2)}</span>}
                        {relation.synthesized && <Tag tone="faint">synthesized</Tag>}
                        {relation.context && <p className="mt-0.5 line-clamp-2 text-muted-foreground">{relation.context}</p>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {(detail.data.content || detail.data.inferredContent) && (
                <details className="text-sm" open={selected.kind === 'memory'}>
                  <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">Stored content</summary>
                  {detail.data.inferredContent && (
                    <div className="mt-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">inferred</div>
                      <div className="whitespace-pre-wrap">{detail.data.inferredContent}</div>
                    </div>
                  )}
                  {detail.data.content && (
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{detail.data.content}</pre>
                  )}
                </details>
              )}
              {selected.description && !detail.data.content && <p className="whitespace-pre-wrap text-sm">{selected.description}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Query Lab
// -----------------------------------------------------------------------------

const DEFAULT_LAB: LabQueryInput = {
  collections: [],
  query: '',
  type: 'all',
  queryBy: 'hybrid',
  mode: 'thinking',
  maxResults: 10,
  alpha: 'auto',
  recencyBias: 0.4,
  graphContext: true,
  forcefulRelations: true,
  temporalReasoning: true,
};

const QueryLab = ({ database }: { database: ExploreDatabase }) => {
  const [form, setForm] = useState<LabQueryInput>(DEFAULT_LAB);
  const [attributesText, setAttributesText] = useState('');
  const [results, setResults] = useState<LabQueryResponse[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; requestId: string | null } | null>(null);

  useEffect(() => {
    setForm((previous) => ({ ...previous, collections: [] }));
    setResults([]);
    setFailure(null);
  }, [database.name]);

  const run = async (mode: QueryMode) => {
    let attributes: Record<string, unknown> | undefined;
    if (attributesText.trim()) {
      try {
        attributes = JSON.parse(attributesText) as Record<string, unknown>;
      } catch {
        setFailure({ message: 'attributes must be valid JSON, e.g. {"source": {"$eq": "github"}}', requestId: null });
        return;
      }
    }
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/explore/${encodeURIComponent(database.name)}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, mode, attributes }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure({ message: body?.error ?? `The server answered ${response.status}.`, requestId: body?.requestId ?? null });
        return;
      }
      setResults((previous) => [body as LabQueryResponse, ...previous].slice(0, 4));
    } catch {
      setFailure({ message: 'RRFLOW could not reach its server.', requestId: null });
    } finally {
      setBusy(false);
    }
  };

  const toggleCollection = (name: string) =>
    setForm((previous) => ({
      ...previous,
      collections: previous.collections.includes(name) ? previous.collections.filter((entry) => entry !== name) : [...previous.collections, name],
    }));

  const canRun = form.query.trim().length > 0 && !busy;
  const field = 'w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <form
        className="space-y-4 rounded-lg border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(form.mode);
        }}
      >
        <div>
          <h3 className="text-base font-semibold"><code>POST /query</code> · {database.name}</h3>
          <p className="text-sm text-muted-foreground">Every retrieval knob HydraDB exposes. Run the same question in fast and thinking mode and compare what each lane returned.</p>
        </div>

        <label className="block space-y-1 text-xs">
          <span>query</span>
          <textarea rows={3} value={form.query} onChange={(event) => setForm({ ...form, query: event.target.value })} placeholder="Which services depend on this host, and what changed last week?" className={field} />
        </label>

        <div className="space-y-1 text-xs">
          <span>collections (none = default)</span>
          <div className="flex flex-wrap gap-1">
            {database.collections.map((name) => (
              <Chip key={name} active={form.collections.includes(name)} onClick={() => toggleCollection(name)}>{name}</Chip>
            ))}
            {database.collections.length === 0 && <span className="text-muted-foreground">no named collections</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Segmented label="type" value={form.type} options={['knowledge', 'memory', 'all']} onChange={(value) => setForm({ ...form, type: value })} />
          <Segmented label="query_by" value={form.queryBy} options={['hybrid', 'text']} onChange={(value) => setForm({ ...form, queryBy: value })} />
          <Segmented label="mode" value={form.mode} options={['fast', 'thinking', 'auto']} onChange={(value) => setForm({ ...form, mode: value })} />
          <label className="block space-y-1 text-xs">
            <span>max_results</span>
            <input type="number" min={1} max={50} value={form.maxResults} onChange={(event) => setForm({ ...form, maxResults: Number(event.target.value) || 10 })} className={field} />
          </label>
          <label className="block space-y-1 text-xs">
            <span>alpha (auto, 0 = BM25 … 1 = dense)</span>
            <input
              value={form.alpha === undefined ? '' : String(form.alpha)}
              onChange={(event) => {
                const raw = event.target.value.trim();
                setForm({ ...form, alpha: raw === '' ? undefined : raw === 'auto' ? 'auto' : Number(raw) });
              }}
              className={field}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span>recency_bias (0–1)</span>
            <input type="number" min={0} max={1} step={0.1} value={form.recencyBias ?? ''} onChange={(event) => setForm({ ...form, recencyBias: event.target.value === '' ? undefined : Number(event.target.value) })} className={field} />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Toggle label="graph_context" checked={form.graphContext} onChange={(value) => setForm({ ...form, graphContext: value })} />
          <Toggle label="forceful" checked={form.forcefulRelations} onChange={(value) => setForm({ ...form, forcefulRelations: value })} />
          <Toggle label="temporal" checked={form.temporalReasoning} onChange={(value) => setForm({ ...form, temporalReasoning: value })} />
        </div>

        <label className="block space-y-1 text-xs">
          <span>attributes (JSON filter over the metadata schema)</span>
          <textarea rows={2} value={attributesText} onChange={(event) => setAttributesText(event.target.value)} placeholder='{"source": {"$in": ["github", "hackernews"]}}' className={cn(field, 'font-mono')} />
        </label>

        {failure && <Failure message={failure.message} requestId={failure.requestId} />}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!canRun} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            Run ({form.mode})
          </button>
          <button
            type="button"
            disabled={!canRun}
            onClick={async () => {
              await run('fast');
              await run('thinking');
            }}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary disabled:opacity-50"
          >
            Compare fast vs thinking
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {results.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Results land here, newest first. Each card is one HydraDB response: chunks in server order, graph paths, temporal facts, forceful relations, and the <code>llm_prompt</code> it rendered.
          </div>
        )}
        {results.map((result, index) => <LabResult key={`${result.requestId ?? index}-${result.request.mode}`} result={result} />)}
      </div>
    </div>
  );
};

const Segmented = <T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) => (
  <div className="space-y-1 text-xs">
    <span>{label}</span>
    <div className="flex rounded-md border border-border p-0.5" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange(option)}
          className={cn('flex-1 rounded px-2 py-1 transition-colors', option === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
        >
          {option}
        </button>
      ))}
    </div>
  </div>
);

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) => (
  <label className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[rgb(var(--primary-rgb))]" />
  </label>
);

const LabResult = ({ result }: { result: LabQueryResponse }) => {
  const [open, setOpen] = useState(false);
  const edges = useMemo(() => result.graph.map((edge) => ({ source: edge.source, relation: edge.relation, target: edge.target, weight: edge.score })), [result.graph]);
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">
          <Tag tone={result.request.mode === 'thinking' ? 'strong' : 'default'}>{result.request.mode}</Tag>
          <span className="ml-2 text-sm font-normal text-muted-foreground">{result.request.type} · {result.request.queryBy} · {result.request.collections.join(', ') || 'default'}</span>
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {result.latencyMs !== null && <span>{Math.round(result.latencyMs)} ms</span>}
          <span>{result.chunks.length} chunks</span>
          <span>{result.graph.length} edges</span>
          <span>{result.temporalFacts.length} temporal</span>
          <span>{result.forceful.length} forceful</span>
        </div>
      </header>
      <p className="font-mono text-[11px] text-muted-foreground">request_id {result.requestId ?? 'unknown'}{result.apiVersion && ` · API-Version ${result.apiVersion}`}</p>

      <ol className="mt-3 space-y-1.5">
        {result.chunks.map((chunk, index) => (
          <li key={`${chunk.id}-${chunk.chunkId ?? index}`} className="flex items-start gap-2 text-sm">
            <span className="w-6 shrink-0 text-muted-foreground">[{index + 1}]</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {chunk.url ? (
                  <a href={chunk.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">{chunk.title}<ExternalLink className="h-3 w-3" aria-hidden /></a>
                ) : (
                  <span className="font-medium">{chunk.title}</span>
                )}
                {chunk.type && <Tag>{chunk.type}</Tag>}
                {chunk.collection && <Tag tone="strong">{chunk.collection}</Tag>}
                {chunk.score !== null && <span className="text-xs text-muted-foreground">{chunk.score.toFixed(3)}</span>}
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{chunk.content}</p>
            </div>
          </li>
        ))}
        {result.chunks.length === 0 && <li className="text-sm text-muted-foreground">No matching evidence was returned; try another question or scope.</li>}
      </ol>

      {result.graph.length > 0 && <div className="mt-3"><RelationGraph edges={edges} height={300} /></div>}

      {result.forceful.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Forceful relations</h4>
          <ul className="flex flex-wrap gap-1">
            {result.forceful.map((entry, index) => <li key={`${entry.id}-${index}`}><Tag tone={entry.declared ? 'strong' : 'default'}>{entry.declared ? 'declared' : 'inferred'} · {entry.title || entry.id}</Tag></li>)}
          </ul>
        </div>
      )}

      {result.temporalFacts.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Temporal facts</h4>
          <ul className="space-y-1 text-xs">
            {result.temporalFacts.slice(0, 12).map((fact, index) => (
              <li key={index} className="rounded-md border border-border px-2 py-1">
                <span className="font-medium">{fact.subject}</span>
                <span className="mx-1 text-muted-foreground">—{fact.relation}→</span>
                <span className="font-medium">{fact.object}</span>
                {fact.status && <Tag tone="faint">{fact.status}</Tag>}
                {fact.evidence && <p className="line-clamp-1 text-muted-foreground">{fact.evidence}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.aliasExpansions.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">aliases: {result.aliasExpansions.map((note) => `${note.alias} → ${note.canonical}`).join(', ')}</p>
      )}

      {result.llmPrompt && (
        <div className="mt-3">
          <button type="button" onClick={() => setOpen((value) => !value)} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
            {open ? 'Hide' : 'Show'} llm_prompt ({result.llmPrompt.length.toLocaleString()} chars)
          </button>
          {open && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{result.llmPrompt}</pre>}
        </div>
      )}
    </article>
  );
};
