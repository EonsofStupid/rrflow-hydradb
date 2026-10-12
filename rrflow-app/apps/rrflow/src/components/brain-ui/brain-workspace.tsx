'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, BookOpen, BrainCircuit, Check, ChevronRight, CircleAlert, ExternalLink, Info, LoaderCircle, Network, Radio, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useActivity } from '@/components/transparency/activity-provider';
import { brainCatalog, brainIds, type BrainId } from '@/lib/contracts';
import { applyBrainUiMessage, readBrainUiStream, type BrainUiModel, type BrainUiSurface } from '@/lib/brain-ui-contracts';
import styles from './brain-workspace.module.css';
import { ProjectPicker } from './project-picker';
import type { ProjectContext } from '@/lib/project-context-contracts';

type Avenue = BrainUiModel['avenues'][number];
const sourceUrl = (url: string) => { try { return new URL(url).protocol === 'https:' ? url : undefined; } catch { return undefined; } };
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });

export const BrainWorkspace = ({ compact = false }: { compact?: boolean }) => {
  const [goal, setGoal] = useState('Prepare the shippin.cloud Next.js dashboard for launch: accessible interactions, loading states, and reliable data access.');
  const [stack, setStack] = useState<Exclude<BrainId, 'core'>>('nextjs');
  const [project, setProject] = useState<ProjectContext | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [surface, setSurface] = useState<BrainUiSurface | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Avenue | null>(null);
  const [firstEvidenceMs, setFirstEvidenceMs] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'helpful' | 'missing_context' | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [dismissedTip, setDismissedTip] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const modalTrigger = useRef<HTMLButtonElement | null>(null);
  const { record, setPanelOpen } = useActivity();
  useEffect(() => () => controller.current?.abort(), []);

  const generate = async (event?: FormEvent) => {
    event?.preventDefault();
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setLoading(true); setError(''); setSurface(null); setSelected(null); setFirstEvidenceMs(null); setFeedback(null); setFeedbackError('');
    const started = performance.now();
    let next: BrainUiSurface | null = null;
    let first = true;
    const seenReceipts = new Set<string>();
    try {
      const response = await fetch('/api/brain-ui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal, stack, ...(project ? { projectId: project.id, projectWorkspace: project.workspace } : {}) }), signal: request.signal });
      if (!response.ok) throw new Error((await response.json()).error || 'The workspace could not be opened.');
      await readBrainUiStream(response, message => {
        if (controller.current !== request) return;
        next = applyBrainUiMessage(next, message);
        setSurface(next);
        if (next?.model?.brains.length && first) { setFirstEvidenceMs(Math.round(performance.now() - started)); first = false; }
        const receipts = (next?.model?.receipts || []).filter(receipt => {
          const key = `${receipt.service}|${receipt.requestId}|${receipt.at}|${receipt.latencyMs}`;
          if (seenReceipts.has(key)) return false;
          seenReceipts.add(key); return true;
        });
        if (receipts.length) record('Brain workspace updated', receipts, { notify: false });
      });
      // A stream ending while work is pending is a disconnect, never a successful empty result.
      const finalModel = (next as BrainUiSurface | null)?.model;
      if (!finalModel || finalModel.status.phase === 'loading' || ['waiting', 'pending'].includes(finalModel.observation.status)) throw new Error('The connection ended before all status updates arrived. Please retry.');
      record(finalModel.status.phase === 'ready' ? 'Knowledge workspace ready' : 'Knowledge workspace needs attention', [], { notify: finalModel.status.phase === 'ready' ? 'success' : 'error', summary: finalModel.status.message });
    } catch (cause) {
      if (controller.current !== request) return;
      const message = request.signal.aborted ? 'Stopped loading. Retrieved knowledge remains visible; reporting may be incomplete.' : cause instanceof Error ? cause.message : 'The interface could not be loaded.';
      setError(message);
      record('Brain workspace interrupted', [], { notify: 'error', summary: message });
    } finally { if (controller.current === request) setLoading(false); }
  };
  const model = surface?.model;
  const sendFeedback = async (verdict: 'helpful' | 'missing_context') => {
    if (!model || feedbackBusy) return;
    const eventId = model.eventId;
    setFeedbackBusy(true); setFeedbackError('');
    try {
      const response = await fetch('/api/brain-ui/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, verdict }) });
      const body = await response.json();
      if (!response.ok || body.status !== 'accepted') throw new Error(body.error || 'Raindrop has not accepted the feedback. Please retry.');
      setFeedback(verdict);
      record('Your quality feedback reached Raindrop', body.receipts || [], { summary: verdict === 'helpful' ? 'Marked this knowledge interface helpful.' : 'Marked missing context for investigation.' });
    } catch (cause) { setFeedbackError(cause instanceof Error ? cause.message : 'Feedback could not be sent.'); }
    finally { setFeedbackBusy(false); }
  };

  const renderComponent = (id: string, depth = 0): ReactNode => {
    if (!surface || !model || depth > 10) return null;
    const component = surface.components[id];
    if (!component) return <div key={id} className={styles.placeholder}>Waiting for interface content…</div>;
    if (component.component === 'Column') {
      const order: Record<string, number> = { WorkflowStatus: 0, BrainSummary: 1, Observation: 2, AvenueCard: 3 };
      const children = compact ? [...component.children].sort((a, b) => (order[surface.components[a]?.component] ?? 4) - (order[surface.components[b]?.component] ?? 4)) : component.children;
      return <div key={id} className={styles.surface}>{children.map(child => renderComponent(child, depth + 1))}</div>;
    }
    if (component.component === 'WorkflowStatus') return <section key={id} className={styles.status} aria-label="Orchestration status">
      <div className={styles.sectionTitle}><Network size={18} /><h2>Work, with a visible trail</h2><span className={styles.badge}>Triggered workflow</span></div>
      <ol className={styles.stages}>
        <li><Check size={17} /><strong>Specialists selected</strong><span>{[...new Set<BrainId>(['core', model.stack, ...(['react', 'nextjs'].includes(model.stack) ? ['typescript' as const] : []), ...(model.project?.stack || [])])].map(id => brainCatalog[id].name).join(' + ')}</span>{model.project && <span>Using {model.project.name} · {model.project.revision.slice(0, 12)}</span>}</li>
        <li>{model.status.phase === 'loading' && isLoading ? <LoaderCircle className={styles.spin} size={17} /> : model.failures.length ? <CircleAlert size={17} /> : <Check size={17} />}<strong>Knowledge from HydraDB</strong><span>{model.status.completed} of {model.status.total} reads finished</span></li>
        <li><BrainCircuit size={17} /><strong>{model.brains.length ? 'Interface populated' : 'Waiting for knowledge'}</strong><span>{model.avenues.length} avenues available</span></li>
        <li><Info size={17} /><strong>Engineering checks pending</strong><span>Execution and AI assessment have not run</span></li>
      </ol>
      <p role="status">{error ? 'The stream stopped. See the connection notice above.' : model.status.message}</p>
      {model.failures.map(failure => <p key={failure.brainId} role="alert" className={styles.error}><strong>{brainCatalog[failure.brainId].name}:</strong> {failure.message}</p>)}
    </section>;
    if (component.component === 'BrainSummary') {
      const item = model.brains[Number(component.path.split('/').pop())];
      return item ? <section key={id} className={styles.brain} aria-label={`${item.brain.name} source`}><BrainCircuit size={21} /><div><h3>{item.brain.name}</h3><p>{item.brain.avenues} avenues · {item.brain.questions} questions</p></div><span className={styles.badge}>{item.latencyMs} ms</span></section> : null;
    }
    if (component.component === 'AvenueCard') {
      const avenue = model.avenues[Number(component.path.split('/').pop())];
      return avenue ? <section key={id} className={styles.avenue}>
        <div className={styles.avenueTop}><span>{brainCatalog[avenue.brainId].name}</span><span className={styles.tooltipWrap} onMouseEnter={() => setDismissedTip(null)}>
          <button type="button" className={styles.help} aria-label={`Why ${avenue.title}?`} aria-describedby={`${id}-tip`} onFocus={() => setDismissedTip(null)} onKeyDown={event => { if (event.key === 'Escape') setDismissedTip(id); }} onClick={event => { modalTrigger.current = event.currentTarget; setDismissedTip(id); setSelected(avenue); }}><Info size={16} /></button>
          <span role="tooltip" id={`${id}-tip`} className={styles.tooltip} style={dismissedTip === id ? { display: 'none' } : undefined}>{avenue.selection} Source: {avenue.sourceTitle}.</span>
        </span></div>
        <h3>{avenue.title}</h3><p>{avenue.questions[0]?.text || 'No review questions returned.'}</p>
        <button className={styles.openAvenue} onClick={event => { modalTrigger.current = event.currentTarget; setSelected(avenue); }}><span>Explore {avenue.questions.length} questions</span><ChevronRight size={16} /><span className="sr-only"> in {avenue.title}</span></button>
      </section> : null;
    }
    return <section key={id} className={styles.observation} aria-label="Raindrop quality">
      <div className={styles.sectionTitle}><Radio size={19} /><h2>Make the next result better</h2><span className={styles.badge}>Raindrop</span></div>
      <p>Report whether these avenues help with your work. Raindrop links that verdict to the source revisions and HydraDB requests behind this interface.</p>
      <dl className={styles.alignmentFacts}><div><dt>Context selected from HydraDB</dt><dd>{model.brains.map(item => item.brain.name).join(' + ') || 'Waiting for knowledge'}</dd></div><div><dt>Knowledge avenues</dt><dd>{model.avenues.length}</dd></div><div><dt>Source revisions</dt><dd>{model.brains.length}</dd></div></dl>
      <details className={styles.alignmentEvidence}><summary>Inspect the context behind this feedback</summary><p>Event {model.eventId}</p>{model.brains.map(item => <p key={item.brain.id}>{item.brain.name} · revision {item.brain.revision}</p>)}<p>{model.receipts.filter(receipt => receipt.service === 'HydraDB').length} HydraDB requests. Use “Inspect real requests” for timings and native request IDs.</p></details>
      <div className={styles.delivery} role="status">{model.observation.status === 'accepted' ? <Check size={16} /> : ['waiting', 'pending'].includes(model.observation.status) && isLoading ? <LoaderCircle className={styles.spin} size={16} /> : <CircleAlert size={16} />}
        {model.observation.status === 'accepted' ? 'Event accepted by Raindrop' : model.observation.status === 'pending' ? isLoading ? 'Reporting this interface… Knowledge is ready to use.' : 'Reporting completion is unknown. Retry to verify.' : model.observation.status === 'waiting' ? isLoading ? 'Waiting for the knowledge reads' : 'Reporting did not finish' : model.observation.status === 'not_configured' ? 'Raindrop reporting is not configured' : model.observation.error || 'Reporting failed. Knowledge remains available.'}
      </div>
      {model.observation.status === 'accepted' && <div className={styles.feedback}>
        {feedback ? <p role="status">{feedback === 'helpful' ? 'Marked helpful.' : 'Missing context reported.'} Your feedback was accepted by Raindrop.</p> : <><Button variant="outline" disabled={feedbackBusy} onClick={() => void sendFeedback('helpful')}>This helps</Button><Button variant="outline" disabled={feedbackBusy} onClick={() => void sendFeedback('missing_context')}>Missing context</Button>{feedbackBusy && <span role="status">Sending feedback…</span>}</>}
        {model.observation.eventUrl && <a href={model.observation.eventUrl} target="_blank" rel="noreferrer">Open this event <ExternalLink size={14} /></a>}
      </div>}
      {feedbackError && <p role="alert" className={styles.error}>{feedbackError}</p>}
      <p className={styles.fine}>Feedback supplies evaluation evidence. No prompt or rule is automatically promoted.</p>
    </section>;
  };

  return <div className={styles.workspace}>
    <section className={styles.intro}><span className={styles.kicker}><Sparkles size={15} /> HYDRADB CONTEXT + RAINDROP FEEDBACK</span><h2>{compact ? 'Better context starts here.' : <>The right context.<br />Right where you work.</>}</h2><p>{compact ? 'Describe your work. Watch HydraDB populate the interface, inspect the sources, then tell Raindrop whether the selected context helps — all on this dashboard.' : 'Open a path through your engineering brains. Get sourced guidance, quick explanations, and the questions that deserve a closer look.'}</p></section>
    <details open={compact ? undefined : true} className={styles.projectSection}><summary>Use an existing folder or GitHub project{project ? ` · ${project.name}` : ''}</summary><ProjectPicker project={project} onSelect={value => { setProject(value); setSurface(null); setError(''); const detected = (['nextjs', 'react', 'rust', 'go', 'typescript'] as const).find(id => value?.stack.includes(id)); if (detected) setStack(detected); }} disabled={isLoading || feedbackBusy || projectBusy} onBusy={setProjectBusy} /></details>
    <form className={styles.form} onSubmit={generate}>
      <label className={styles.goal}>What are you working on?<textarea value={goal} onChange={event => setGoal(event.target.value)} minLength={8} maxLength={1000} required rows={3} /></label>
      <div className={styles.formBottom}><label>Lead specialist<select value={stack} onChange={event => setStack(event.target.value as Exclude<BrainId, 'core'>)}>{brainIds.filter(id => id !== 'core').map(id => <option key={id} value={id}>{brainCatalog[id].name}</option>)}</select></label><Button className="primary-button" type="submit" disabled={isLoading || feedbackBusy || projectBusy}>{isLoading ? <LoaderCircle size={17} className={styles.spin} /> : <Sparkles size={17} />}{isLoading ? model && model.status.phase !== 'loading' ? 'Reporting quality…' : 'Opening knowledge…' : 'Build my workspace'}{!isLoading && <ArrowRight size={16} />}</Button>{isLoading && <Button variant="ghost" type="button" onClick={() => controller.current?.abort()}>Stop</Button>}</div>
      <p className={styles.fine}>A2UI v0.9.1 · Your stored research selects the content. A deterministic workflow chooses avenues from your goal and saved project topics; no model inference is claimed.</p>
    </form>
    {error && <div role="alert" className={styles.errorBox}><CircleAlert size={18} /><span>{error}</span><Button variant="outline" disabled={isLoading} onClick={() => void generate()}>Retry</Button></div>}
    {model && <div className={styles.freshness}><span><span className={styles.dot} />Requested from HydraDB · {time(model.startedAt)}</span>{firstEvidenceMs !== null && <span data-testid="first-evidence">First knowledge received in {firstEvidenceMs} ms</span>}<button onClick={() => setPanelOpen(true)}>Inspect real requests <ArrowRight size={13} /></button><button disabled={isLoading || feedbackBusy || projectBusy} onClick={() => void generate()}><RefreshCw size={13} />Refresh knowledge</button></div>}
    {surface && renderComponent('root')}
    {!surface && !isLoading && !error && <div className={styles.empty}><Network size={28} /><h3>One goal. Connected expertise.</h3><p>Choose a specialist to bring the engineering core and relevant language knowledge into one workspace.</p><div><span>HydraDB knowledge</span><ChevronRight size={14} /><span>Dynamic interface</span><ChevronRight size={14} /><span>Raindrop feedback</span></div></div>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-w-2xl" onCloseAutoFocus={event => { event.preventDefault(); modalTrigger.current?.focus(); }}><DialogHeader><DialogTitle>{selected?.title || 'Knowledge avenue'}</DialogTitle><DialogDescription>{selected ? `${brainCatalog[selected.brainId].name} · ${selected.questions.length} research questions · Evidence still needed` : 'Source-backed knowledge'}</DialogDescription></DialogHeader>{selected && <div className={styles.modalBody}><p className={styles.selection}><Info size={17} />{selected.selection}</p><ol className={styles.questions}>{selected.questions.map(question => <li key={question.id}><strong>{question.text}</strong><span>Research draft · Not checked</span></li>)}</ol><div className={styles.source}><BookOpen size={18} /><div><strong>{selected.sourceTitle}</strong><p>Revision {selected.revision}</p>{sourceUrl(selected.sourceUrl) && <a href={sourceUrl(selected.sourceUrl)} target="_blank" rel="noreferrer">Open source research <ExternalLink size={13} /></a>}</div></div><details><summary>Where this knowledge came from</summary><p>Database: {model?.database} · Collection: {model?.collection}</p><p>Avenue: {selected.id}</p>{model?.brains.find(item => item.brain.id === selected.brainId)?.requestIds.map(id => <p key={id}>HydraDB request: {id}</p>)}</details></div>}</DialogContent></Dialog>
  </div>;
};
