'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Fingerprint, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { REGISTRY_DATABASE, registryCollections, brainRegistryActionSchema, canonicalBrainName, registryReadSchema, validateBrainRegistry, type BrainRegistryAction, type RegisteredBrain, type RegistryWorkspace } from '@/lib/brain-registry-contracts';
import { atlasCollectionsSchema, atlasProjectsSchema, type AtlasDatabase } from '@/lib/source-atlas-contracts';
import type { ProjectSummary } from '@/lib/project-context-contracts';
import styles from './source-atlas.module.css';

type Snapshot = z.infer<typeof registryReadSchema>;
export const BrainRegistry = ({ workspace, databases, onInspect }: { workspace: RegistryWorkspace; databases: AtlasDatabase[]; onInspect: (database: string) => void }) => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<{ brain: RegisteredBrain | null; revision: number } | null>(null);
  const [search, setSearch] = useState('');
  const trigger = useRef<HTMLButtonElement | null>(null);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const current = ++sequence.current; setBusy(true); setError(''); setSnapshot(null);
    try {
      const response = await fetch(`/api/brain-registry?workspace=${workspace}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Registered brains could not load.');
      const parsed = registryReadSchema.parse(body);
      if (parsed.workspace !== workspace) throw new Error('The registry response belongs to a different workspace.');
      validateBrainRegistry(workspace, parsed.brains);
      if (current === sequence.current) setSnapshot(parsed);
    } catch (cause) {
      if (current === sequence.current) setError(cause instanceof z.ZodError ? 'The registry response is incomplete. Refresh before editing.' : cause instanceof Error ? cause.message : 'Registered brains could not load.');
    } finally { if (current === sequence.current) setBusy(false); }
  }, [workspace]);
  const invalidateReload = useCallback(() => { sequence.current++; }, []);
  useEffect(() => { void reload(); return invalidateReload; }, [reload, invalidateReload]);
  const visible = snapshot?.brains.filter(brain => [brain.displayName, brain.canonicalName, ...brain.aliases].some(value => value.toLowerCase().includes(search.toLowerCase()))) ?? [];
  return <section className={styles.panel} aria-label="Registered brains"><span className={styles.eyebrow}><Fingerprint size={15} /> STABLE IDENTITIES · SAVED IN HYDRADB</span><div className={styles.registryHeading}><div><h3>Give each brain a lasting identity.</h3><p>A readable address, an immutable ID, and an explicit link to its existing sources.</p></div><Button variant="outline" onClick={() => void reload()} disabled={busy}><RefreshCw size={15} />Refresh names</Button></div>
    <p className={styles.fine}>Identity records: {REGISTRY_DATABASE} / {registryCollections[workspace]}. Original sources stay in their bound databases.</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{busy && <p role="status">Reading registered brains…</p>}
    {snapshot && <><p className={styles.fine}>Registry revision {snapshot.revision} · checked {new Date(snapshot.checkedAt).toLocaleString()}. Names organize this workspace; they do not change native connector routing.</p><label className={styles.field}>Find a registered name or alias<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, address, or previous address" /></label>
      <div className={styles.brains}>{visible.map(brain => <article className={styles.brain} key={brain.id}><h4>{brain.displayName}</h4><code>{brain.canonicalName}</code><p>{brain.database} / {brain.collection || 'default collection'}</p><details><summary>Identity & previous names</summary><p><code>{brain.id}</code></p><p>Brain revision {brain.revision} · {new Date(brain.updatedAt).toLocaleString()}</p><p>Project: {brain.projectId || 'Workspace-wide'}</p>{brain.aliases.length ? brain.aliases.map(alias => <p key={alias}><code>{alias}</code></p>) : <p>No previous addresses.</p>}</details><Button variant="outline" disabled={!databases.some(item => item.name === brain.database && item.workspace === workspace)} onClick={() => onInspect(brain.database)}>Inspect bound database</Button><Button variant="outline" onClick={event => { trigger.current = event.currentTarget; setForm({ brain, revision: snapshot.revision }); }}>Rename {brain.displayName}</Button></article>)}</div>
      {!visible.length && <p>{snapshot.brains.length ? 'No names or aliases match your search.' : 'No logical brains are registered yet. Your existing databases and sources are available above.'}</p>}
      <Button variant="outline" onClick={event => { trigger.current = event.currentTarget; setForm({ brain: null, revision: snapshot.revision }); }}><Plus size={16} />Register a brain</Button>
      <details><summary>Registry read evidence</summary>{snapshot.receipts.map((receipt, index) => <p key={index} className={styles.fine}>{receipt.action} · {receipt.outcome} · {receipt.requestId || 'No request ID returned'}</p>)}</details>
    </>}
    <Dialog open={!!form} onOpenChange={open => { if (!open) setForm(null); }}><DialogContent className={styles.dialog} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}><DialogHeader><DialogTitle>{form?.brain ? 'Rename this brain' : 'Register a brain'}</DialogTitle><DialogDescription>Review the name and source binding. Saving creates or updates registry metadata; it does not move sources or rename a native database.</DialogDescription></DialogHeader>{form && <RegistrationForm key={`${form.brain?.id ?? 'new'}:${form.revision}`} workspace={workspace} databases={databases} initial={form.brain} expectedRevision={form.revision} onSaved={message => { setForm(null); setNotice(message); void reload(); }} />}</DialogContent></Dialog>
  </section>;
};

const RegistrationForm = ({ workspace, databases, initial, expectedRevision, onSaved }: { workspace: RegistryWorkspace; databases: AtlasDatabase[]; initial: RegisteredBrain | null; expectedRevision: number; onSaved: (message: string) => void }) => {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [projectId, setProjectId] = useState(initial?.projectId ?? '');
  const [projectSlug, setProjectSlug] = useState(initial?.projectSlug ?? 'shared');
  const [purpose, setPurpose] = useState<RegisteredBrain['purpose']>(initial?.purpose ?? 'knowledge');
  const [database, setDatabase] = useState(initial?.database ?? '');
  const [collection, setCollection] = useState(initial?.collection ?? '');
  const [collections, setCollections] = useState<{ database: string; names: string[] } | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectError, setProjectError] = useState('');
  const [collectionError, setCollectionError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/project-context?workspace=${workspace}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Saved projects are unavailable. You can still register workspace-wide knowledge.');
      const body = atlasProjectsSchema.parse(await response.json());
      if (!controller.signal.aborted) setProjects(body.projects.filter(project => project.workspace === workspace));
    }).catch(() => { if (!controller.signal.aborted) setProjectError('Saved projects are unavailable. Refresh this form before linking a project.'); });
    return () => controller.abort();
  }, [workspace]);
  useEffect(() => {
    if (!database || initial) return;
    const controller = new AbortController();
    void fetch(`/api/explore/${encodeURIComponent(database)}/collections`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Collection discovery failed.');
      const body = atlasCollectionsSchema.parse(await response.json());
      if (!controller.signal.aborted) { setCollections({ database, names: body.collections }); setCollectionError(''); }
    }).catch(() => { if (!controller.signal.aborted) setCollectionError('Collections could not be verified. Choose the database again to retry.'); });
    return () => controller.abort();
  }, [database, initial]);
  const input: BrainRegistryAction = initial ? { action: 'rename', workspace, expectedRevision, brainId: initial.id, displayName, projectSlug, purpose } : { action: 'register', workspace, expectedRevision, displayName, projectId: projectId || null, projectSlug, purpose, database, collection };
  const valid = brainRegistryActionSchema.safeParse(input).success && (!!initial || collections?.database === database) && (!projectId ? projectSlug === 'shared' : projectSlug !== 'shared');
  const address = projectSlug.length <= 48 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(projectSlug) ? canonicalBrainName(workspace, projectSlug, purpose) : 'Enter a valid project slug';
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!valid || saving) return; setSaving(true); setError('');
    try {
      const response = await fetch('/api/brain-registry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(45_000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'The brain could not be saved. Refresh before retrying.');
      const result = registryReadSchema.parse(body); validateBrainRegistry(workspace, result.brains);
      if (result.workspace !== workspace || result.revision !== expectedRevision + 1) throw new Error('The save result could not be verified. Refresh the registry before retrying.');
      const saved = result.brains.find(brain => initial ? brain.id === initial.id : brain.canonicalName === address);
      if (!saved || saved.canonicalName !== address || saved.displayName !== displayName.trim() || saved.database !== database || saved.collection !== collection) throw new Error('The saved identity does not match this form. Refresh the registry before retrying.');
      if (mounted.current) onSaved(body.message || 'Saved in HydraDB.');
    } catch (cause) { if (mounted.current) setError(cause instanceof z.ZodError ? 'The save result is incomplete. Refresh before retrying.' : cause instanceof Error ? cause.message : 'The brain could not be saved.'); }
    finally { if (mounted.current) setSaving(false); }
  };
  return <form onSubmit={event => void submit(event)} className={styles.inspector}>
    <label className={styles.field}>Brain display name<input maxLength={80} value={displayName} onChange={event => setDisplayName(event.target.value)} required /></label>
    {initial ? <p>Project reference: {initial.projectId || 'Workspace-wide'}. Native binding: {initial.database} / {initial.collection || 'default collection'}.</p> : <><label className={styles.field}>Saved project<select value={projectId} onChange={event => { setProjectId(event.target.value); setProjectSlug(event.target.value ? '' : 'shared'); }}><option value="">Workspace-wide knowledge</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>{projectError && <p role="alert">{projectError}</p>}</>}
    <div className={styles.nameFields}><label className={styles.field}>Registered project slug<input maxLength={48} value={projectSlug} readOnly={!projectId} onChange={event => setProjectSlug(event.target.value)} required /></label><label className={styles.field}>Registered purpose<select value={purpose} onChange={event => setPurpose(event.target.value as typeof purpose)}>{['knowledge', 'practice', 'catalog', 'intake'].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
    {!initial && <><label className={styles.field}>Bind existing database<select value={database} onChange={event => { setCollection(''); setCollections(null); setCollectionError(''); setDatabase(event.target.value); }} required><option value="">Choose a database in this workspace</option>{databases.filter(item => item.workspace === workspace).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><label className={styles.field}>Bind source collection<select value={collection} onChange={event => setCollection(event.target.value)} disabled={collections?.database !== database}><option value="">Default collection</option>{collections?.database === database && collections.names.filter(Boolean).map(name => <option key={name} value={name}>{name}</option>)}</select></label>{collectionError && <p role="alert">{collectionError}</p>}</>}
    <div className={styles.route}><strong>Review before saving</strong><code>{address}</code><span>→ {database || 'Choose a database'} / {collection || 'default collection'}</span><span>{workspace === 'personal' ? 'Personal' : 'Shippin work'} · expected registry revision {expectedRevision}</span>{initial && <span>Immutable ID: {initial.id}. A changed address is retained as an alias.</span>}</div>
    {error && <p role="alert">{error}</p>}<Button type="submit" disabled={!valid || saving}>{saving ? 'Saving in HydraDB…' : initial ? 'Save brain name' : 'Save brain registration'}</Button>
  </form>;
};
