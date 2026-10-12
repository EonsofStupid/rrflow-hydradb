'use client';

import { useCallback, useEffect, useState } from 'react';
import { Database, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActivity } from '@/components/transparency/activity-provider';
import { databaseWorkspaceNames, type CreateDatabaseResult, type DatabasesSnapshot } from '@/lib/databases-contracts';

const inputClass = 'mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
const stateLabel = (value: boolean | null | undefined) => value === true ? 'Ready' : value === false ? 'Preparing' : 'Not reported';

export const DatabaseManager = () => {
  const { record, recordBackground } = useActivity();
  const [snapshot, setSnapshot] = useState<DatabasesSnapshot | null>(null);
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState<'personal' | 'shippin'>('personal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('Reading your databases from HydraDB…');
  const [created, setCreated] = useState<CreateDatabaseResult | null>(null);

  const refresh = useCallback(async (background = false) => {
    const response = await fetch('/api/databases', { cache: 'no-store' });
    const result = await response.json() as DatabasesSnapshot;
    if (background) recordBackground(result.receipts ?? []);
    else record('Read databases and workspace assignments', result.receipts ?? [], { notify: result.error ? 'error' : false, summary: result.error });
    if (!response.ok || result.error) throw new Error(result.error ?? 'Databases could not load. Try again.');
    setSnapshot(result);
    setCreated(current => {
      if (!current) return current;
      const database = result.databases.find(item => item.name === current.database.name);
      return database ? { ...current, database } : current;
    });
    return result;
  }, [record, recordBackground]);

  useEffect(() => {
    let active = true;
    refresh(true).then(() => { if (active) setNotice('Database names, readiness and workspace assignments loaded.'); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Databases could not load.'); });
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(true).catch(() => { if (active) setError('Automatic refresh failed. The last successful results remain visible.'); }); }, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [refresh]);

  const handleCreate = async () => {
    setBusy(true); setError(null); setCreated(null);
    try {
      const response = await fetch('/api/databases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, workspace }) });
      const result = await response.json() as CreateDatabaseResult & { error?: string };
      record('Create a HydraDB database', result.receipts ?? [], { notify: response.ok ? 'success' : 'error', summary: result.error ?? result.message });
      if (!response.ok || result.error) throw new Error(result.error ?? 'Database creation could not complete. Refresh before retrying.');
      setCreated(result); setNotice(result.message); setName('');
      window.dispatchEvent(new Event('rrflow:databases-changed'));
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Database creation could not complete. Refresh before retrying.'); }
    finally { setBusy(false); }
  };

  return <section aria-label="Manage brain databases" className="space-y-4 rounded-2xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><Database className="size-5" aria-hidden />A place for each part of your life</h2><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Create a separate HydraDB database for a project or area of life, then choose where it belongs. Personal and Shippin knowledge keep their own boundaries.</p></div><Button variant="outline" disabled={busy} onClick={() => { setError(null); setBusy(true); void refresh().then(() => setNotice('Database readiness refreshed.')).catch(cause => setError(cause instanceof Error ? cause.message : 'Refresh failed.')).finally(() => setBusy(false)); }}><RefreshCw aria-hidden />Refresh databases</Button></header>
    <div role="status" aria-live="polite" className="rounded-xl bg-muted/50 p-3 text-sm">{busy ? 'Working with HydraDB…' : notice}<span className="mt-1 block text-xs text-muted-foreground">Last successful read: {snapshot ? new Date(snapshot.checkedAt).toLocaleString() : 'Waiting for HydraDB'} · refreshes every 30 seconds while visible</span></div>
    {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">{error}</p>}
    {snapshot?.warnings?.map(warning => <p key={warning} role="alert" className="text-sm">{warning}</p>)}
    <form className="space-y-3 rounded-xl border border-border p-4" onSubmit={event => { event.preventDefault(); void handleCreate(); }}>
      <h3 className="font-semibold">Create a new brain database</h3>
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">New database name<input required pattern="[a-z][a-z0-9_-]{2,62}" minLength={3} maxLength={63} autoComplete="off" className={inputClass} placeholder="Choose a new name" value={name} onChange={event => setName(event.target.value)} /><span className="mt-1 block text-xs font-normal text-muted-foreground">3–63 characters. Start with a lowercase letter; use letters, numbers, underscores or hyphens.</span></label><label className="block text-sm font-medium">Where does this belong?<select value={workspace} onChange={event => setWorkspace(event.target.value as 'personal' | 'shippin')} className={inputClass}><option value="personal">Personal life</option><option value="shippin">Shippin work</option></select></label></div>
      <p className="text-xs text-muted-foreground">This creates a real database in your connected HydraDB account with standard managed settings. Existing databases cannot be replaced by this form.</p>
      <Button type="submit" disabled={busy || !name || snapshot?.databases.some(item => item.name === name)}><Plus aria-hidden />Create database</Button>
      {snapshot?.databases.some(item => item.name === name) && <p className="text-sm">That database already exists. Choose a new name.</p>}
    </form>
    {created && <p className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm"><strong>{created.database.name}</strong> belongs to {databaseWorkspaceNames[created.database.workspace ?? workspace]}. {created.database.ready ? 'It is ready for new knowledge.' : 'HydraDB is preparing it; use Refresh databases to check progress.'}</p>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{snapshot?.databases.map(item => <article key={item.name} className="min-w-0 rounded-xl border border-border bg-background/50 p-4"><p className="text-xs font-medium text-primary">{item.workspace ? databaseWorkspaceNames[item.workspace] : 'Workspace not assigned'}</p><h3 className="mt-1 break-all font-semibold">{item.name === 'default-tenant' ? 'Personal brain' : item.name}</h3>{item.name === 'default-tenant' && <p className="mt-1 text-xs text-muted-foreground">HydraDB database: default-tenant</p>}<p className="mt-3 text-sm">{item.status ?? 'Status not reported'}</p><details className="mt-3 text-xs"><summary className="cursor-pointer">What is ready inside this brain?</summary><dl className="mt-2 space-y-1"><div className="flex justify-between gap-2"><dt>Connections between knowledge</dt><dd>{stateLabel(item.graph)}</dd></div><div className="flex justify-between gap-2"><dt>Searchable knowledge</dt><dd>{stateLabel(item.knowledge)}</dd></div><div className="flex justify-between gap-2"><dt>Memories</dt><dd>{stateLabel(item.memories)}</dd></div></dl></details></article>)}</div>
  </section>;
};
