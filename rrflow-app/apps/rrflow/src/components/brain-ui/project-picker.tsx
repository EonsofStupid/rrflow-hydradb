'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Database, FolderOpen, Github, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActivity } from '@/components/transparency/activity-provider';
import { brainCatalog } from '@/lib/contracts';
import { projectContextSchema, type ProjectContext, type ProjectSummary } from '@/lib/project-context-contracts';
import styles from './project-picker.module.css';

export const ProjectPicker = ({ project, onSelect, disabled, onBusy, initialWorkspace = 'shippin' }: { project: ProjectContext | null; onSelect: (project: ProjectContext | null) => void; disabled: boolean; onBusy: (busy: boolean) => void; initialWorkspace?: 'personal' | 'shippin' }) => {
  const [kind, setKind] = useState<'folder' | 'github'>('folder');
  // This scopes saved project metadata; Personal source connectors use their own database destination.
  // Existing Project/ProjectContext records stay in the configured graph until an explicit migration.
  const [workspace, setWorkspace] = useState<'personal' | 'shippin'>(initialWorkspace);
  const [location, setLocation] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const requestVersion = useRef(0);
  const { record } = useActivity();
  useEffect(() => {
    const abort = new AbortController();
    const version = ++requestVersion.current;
    fetch(`/api/project-context?workspace=${workspace}`, { signal: abort.signal }).then(async response => {
      const body = await response.json();
      if (abort.signal.aborted || version !== requestVersion.current) return;
      if (!response.ok) throw new Error(body.error || 'Saved projects could not be loaded.');
      setProjects(body.projects);
    }).catch(cause => { if (!abort.signal.aborted && version === requestVersion.current) setListError(cause instanceof Error ? cause.message : 'Saved projects could not be loaded.'); });
    return () => abort.abort();
  }, [workspace]);

  const load = async (source: { kind: 'folder' | 'github'; location: string; workspace: 'personal' | 'shippin' } | { id: string; workspace: 'personal' | 'shippin' }) => {
    // A pending list must not replace the freshly saved project when it arrives later.
    const version = ++requestVersion.current;
    setBusy(true); onBusy(true); setError('');
    try {
      const response = await fetch('id' in source ? `/api/project-context?id=${encodeURIComponent(source.id)}&workspace=${source.workspace}` : '/api/project-context', 'id' in source ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(source) });
      const body = await response.json();
      if (version !== requestVersion.current) return;
      if (!response.ok) { record('Project context needs attention', body.receipts || [], { notify: 'error', summary: body.error }); throw new Error(body.error || 'The project could not be loaded.'); }
      const saved = projectContextSchema.parse(body.project);
      onSelect(saved); setProjects(previous => [saved, ...previous.filter(item => item.id !== saved.id)]); setListError('');
      record('Project context ready', body.receipts || [], { summary: `${saved.name}: ${saved.bounds.listedFiles} paths and ${saved.bounds.inspectedManifests} manifests. Commands have not run.` });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The project could not be loaded.'); }
    finally { setBusy(false); onBusy(false); }
  };
  const visibleProjects = projects.filter(item => item.workspace === workspace);
  const submit = (event: FormEvent) => { event.preventDefault(); void load({ kind, location, workspace }); };
  return <section className={styles.picker} aria-label="Project context">
    <div className={styles.heading}><FolderOpen size={21} /><div><h3>Bring your real project</h3><p>Give the brains the shape of your codebase, so their guidance fits your work.</p></div></div>
    <form onSubmit={submit} className={styles.form}>
      <label className={styles.saved}>Where does this project belong?<select aria-label="Project workspace" value={workspace} disabled={busy || disabled} onChange={event => { requestVersion.current += 1; setWorkspace(event.target.value as 'personal' | 'shippin'); onSelect(null); setProjects([]); setListError(''); }}><option value="shippin">Shippin · Work</option><option value="personal">Personal · Life and growth</option></select></label>
      <fieldset disabled={busy || disabled} className={styles.sources}><legend className="sr-only">Project source</legend><label><input type="radio" name="project-kind" value="folder" checked={kind === 'folder'} onChange={() => setKind('folder')} /><FolderOpen size={15} />Local folder</label><label><input type="radio" name="project-kind" value="github" checked={kind === 'github'} onChange={() => setKind('github')} /><Github size={15} />GitHub repository</label></fieldset>
      <div className={styles.inputRow}><label>{kind === 'folder' ? 'Existing project folder' : 'GitHub project'}<input aria-describedby="project-source-help" value={location} onChange={event => setLocation(event.target.value)} placeholder={kind === 'folder' ? 'D:\\localdev\\my-project or /home/me/my-project' : 'https://github.com/owner/repository'} required maxLength={1000} disabled={busy || disabled} /></label><Button type="submit" variant="outline" disabled={busy || disabled || !location.trim()}>{busy ? <LoaderCircle className={styles.spin} size={16} /> : <Database size={16} />}Load project into HydraDB</Button></div>
      <p id="project-source-help" className={styles.note}>{kind === 'folder' ? 'The folder must exist on the computer running RRFLOW. Windows drive paths work with our WSL server.' : 'Reads the default branch at one exact commit. Private repositories require a server-side GITHUB_TOKEN.'} Saves a bounded file list, recognized technologies, and check names to HydraDB in your chosen workspace. Source code, manifest values, hidden files and credentials are excluded; nothing runs.</p>
    </form>
    {visibleProjects.length > 0 && <label className={styles.saved}>Resume a saved project<select aria-label="Resume a saved project" value={project?.workspace === workspace ? project.id : ''} disabled={busy || disabled} onChange={event => { if (event.target.value) void load({ id: event.target.value, workspace }); }}><option value="">Choose saved context…</option>{visibleProjects.map(item => <option key={item.id} value={item.id}>{item.name} · {item.kind === 'folder' ? 'folder' : 'GitHub'}</option>)}</select></label>}
    {listError && <p className={styles.note} role="status">Saved projects: {listError}</p>}
    {busy && <p className={styles.loading} role="status"><LoaderCircle className={styles.spin} size={16} />Reading project metadata and its HydraDB record…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {project?.workspace === workspace && <div className={styles.context}>
      <div className={styles.ready}><Check size={17} /><strong>{project.name}</strong><span>Saved in HydraDB · {project.workspace === 'personal' ? 'Personal' : 'Shippin work'}</span><Button type="button" variant="ghost" size="sm" disabled={busy || disabled} onClick={() => void load({ kind: project.kind, location: project.location, workspace: project.workspace })}><RefreshCw size={14} />Refresh project</Button><Button type="button" variant="ghost" size="sm" disabled={busy || disabled} onClick={() => onSelect(null)}>Clear selection</Button></div>
      <p className={styles.location}>{project.location}</p>
      <div className={styles.stack}>{project.stack.length ? project.stack.map(id => <span key={id}>{brainCatalog[id].name}</span>) : <span>Choose a lead specialist below</span>}<span>{project.bounds.listedFiles} file paths</span><span>{project.bounds.inspectedManifests} manifests</span></div>
      <p className={styles.note}>Loaded {new Date(project.loadedAt).toLocaleString()} · {project.revisionKind === 'git_commit' ? 'Git commit' : 'Metadata fingerprint'} <code>{project.revision.slice(0, 12)}</code>{project.sourceUpdatedAt && <> · Latest sampled source update {new Date(project.sourceUpdatedAt).toLocaleString()}</>}</p>
      <div className={styles.details}>
        <details><summary>Explore the project files ({project.files.length})</summary><ul className={styles.files}>{project.files.map(file => <li key={file}>{file}</li>)}</ul></details>
        <details><summary>Available checks ({project.checks.length}) · Not run</summary>{project.checks.length ? <ul className={styles.checks}>{project.checks.map(check => <li key={`${check.directory}:${check.command}`}><code>{check.command}</code><span>in {check.directory} · Not run</span></li>)}</ul> : <p className={styles.note}>No recognized check script names were found in this preview.</p>}<p className={styles.note}>These are declared check entry points, not verified instructions. Their script contents have not been trusted or executed.</p></details>
        <details><summary>How the project shapes guidance</summary><p className={styles.note}>RRFLOW reloads this saved HydraDB record when you build the workspace. Detected technologies add relevant specialists; project topics help select knowledge avenues alongside your goal.</p><p className={styles.note}>Detected topics: {project.topics.join(', ') || 'No recognizable topics yet'}.</p></details>
      </div>
      {project.warnings.map(warning => <p key={warning} className={styles.note}>{warning}</p>)}
    </div>}
  </section>;
};
