'use client';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { toast } from 'sonner';
import type { ServiceReceipt } from '@/lib/mesh-contracts';
import { ActivityPanel } from './activity-panel';

export type ActivityEntry = {
  id: string;
  title: string;
  outcome: 'ok' | 'failed';
  at: string;
  receipts: ServiceReceipt[];
};

type RecordOptions = { notify?: 'success' | 'info' | 'error' | false; summary?: string };

type ActivityContextValue = {
  entries: ActivityEntry[];
  background: ActivityEntry | null;
  isPanelOpen: boolean;
  setPanelOpen: (isOpen: boolean) => void;
  /** Log a person's action with the real calls it made, and tell them what happened. */
  record: (title: string, receipts: ServiceReceipt[], options?: RecordOptions) => void;
  /** Automatic refreshes replace one line instead of flooding the log or the screen. */
  recordBackground: (receipts: ServiceReceipt[]) => void;
};

const MAX_ENTRIES = 100;

/** "HydraDB · POST /query · 341 ms · request cc06272c" — the line that proves a call happened. */
export const describeReceipt = (receipt: ServiceReceipt): string => [
  receipt.service,
  `${receipt.method} ${receipt.endpoint}`,
  receipt.database,
  receipt.httpStatus === null ? 'no response' : `HTTP ${receipt.httpStatus}`,
  receipt.latencyMs === null ? null : `${receipt.latencyMs} ms`,
  receipt.requestId ? `request ${receipt.requestId.slice(0, 8)}` : null,
].filter(Boolean).join(' · ');

const entryFrom = (title: string, receipts: ServiceReceipt[]): ActivityEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title,
  outcome: receipts.some(receipt => receipt.outcome === 'failed') ? 'failed' : 'ok',
  at: new Date().toISOString(),
  receipts,
});

const notify = (kind: Exclude<RecordOptions['notify'], false | undefined>, title: string, description: string, onDetails: () => void) => {
  const options = { description, action: { label: 'Details', onClick: onDetails } };
  if (kind === 'error') toast.error(title, { ...options, duration: 10_000 });
  else if (kind === 'info') toast.info(title, options);
  else toast.success(title, options);
};

/** Without the provider (e.g. an isolated preview) actions still toast; nothing is silently dropped. */
const fallback: ActivityContextValue = {
  entries: [], background: null, isPanelOpen: false, setPanelOpen: () => undefined,
  record: (title, receipts, options) => {
    if (options?.notify === false) return;
    const first = receipts[0];
    notify(options?.notify ?? 'success', title, options?.summary ?? (first ? describeReceipt(first) : 'No outside service was called.'), () => undefined);
  },
  recordBackground: () => undefined,
};

const ActivityContext = createContext<ActivityContextValue>(fallback);

export const useActivity = () => useContext(ActivityContext);

export const ActivityProvider = ({ children }: { children: React.ReactNode }) => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [background, setBackground] = useState<ActivityEntry | null>(null);
  const [isPanelOpen, setPanelOpen] = useState(false);

  const record = useCallback((title: string, receipts: ServiceReceipt[], options?: RecordOptions) => {
    const entry = entryFrom(title, receipts);
    if (options?.notify === 'error') entry.outcome = 'failed';
    setEntries(current => [entry, ...current].slice(0, MAX_ENTRIES));
    if (options?.notify === false) return;
    const kind = options?.notify ?? (entry.outcome === 'failed' ? 'error' : 'success');
    const first = receipts.find(receipt => receipt.outcome === 'failed') ?? receipts[0];
    notify(kind, title, options?.summary ?? (first ? describeReceipt(first) : 'No outside service was called.'), () => setPanelOpen(true));
  }, []);

  const recordBackground = useCallback((receipts: ServiceReceipt[]) => {
    setBackground(entryFrom(`Automatic refresh: ${receipts.length} HydraDB calls`, receipts));
  }, []);

  const value = useMemo(
    () => ({ entries, background, isPanelOpen, setPanelOpen, record, recordBackground }),
    [entries, background, isPanelOpen, record, recordBackground],
  );

  return (
    <ActivityContext.Provider value={value}>
      {children}
      <button type="button" onClick={() => setPanelOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-lg hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring">
        <History className="size-4" aria-hidden />
        What RRFLOW did
        <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{entries.length}</span>
      </button>
      <ActivityPanel />
    </ActivityContext.Provider>
  );
};
