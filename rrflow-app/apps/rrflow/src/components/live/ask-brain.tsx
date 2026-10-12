'use client';
import { useState } from 'react';
import { LoaderCircle, Search, ThumbsDown, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { meshBrainIds, meshCatalog, type MeshBrainId, type RecallMode, type RecallResult, type ServiceReceipt } from '@/lib/mesh-contracts';
import { useActivity } from '@/components/transparency/activity-provider';

type AskState =
  | { status: 'idle' }
  | { status: 'asking' }
  | { status: 'answered'; result: RecallResult }
  | { status: 'failed'; message: string; requestId: string | null };

/** Starter questions a non-engineer might ask, each aimed at the brain that should know. */
type FeedbackState = 'none' | 'sending' | 'recorded' | 'not_monitored' | 'failed';

/** Lets the person judge an answer; their verdict is what Raindrop measures quality against. */
const AnswerFeedback = ({ eventId }: { eventId: string }) => {
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const { record } = useActivity();
  const handleFeedback = async (isHelpful: boolean) => {
    setFeedback('sending');
    const verdict = isHelpful ? 'helpful' : 'not helpful';
    try {
      const response = await fetch('/api/mesh/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, isHelpful }),
      });
      const body = await response.json();
      const receipts: ServiceReceipt[] = body.receipts ?? [];
      const next: FeedbackState = !response.ok ? 'failed' : body.isRecorded ? 'recorded' : 'not_monitored';
      setFeedback(next);
      if (next === 'recorded') record(`Raindrop accepted your "${verdict}" verdict`, receipts);
      else if (next === 'not_monitored') record('Verdict not stored: Raindrop reporting is not configured', receipts, { notify: 'info' });
      else record('Your verdict could not be sent', receipts, { notify: 'error', summary: body.error ?? 'Raindrop did not accept it.' });
    } catch {
      setFeedback('failed');
      record('Your verdict could not be sent', [], { notify: 'error', summary: 'RRFLOW could not reach its server.' });
    }
  };
  if (feedback === 'recorded') return <p className="text-xs text-muted-foreground">Raindrop accepted your feedback. No automatic changes have been made.</p>;
  if (feedback === 'not_monitored') return <p className="text-xs text-muted-foreground">Quality monitoring is not connected, so this feedback was not stored.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Was this helpful?</span>
      <button type="button" onClick={() => void handleFeedback(true)} disabled={feedback === 'sending'}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted disabled:opacity-50">
        <ThumbsUp className="size-4" aria-hidden /> Yes
      </button>
      <button type="button" onClick={() => void handleFeedback(false)} disabled={feedback === 'sending'}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted disabled:opacity-50">
        <ThumbsDown className="size-4" aria-hidden /> No
      </button>
      {feedback === 'failed' && <span className="text-xs text-rose-400">Could not send; try again.</span>}
    </div>
  );
};

const SUGGESTIONS: { brain: MeshBrainId; question: string }[] = [
  { brain: 'rrflow_specialist', question: 'What is the hackathon brief and when are submissions due?' },
  { brain: 'rrflow_specialist', question: 'Which system is the source of truth for what RRFLOW knows?' },
  { brain: 'seniordev', question: 'Why does a command fail in Git Bash on Windows?' },
];

