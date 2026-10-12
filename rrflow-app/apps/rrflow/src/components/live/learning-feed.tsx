'use client';
import { Lightbulb, Wrench } from 'lucide-react';
import type { LearningItem } from '@/lib/mesh-contracts';
import { timeAgo } from './format';

const KIND_LABEL: Record<string, string> = { quirk: 'Tool quirk', practice: 'Best practice', decision: 'Decision', lesson: 'Lesson' };
const AGENT_LABEL: Record<string, string> = { claude: 'Claude', codex: 'Codex', jesse: 'Jesse' };

export const LearningFeed = ({ items, now, error, requestId }: { items: LearningItem[]; now: number; error?: string; requestId?: string | null }) => (
  <section aria-labelledby="learning-heading" className="min-w-0 rounded-lg border border-border bg-card p-4">
    <h2 id="learning-heading" className="text-lg font-semibold">Lessons recorded while building RRFLOW</h2>
    <p className="text-sm text-muted-foreground">
      Team notes and evidence saved in the practices brain for future work.
    </p>
    {error ? <p role="alert" className="mt-4 rounded-md border border-border p-4 text-sm">{error}</p> : items.length === 0 ? (
      <p className="mt-4 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        No lessons recorded yet. They appear here as the team works.
      </p>
    ) : (
      <ol className="mt-4 space-y-3">
        {items.slice(0, 12).map(item => {
          const Icon = item.kind === 'quirk' ? Wrench : Lightbulb;
          return (
            <li key={item.id} className="rounded-md border border-border p-3">
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {KIND_LABEL[item.kind] ?? item.kind}
                    {item.tool && ` · ${item.tool.replace(/_/g, ' ')}`}
                    {item.agent && ` · recorded by ${AGENT_LABEL[item.agent] ?? item.agent}`}
                    {` · ${timeAgo(item.at, now)}`}
                  </p>
                  {item.evidence && (
                    <details className="mt-1 text-xs text-muted-foreground">
                      <summary className="cursor-pointer select-none">Evidence</summary>
                      <p className="mt-1 break-words font-mono">{item.evidence}</p>
                    </details>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    )}
    {requestId && <p className="mt-3 break-all font-mono text-xs text-muted-foreground">Memory request ID: {requestId}</p>}
  </section>
);
