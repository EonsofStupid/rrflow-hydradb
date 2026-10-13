'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActivity } from '@/components/transparency/activity-provider';
import type { QdrantImportResult, QdrantScope, QdrantSnapshot, QdrantSource, QdrantSourcePoint } from '@/lib/qdrant-contracts';

const when = (value: string | null) => value ? new Date(value).toLocaleString() : 'Not yet imported';
const importStatus = (point: QdrantSourcePoint) => {
  if (point.importedVersion && point.importedVersion !== point.version) return 'Source changed · review before updating';
  if (point.indexingStatus === 'completed') return point.importedVersion === point.version ? 'Indexed in HydraDB' : 'HydraDB source indexed · current version unconfirmed';
  if (point.indexingStatus) return `HydraDB: ${point.indexingStatus.replaceAll('_', ' ')}`;
  return point.importedAt ? 'Import accepted · indexing not yet confirmed' : 'Available to import';
};

export const QdrantSources = () => {
  const { record, recordBackground } = useActivity();
  const [snapshot, setSnapshot] = useState<QdrantSnapshot | null>(null);
  const [busy, setBusy] = useState<QdrantScope | 'refresh' | null>(null);
  const [selection, setSelection] = useState<Record<QdrantScope, string[]>>({ personal: [], work: [] });
  const [notice, setNotice] = useState('Reading the two local Qdrant sources…');
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async (background = false, progressive = false) => {
    if (progressive) {
      const localResponse = await fetch('/api/qdrant?evidence=0', { cache: 'no-store' });
      const local = await localResponse.json() as QdrantSnapshot;
      if (localResponse.ok && !local.error) {
        setSnapshot(local);
        setNotice('Qdrant sources loaded. Checking their import history and indexing status in HydraDB…');
      }
    }
    const response = await fetch('/api/qdrant', { cache: 'no-store' });
    const result = await response.json() as QdrantSnapshot;
    if (!response.ok || result.error) throw new Error(result.error ?? 'Sources could not load. Try refreshing.');
    setSnapshot(result);
    if (background) recordBackground(result.receipts);
    else record('Refresh Personal and Work Qdrant sources', result.receipts, { notify: false });
    return result;
  }, [record, recordBackground]);
  useEffect(() => {
    let active = true;
    refresh(true, true).then(() => { if (active) setNotice('Qdrant source records loaded. Review and select what HydraDB should learn.'); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Sources could not load.'); });
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(true).catch(() => { if (active) setError('Automatic source refresh failed. The last successful view remains visible.'); }); }, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [refresh]);
  const handleImport = async (source: QdrantSource) => {
    setBusy(source.scope); setError(null);
    try {
      const points = source.points.filter(point => selection[source.scope].includes(String(point.id))).map(point => ({ id: point.id, version: point.version }));
      const response = await fetch('/api/qdrant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: source.scope, points }) });
      const result = await response.json() as QdrantImportResult;
      record(`Import ${source.scope === 'personal' ? 'Personal' : 'Work'} Qdrant sources`, result.receipts ?? [], { notify: result.error ? 'error' : 'success', summary: result.error ?? result.message });
      if (!response.ok || result.error) throw new Error(result.error ?? 'HydraDB could not accept these source records.');
      setNotice(result.message); setSelection(current => ({ ...current, [source.scope]: [] }));
      await refresh();
      window.dispatchEvent(new Event('rrflow:knowledge-changed'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The source import could not complete.'); }
    finally { setBusy(null); }
  };
  return <section aria-label="Qdrant source libraries" className="space-y-4 rounded-2xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><Database className="size-5" aria-hidden />Two source libraries. Clear boundaries.</h2><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Personal and Work run in separate local Qdrant services. You choose which source records enter HydraDB, where RRFLOW keeps its knowledge and decisions.</p></div><Button variant="outline" disabled={busy !== null} onClick={() => { setBusy('refresh'); setError(null); void refresh().then(() => setNotice('Source records and HydraDB indexing status refreshed.')).catch(cause => setError(cause instanceof Error ? cause.message : 'Refresh failed.')).finally(() => setBusy(null)); }}><RefreshCw aria-hidden />Refresh source libraries</Button></header>
    <p role="status" aria-live="polite" className="rounded-xl bg-muted/50 p-3 text-sm">{busy ? 'Reading sources and updating HydraDB…' : notice}<span className="mt-1 block text-xs text-muted-foreground">Last successful read: {snapshot ? when(snapshot.checkedAt) : 'Waiting'} · refreshes every 30 seconds while visible</span></p>
    {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">{error}</p>}
    <div className="grid items-start gap-4 lg:grid-cols-2">{snapshot?.sources.map(source => <article key={source.scope} aria-label={`${source.scope === 'personal' ? 'Personal' : 'Work'} Qdrant source`} className="min-w-0 space-y-3 rounded-xl border border-border bg-background/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">{source.scope === 'personal' ? 'Personal life' : 'Work · Shippin'}</h3><span className="text-xs">{source.connected ? 'Qdrant connected' : 'Source unavailable'}</span></div>
      <p className="text-sm text-muted-foreground">{source.scope === 'personal' ? 'Seeded from your stated goals and preferences in this conversation.' : 'Seeded from documents already published in your public RRFLOW repository.'}</p>
      <p className="flex flex-wrap items-center gap-2 text-sm"><span>{source.total ?? 'Unknown'} source records</span><ArrowRight className="size-4" aria-hidden /><strong>{source.database}</strong></p>
      <p className="text-xs text-muted-foreground">{source.endpoint} · {source.collection}</p>
      {source.error && <p role="alert" className="text-sm">{source.error}</p>}
      {source.warnings.map(warning => <p key={warning} className="text-sm">{warning}</p>)}
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Review sources before importing</legend>{source.points.map(point => <div key={point.id} className="rounded-lg border border-border p-3">
        <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" className="mt-1" checked={selection[source.scope].includes(String(point.id))} onChange={event => setSelection(current => ({ ...current, [source.scope]: event.target.checked ? [...current[source.scope], String(point.id)] : current[source.scope].filter(id => id !== String(point.id)) }))} /><span className="min-w-0 break-words">{point.title}</span></label>
        <p className="mt-2 text-xs">{source.evidencePending ? 'Checking HydraDB import status…' : importStatus(point)}</p><p className="mt-1 text-xs text-muted-foreground">Last import: {source.evidencePending ? 'Checking…' : when(point.importedAt)}</p>
        <details className="mt-2 text-xs"><summary className="cursor-pointer">Read source and provenance</summary><p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-2">{point.text}</p><p className="mt-2 break-words">{point.provenance}</p><p className="mt-1">Source kind: {point.sourceKind}</p><p className="mt-1">Source updated: {point.updatedAt ? when(point.updatedAt) : 'Not reported'}</p>{point.sourceUrl && <a className="mt-2 inline-block underline" href={point.sourceUrl} target="_blank" rel="noreferrer">Open original public document</a>}<p className="mt-2 break-all text-muted-foreground">Qdrant point: {point.id} · HydraDB source: {point.hydraId}</p></details>
      </div>)}</fieldset>
      <Button disabled={busy !== null || !selection[source.scope].length || selection[source.scope].length > 20} onClick={() => void handleImport(source)}>Import {selection[source.scope].length} {source.scope === 'personal' ? 'Personal' : 'Work'} sources</Button>
      <p className="text-xs text-muted-foreground">Imports go only to {source.database}/{source.collection === 'rrflow_sources' ? 'qdrant_sources' : source.collection}. Reimport updates the same source IDs. Original Qdrant records stay intact.</p>
    </article>)}</div>
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">What this connection does</summary><p className="mt-2">This is a direct Qdrant source adapter using collection listing and point scrolling. These seed records contain text payloads and provenance; embeddings and Qdrant vector search have not been created. HydraDB performs its own processing after import. A source being accepted is different from it finishing indexing.</p><ul className="mt-2 space-y-1">{snapshot?.qdrantReceipts.map((receipt, index) => <li key={`${receipt.scope}-${index}`}>{receipt.scope} · {receipt.method} {receipt.endpoint} · {receipt.httpStatus === null ? 'No response' : `HTTP ${receipt.httpStatus}`} · {receipt.latencyMs} ms</li>)}</ul></details>
  </section>;
};