export const AskBrain = () => {
  const [brain, setBrain] = useState<MeshBrainId>(SUGGESTIONS[0].brain);
  const [mode, setMode] = useState<RecallMode>('fast');
  const [question, setQuestion] = useState(SUGGESTIONS[0].question);
  const [state, setState] = useState<AskState>({ status: 'idle' });
  const { record } = useActivity();

  const ask = async (target: MeshBrainId, text: string) => {
    setState({ status: 'asking' });
    const brainName = meshCatalog[target].name;
    try {
      const response = await fetch('/api/mesh/recall', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brain: target, question: text, mode }),
      });
      const body = await response.json();
      if (!response.ok) {
        setState({ status: 'failed', message: body.error ?? 'The brain could not answer.', requestId: body.requestId ?? null });
        record(`Search in ${brainName} failed`, body.receipts ?? [], { notify: 'error', summary: body.error ?? undefined });
        return;
      }
      const result = body as RecallResult;
      setState({ status: 'answered', result });
      const count = result.hits.length;
      record(
        count ? `Found ${count} passage${count === 1 ? '' : 's'} in ${brainName}` : `${brainName} returned no matching evidence`,
        result.receipts,
        { notify: count ? 'success' : 'info' },
      );
    } catch {
      setState({ status: 'failed', message: 'RRFLOW could not reach its server. Your question is still here; try again.', requestId: null });
      record('Search could not start', [], { notify: 'error', summary: 'RRFLOW could not reach its server.' });
    }
  };

  const handleAsk = (event: React.FormEvent) => {
    event.preventDefault();
    void ask(brain, question);
  };

  const handleSuggestion = (suggestion: (typeof SUGGESTIONS)[number]) => {
    setBrain(suggestion.brain);
    setQuestion(suggestion.question);
    void ask(suggestion.brain, suggestion.question);
  };

  return (
    <section aria-labelledby="ask-heading" className="min-w-0 rounded-lg border border-border bg-card p-4">
      <h2 id="ask-heading" className="text-lg font-semibold">Ask a brain</h2>
      <p className="text-sm text-muted-foreground">Retrieve evidence from a selected brain. Each result shows its source; this search does not generate an AI answer.</p>
      <form onSubmit={handleAsk} className="mt-4 space-y-3">
        <fieldset>
          <legend className="sr-only">Which brain to ask</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {meshBrainIds.map(id => (
              <label key={id} className={cn('cursor-pointer rounded-full border px-3 py-1 text-sm focus-within:ring-2 focus-within:ring-ring',
                brain === id ? 'border-emerald-400 bg-emerald-400/10' : 'border-border')}>
                <input type="radio" name="brain" value={id} checked={brain === id} onChange={() => setBrain(id)} className="sr-only" />
                {meshCatalog[id].name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Search depth
          <select value={mode} onChange={event => setMode(event.target.value as RecallMode)} className="rounded-md border border-border bg-background px-2 py-1 text-foreground">
            <option value="fast">Fast</option><option value="thinking">Deep</option>
          </select>
        </label>
        <div className="flex gap-2">
          <label htmlFor="ask-question" className="sr-only">Your question</label>
          <input id="ask-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={500}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <button type="submit" disabled={state.status === 'asking' || question.trim().length < 3}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
            {state.status === 'asking' ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
            Ask
          </button>
        </div>
      </form>
      <div className="mt-3">
        <p className="text-xs text-muted-foreground">Try one of these:</p>
        <ul className="mt-2 space-y-1.5">
          {SUGGESTIONS.map(suggestion => (
            <li key={suggestion.question}>
              <button type="button" onClick={() => handleSuggestion(suggestion)} disabled={state.status === 'asking'}
                className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50">
                {suggestion.question}
                <span className="block text-xs text-muted-foreground">asks the {meshCatalog[suggestion.brain].name.toLowerCase()}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div aria-live="polite" className="mt-4">
        {state.status === 'failed' && (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm">
            {state.message}{state.requestId && <span className="block font-mono text-xs text-muted-foreground">Request ID: {state.requestId}</span>}
          </p>
        )}
        {state.status === 'answered' && (
          <div className="space-y-3">
            {state.result.hits.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                No matching evidence was returned. Try another question or source.
              </p>
            ) : (
              <ol className="space-y-2">
                {state.result.hits.map((hit, index) => (
                  <li key={`${hit.sourceId ?? hit.title}-${index}`} className="rounded-md border border-border p-3">
                    <p className="font-medium">{hit.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{hit.excerpt}</p>
                  </li>
                ))}
              </ol>
            )}
            {state.result.telemetry.status === 'accepted' && <AnswerFeedback key={state.result.eventId} eventId={state.result.eventId} />}
            {state.result.telemetry.status === 'failed' && <p role="alert" className="text-sm text-muted-foreground">{state.result.telemetry.error} This interaction was not confirmed by Raindrop.</p>}
            {state.result.telemetry.status === 'not_configured' && <p className="text-xs text-muted-foreground">Raindrop reporting is not configured for this server.</p>}
            <p className="font-mono text-xs text-muted-foreground">
              {state.result.mode === 'thinking' ? 'Deep' : 'Fast'} search · retrieved in {state.result.latencyMs} ms · Request ID: {state.result.requestId ?? 'none'}
            </p>
            <p className="break-all font-mono text-xs text-muted-foreground">Raindrop event: {state.result.eventId} · {state.result.telemetry.status}</p>
          </div>
        )}
      </div>
    </section>
  );
};
