'use client';
import { useRef } from 'react';
import { CircleCheck, CircleX } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ServiceReceipt } from '@/lib/mesh-contracts';
import { useActivity, type ActivityEntry } from './activity-provider';

const ReceiptRow = ({ receipt }: { receipt: ServiceReceipt }) => (
  <li className="rounded-md border border-border p-2 text-xs">
    <div className="flex items-start gap-2">
      {receipt.outcome === 'ok'
        ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-label="Succeeded" />
        : <CircleX className="mt-0.5 size-4 shrink-0 text-rose-700 dark:text-rose-400" aria-label="Failed" />}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{receipt.action}</p>
        <p className="mt-0.5 break-all font-mono text-muted-foreground">
          {receipt.service} · {receipt.method} {receipt.endpoint}{receipt.database ? ` · ${receipt.database}` : ''}
        </p>
        <p className="font-mono text-muted-foreground">
          {receipt.httpStatus === null ? 'no response' : `HTTP ${receipt.httpStatus}`}
          {receipt.latencyMs === null ? '' : ` · ${receipt.latencyMs} ms`}
          {` · ${new Date(receipt.at).toLocaleTimeString()}`}
        </p>
        <p className="break-all font-mono text-muted-foreground">Request ID {receipt.requestId ?? 'not returned'}</p>
        {receipt.error && <p className="mt-0.5 text-rose-700 dark:text-rose-400">{receipt.error}</p>}
      </div>
    </div>
  </li>
);

const EntryBlock = ({ entry }: { entry: ActivityEntry }) => (
  <section className="rounded-lg border border-border p-3" aria-label={entry.title}>
    <div className="flex items-start justify-between gap-2">
      <p className="font-medium">{entry.title}</p>
      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs', entry.outcome === 'ok' ? 'bg-emerald-400/10 text-emerald-700 dark:text-emerald-400' : 'bg-rose-400/10 text-rose-700 dark:text-rose-400')}>
        {entry.outcome === 'ok' ? 'Succeeded' : 'Had a failure'}
      </span>
    </div>
    <p className="text-xs text-muted-foreground">
      {new Date(entry.at).toLocaleTimeString()} · {entry.receipts.length === 0 ? 'no outside calls' : `${entry.receipts.length} real call${entry.receipts.length === 1 ? '' : 's'}`}
    </p>
    {entry.receipts.length > 0 && <ol className="mt-2 space-y-1.5">{entry.receipts.map((receipt, index) => <ReceiptRow key={index} receipt={receipt} />)}</ol>}
  </section>
);

/** Every call RRFLOW made to HydraDB or Raindrop in this browser session, newest first. */
export const ActivityPanel = () => {
  const { entries, background, isPanelOpen, setPanelOpen } = useActivity();
  const trigger = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={isPanelOpen} onOpenChange={setPanelOpen}>
      <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-y-auto"
        onOpenAutoFocus={() => { trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>What RRFLOW did</DialogTitle>
          <DialogDescription>
            Each action below lists the real calls it made: which service, which endpoint, the result, and the request ID
            you can look up in that service. Nothing here is simulated.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          {entries.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              No actions yet. Ask a brain or press &ldquo;Verify with HydraDB&rdquo; and each call will appear here.
            </p>
          )}
          {entries.map(entry => <EntryBlock key={entry.id} entry={entry} />)}
          {background && (
            <details className="rounded-lg border border-border p-3 text-sm">
              <summary className="cursor-pointer select-none">
                {background.title} · {new Date(background.at).toLocaleTimeString()} · {background.outcome === 'ok' ? 'all succeeded' : 'had a failure'}
              </summary>
              <ol className="mt-2 space-y-1.5">{background.receipts.map((receipt, index) => <ReceiptRow key={index} receipt={receipt} />)}</ol>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
