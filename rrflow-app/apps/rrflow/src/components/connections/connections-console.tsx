'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Cable, Copy, RefreshCw, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActivity } from '@/components/transparency/activity-provider';
import type { ConnectionsAction, ConnectionsOverview, ConnectionsResponse, ConnectorDetail, ConnectorItem, ProviderDetail, ResourceItem } from '@/lib/connections-contracts';
import { connectionsActionSchema } from '@/lib/connections-contracts';

const fieldClass = 'mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const panelClass = 'rounded-2xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur';
const time = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : 'Not yet reported';
const stateName = (value: string) => ({ pending_setup: 'Choose sources', ingesting: 'Learning from sources', syncing: 'Checking for changes', active: 'Connected', paused: 'Paused', reconnect: 'Account needs attention', unknown: 'Not reported' }[value] ?? value.replaceAll('_', ' '));

export const ConnectionsConsole = () => {
  const { record, recordBackground } = useActivity();
  const [overview, setOverview] = useState<ConnectionsOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('Loading connections from HydraDB…');
  const [error, setError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState('github');
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [name, setName] = useState('RRFLOW GitHub');
  const [database, setDatabase] = useState('rrflow_specialist');
  const [account, setAccount] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [credentialJson, setCredentialJson] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selected, setSelected] = useState<ConnectorItem | null>(null);
  const [detail, setDetail] = useState<ConnectorDetail | null>(null);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [generateSecret, setGenerateSecret] = useState(true);
  const [acknowledge, setAcknowledge] = useState(false);
  const [signingSecret, setSigningSecret] = useState<string | null>(null);
  const destinations = overview?.destinations ?? [];
  const selectedDatabase = destinations.some(item => item.name === database) ? database : '';
  const destinationLabel = (name: string) => destinations.find(item => item.name === name)?.label ?? name;

  const request = useCallback(async (query: string, action?: ConnectionsAction, background = false): Promise<ConnectionsResponse> => {
    const response = await fetch(`/api/connections${query}`, action ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action), cache: 'no-store',
    } : { cache: 'no-store' });
    const payload = await response.json() as ConnectionsResponse;
    if (background) recordBackground(payload.receipts ?? []);
    else record(action ? 'Update knowledge connections' : 'Read knowledge connections', payload.receipts ?? [], { notify: payload.error ? 'error' : false, summary: payload.error });
    if (!response.ok || payload.error) throw new Error(payload.error ?? 'The connection request failed. Try again.');
    return payload;
  }, [record, recordBackground]);

  const refresh = useCallback(async (background = false) => {
    const data = await request('', undefined, background);
    if (data.overview) setOverview(data.overview);
  }, [request]);

  useEffect(() => {
    let active = true;
    request('', undefined, true).then(data => {
      if (!active || !data.overview) return;
      setOverview(data.overview); setWebhookUrl(data.overview.webhook?.url ?? '');
      setGenerateSecret(!data.overview.webhook?.signing); setNotice('Connections loaded from HydraDB.');
    }).catch(() => { if (active) setError('Connections could not load. Use Refresh connections to retry.'); });
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true).catch(() => { if (active) setError('Automatic refresh failed. The last successful results remain visible.'); });
    }, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [refresh, request]);

  useEffect(() => {
    let active = true;
    request(`?view=provider&provider=${encodeURIComponent(providerId)}`).then(data => { if (active) setProvider(data.provider ?? null); })
      .catch(() => { if (active) setError('Provider requirements could not load. Choose the provider again or refresh.'); });
    return () => { active = false; };
  }, [providerId, request]);

  const perform = async (work: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'This action could not finish. Try again.'); }
    finally { setBusy(false); }
  };
  const readDetail = async (connector: ConnectorItem) => {
    const result = await request(`?view=connector&connectorId=${encodeURIComponent(connector.id)}`);
    setDetail(result.detail ?? null);
  };
  const discover = async (connector: ConnectorItem, cursor?: string) => {
    const result = await request(`?view=discover&connectorId=${encodeURIComponent(connector.id)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    setResources(current => cursor ? [...new Map([...current, ...(result.discovery?.resources ?? [])].map(item => [item.id, item])).values()] : result.discovery?.resources ?? []);
    setNextCursor(result.discovery?.nextCursor ?? null); setDiscovered(true);
  };
  const createConnector = async () => {
    let values: Record<string, unknown> = {};
    if (provider?.complexCredentials) {
      try { values = JSON.parse(credentialJson); } catch { throw new Error('Enter valid JSON for this provider’s credentials.'); }
    } else for (const field of provider?.fields ?? []) {
      const value = credentials[field.name];
      if (value) values[field.name] = field.type === 'boolean' ? value === 'true' : field.type === 'number' || field.type === 'integer' ? Number(value) : value;
    }
    try {
      if (!selectedDatabase) throw new Error('Refresh and choose a verified workspace destination first.');
      const input = connectionsActionSchema.safeParse({ action: 'create', provider: providerId, name, database: selectedDatabase, account, credentials: values, instructions });
      if (!input.success) throw new Error('Check the connection name, brain and credential fields before connecting.');
      const result = await request('', input.data);
      setNotice(result.message ?? 'Account connected.');
      if (result.connector) {
        setSelected(result.connector); setDetail(null); setResources([]); setChecked([]); setDiscovered(false);
        await refresh(); await discover(result.connector);
      }
    } finally { setCredentials({}); setCredentialJson(''); }
  };

  return <section aria-label="Knowledge connections" className="space-y-6 pb-12">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-medium text-primary">Keep your brains up to date</p><h2 className="mt-1 text-2xl font-semibold">Connect your knowledge</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Choose a source and its Personal or Work destination. HydraDB keeps the selected sources current; you can inspect each sync and its last successful update.</p></div>
      <Button variant="outline" disabled={busy} onClick={() => void perform(async () => { await refresh(); setNotice('Connections refreshed.'); })}><RefreshCw aria-hidden />Refresh connections</Button>
    </header>
    <div role="status" aria-live="polite" className="rounded-xl border border-border bg-muted/40 p-3 text-sm">{busy ? 'Working with HydraDB…' : notice}<span className="mt-1 block text-xs text-muted-foreground">Last check: {time(overview?.checkedAt)} · refreshes every 30 seconds while visible</span></div>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}
    {overview?.warnings.map(warning => <p key={warning} role="alert" className="text-sm">{warning}</p>)}
    <ol className="grid gap-3 text-sm sm:grid-cols-3" aria-label="How a connection works">
      {['1. Connect an account', '2. Choose what it can learn', '3. Watch real sync progress'].map(label => <li key={label} className="flex items-center gap-2 rounded-xl border border-border bg-card p-3"><ArrowRight className="size-4 text-primary" aria-hidden />{label}</li>)}
    </ol>
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <form className={`${panelClass} space-y-4`} onSubmit={event => { event.preventDefault(); void perform(createConnector); }}>
        <h3 className="flex items-center gap-2 text-lg font-semibold"><Cable aria-hidden className="size-5" />Connect a source</h3>
        <label className="block text-sm font-medium">Source app<select className={fieldClass} value={providerId} disabled={busy} onChange={event => { setProvider(null); setProviderId(event.target.value); setCredentials({}); setCredentialJson(''); }}>
          {!overview?.providers.length && <option value="github">GitHub</option>}
          {overview?.providers.map(item => <option key={item.id} value={item.id}>{item.id}{item.beta ? ' (preview)' : ''}</option>)}
        </select></label>
        {provider && <div className="rounded-xl bg-muted/60 p-3 text-sm"><strong>What this connection learns</strong><p className="mt-1">{provider.objectTypes.length ? provider.objectTypes.join(', ').replaceAll('_', ' ') : 'The provider’s supported source content.'}</p>{providerId === 'github' && <p className="mt-2">This native connector indexes GitHub issues and their comments. Repository file updates use the separate GitHub source sync.</p>}</div>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">Connection name<input required maxLength={200} value={name} onChange={event => setName(event.target.value)} className={fieldClass} /></label>
          <label className="block text-sm font-medium">Which brain should learn?<select value={selectedDatabase} disabled={busy || !destinations.length} onChange={event => setDatabase(event.target.value)} className={fieldClass}>{!selectedDatabase && <option value="">{destinations.length ? 'Choose a verified destination' : 'No verified destinations available'}</option>}{destinations.map(item => <option key={item.name} value={item.name}>{item.label}</option>)}</select></label></div>
        <label className="block text-sm font-medium">Account or organization<input value={account} maxLength={200} placeholder={providerId === 'github' ? 'eonsofstupid, rrflow, or shippinAI' : 'Provider account identifier'} onChange={event => setAccount(event.target.value)} className={fieldClass} /><span className="mt-1 block text-xs font-normal text-muted-foreground">For GitHub, use the owner name. For Gmail, leave this empty.</span></label>
        {provider?.complexCredentials ? <label className="block text-sm font-medium">Provider credentials (JSON)<textarea value={credentialJson} onChange={event => setCredentialJson(event.target.value)} className={fieldClass} autoComplete="off" spellCheck={false} rows={4} required /></label> : provider?.fields.map(field => <label key={field.name} className="block text-sm font-medium">{field.name.replaceAll('_', ' ')}{field.required ? ' *' : ''}<input type="password" required={field.required} autoComplete="new-password" maxLength={12000} className={fieldClass} value={credentials[field.name] ?? ''} onChange={event => setCredentials(current => ({ ...current, [field.name]: event.target.value }))} /><span className="mt-1 block text-xs font-normal text-muted-foreground">{field.description}</span></label>)}
        {!!provider?.scopes.length && <details className="text-sm"><summary className="cursor-pointer">Required account permissions</summary><ul className="mt-2 space-y-2 text-xs text-muted-foreground">{provider.scopes.map(scope => <li key={scope}>{scope}</li>)}</ul></details>}
        {provider?.setup && <details className="text-sm"><summary className="cursor-pointer">Provider setup guide</summary><p className="mt-2 whitespace-pre-wrap text-xs">{provider.setup}</p></details>}
        <label className="block text-sm font-medium">What should this brain pay attention to? <span className="font-normal">(optional)</span><textarea maxLength={4000} value={instructions} onChange={event => setInstructions(event.target.value)} className={fieldClass} rows={2} placeholder="Keep launch decisions, engineering lessons and their source links." /></label>
        <p className="text-xs text-muted-foreground">Credentials go through the RRFLOW server to HydraDB. RRFLOW does not save them or put them in activity receipts. Choose resources before the first sync starts.</p>
        <Button type="submit" disabled={busy || !provider || !selectedDatabase}>Connect account</Button>
      </form>
      <div className="space-y-5">
        <section className={panelClass} aria-label="Connected sources"><h3 className="text-lg font-semibold">Your connected sources</h3>
          {!overview ? <p className="mt-3 text-sm text-muted-foreground">Waiting for the connection inventory.</p> : !overview.connectorListAvailable ? <p className="mt-3 text-sm text-muted-foreground">Connection inventory is unavailable. Refresh to verify what is connected.</p> : !overview.connectors.length ? <p className="mt-3 text-sm text-muted-foreground">No connections with verified workspace assignments were returned.</p> : <ul className="mt-3 space-y-3">{overview.connectors.map(item => <li key={item.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{item.name}</strong><span className="text-xs">{stateName(item.lifecycle)}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.provider} → {destinationLabel(item.database)}</p><p className="mt-2 text-xs">Last completed sync: {time(item.lastSuccess)}</p><p className="mt-1 text-xs text-muted-foreground">{item.dispatched ?? 'Unknown'} objects sent to indexing · {item.resources ?? 'Unknown'} selected sources</p>{item.needsAttention && <p className="mt-2 text-sm">This account or sync needs attention. Open its status.</p>}<Button variant="outline" size="sm" className="mt-3" disabled={busy} onClick={() => void perform(async () => { setSelected(item); setResources([]); setChecked([]); setDiscovered(false); setDetail(null); await readDetail(item); })}>Manage {item.name}</Button></li>)}</ul>}
        </section>
        {!!overview?.unassigned?.length && <section className={panelClass} aria-label="Connections awaiting assignment"><h3 className="text-lg font-semibold">Connections needing a destination review</h3><p className="mt-2 text-sm text-muted-foreground">These connections exist in HydraDB. Their destinations need verification before this dashboard can change them.</p><ul className="mt-3 space-y-3">{overview.unassigned.map((item, index) => <li key={`${item.id}-${index}`} className="rounded-xl border border-border p-3 text-sm"><p>{item.provider} → {item.database}</p><p className="mt-1 text-xs text-muted-foreground">{item.reason}</p></li>)}</ul></section>}
        {selected && destinations.some(item => item.name === selected.database) && <section className={`${panelClass} space-y-3`} aria-label="Selected connection"><h3 className="text-lg font-semibold">{selected.name}</h3><p className="text-sm">Learning destination: {destinationLabel(selected.database)}</p>
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => void perform(() => discover(selected))}>Choose sources</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => void perform(() => readDetail(selected))}>Check sync status</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => void perform(async () => { const result = await request('', { action: 'sync', connectorId: selected.id }); setNotice(result.message!); await readDetail(selected); await refresh(); })}>Sync now</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => void perform(async () => { const result = await request('', { action: selected.lifecycle === 'paused' ? 'resume' : 'pause', connectorId: selected.id }); setNotice(result.message!); await refresh(); const data = await request(`?view=connector&connectorId=${encodeURIComponent(selected.id)}`); setDetail(data.detail ?? null); if (data.detail) setSelected(data.detail.connector); })}>{selected.lifecycle === 'paused' ? 'Resume syncs' : 'Pause syncs'}</Button></div>
          {detail && <div className="rounded-lg bg-muted/40 p-3 text-sm"><p>Health: {stateName(detail.health)} · {stateName(detail.connector.lifecycle)}</p><p className="mt-1 text-xs">Last attempt: {time(detail.connector.lastAttempt)}</p><p className="mt-1 text-xs">Next scheduled sync: {time(detail.connector.nextSync)}</p><ul className="mt-2 space-y-1">{detail.resources.map(item => <li key={item.id} className="text-xs">{item.name}: {stateName(item.status)} · {item.rows ?? 'Unknown'} rows in last sync</li>)}</ul></div>}
          {discovered && <fieldset className="space-y-3"><legend className="text-sm font-medium">Select sources this brain may read</legend>{!resources.length && <p className="text-sm">No resources were returned. Check this account’s permissions.</p>}<div className="max-h-64 space-y-2 overflow-auto">{resources.map(resource => <label key={resource.id} className="flex items-start gap-2 rounded-lg border border-border p-2 text-sm"><input type="checkbox" className="mt-1" checked={checked.includes(resource.id)} onChange={event => setChecked(current => event.target.checked ? [...current, resource.id] : current.filter(id => id !== resource.id))} /><span className="min-w-0 break-words">{resource.name}<span className="block text-xs text-muted-foreground">{resource.type}</span></span></label>)}</div>{nextCursor && <Button variant="outline" size="sm" disabled={busy} onClick={() => void perform(() => discover(selected, nextCursor))}>Load more sources</Button>}<p className="text-xs text-muted-foreground">Fetch the last 30 days, then keep up with changes. Previously configured sources remain active.</p><Button disabled={busy || !checked.length || checked.length > 100} onClick={() => void perform(async () => { const result = await request('', { action: 'configure', connectorId: selected.id, lookbackDays: 30, resources: resources.filter(item => checked.includes(item.id)) }); setNotice(result.message!); await refresh(); await readDetail(selected); })}>Start learning from {checked.length} sources</Button></fieldset>}
        </section>}
      </div>
    </div>
    <section className={`${panelClass} space-y-4`} aria-label="Indexing notifications">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Webhook className="size-5" aria-hidden />Know when knowledge is ready</h3>
      <p className="max-w-3xl text-sm text-muted-foreground">HydraDB can notify a public HTTPS endpoint when indexing changes. This is an outgoing notification from HydraDB, shared across the API key’s organization. It does not ingest GitHub pushes or sort personal mail.</p>
      <div className="rounded-xl bg-muted/50 p-3 text-sm"><p>{overview?.webhook === null || !overview ? 'Webhook configuration unavailable' : overview.webhook.registered ? 'An organization webhook is registered' : 'No indexing webhook registered'}</p>{overview?.webhook?.url && <p className="mt-1 break-all text-xs">Current receiver: {overview.webhook.url}</p>}<p className="mt-1 text-xs">Signature verification: {overview?.webhook?.signing ? 'Enabled' : 'Not configured'}</p></div>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void perform(async () => { const result = await request('', { action: 'register-webhook', url: webhookUrl, generateSecret, acknowledgeOrganization: true }); setSigningSecret(result.signingSecret ?? null); setNotice(result.message!); setAcknowledge(false); await refresh(); }); }}>
        <label className="block max-w-3xl text-sm font-medium">Public receiver URL<input required type="url" value={webhookUrl} onChange={event => setWebhookUrl(event.target.value)} placeholder="https://your-receiver.example.com/hydradb" className={fieldClass} /><span className="mt-1 block text-xs font-normal text-muted-foreground">Use HTTPS on port 443 with no query parameters. Your local 127.0.0.1 dashboard cannot receive cloud callbacks.</span></label>
        <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={generateSecret} onChange={event => setGenerateSecret(event.target.checked)} /><span>Generate a signing secret. {overview?.webhook?.signing ? 'This replaces the current secret immediately; prepare the receiver before saving.' : 'Save the returned secret in your receiver’s secret manager.'}</span></label>
        <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={acknowledge} onChange={event => setAcknowledge(event.target.checked)} /><span>I understand this updates the organization’s shared indexing notification endpoint.</span></label>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || !acknowledge || overview?.webhook === null}>Save indexing webhook</Button><Button variant="outline" disabled={busy || !overview?.webhook?.registered} onClick={() => void perform(async () => { const result = await request('', { action: 'test-webhook' }); setNotice(`${result.message}${result.receiverStatus ? ` Receiver HTTP ${result.receiverStatus}.` : ''}`); if (result.delivered === false) setError('The receiver rejected the test notification.'); await refresh(); })}>Send test notification</Button></div>
      </form>
      {signingSecret && <div className="rounded-xl border border-primary/40 bg-primary/5 p-4"><p className="text-sm font-semibold">Signing secret returned once</p><p className="mt-1 text-sm">••••••••••••••••••••••••</p><p className="mt-1 text-xs text-muted-foreground">Copy it into your receiver’s secret manager now. RRFLOW keeps it only in this open view.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(signingSecret).then(() => setNotice('Signing secret copied. Save it in your receiver’s secret manager.')).catch(() => setError('Clipboard access was refused. Keep this view open and allow clipboard access.'))}><Copy aria-hidden />Copy signing secret</Button><Button variant="outline" size="sm" onClick={() => setSigningSecret(null)}>Dismiss secret</Button></div></div>}
      <div><h4 className="text-sm font-semibold">Recent notification deliveries</h4>{!overview?.deliveries.length ? <p className="mt-2 text-sm text-muted-foreground">No deliveries returned. Save a receiver and send an explicit test.</p> : <ul className="mt-2 space-y-2">{overview.deliveries.map(item => <li key={item.id} className="rounded-lg border border-border p-3 text-sm"><p>{stateName(item.status)} · indexing {stateName(item.indexingStatus)} · {item.attempts ?? '?'} attempts</p><p className="mt-1 break-all text-xs text-muted-foreground">{time(item.at)} · {item.source ?? 'Test notification'}</p>{item.url && <p className="mt-1 break-all text-xs">Receiver at delivery time: {item.url}</p>}</li>)}</ul>}</div>
    </section>
  </section>;
};
