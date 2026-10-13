'use client';
import { useEffect, useState } from 'react';
import type { SessionStatus } from '@/lib/access';

export const useEventAccess = () => {
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const read = async () => {
      try {
        const response = await fetch('/api/session', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Access status could not be checked. Refresh to retry.');
        const value = await response.json();
        if (!controller.signal.aborted) { setSession(value); setError(''); setNow(Date.now()); }
      } catch (reason) {
        if (!controller.signal.aborted) { setSession(null); setError(reason instanceof Error ? reason.message : 'Access is unavailable.'); }
      }
    };
    void read();
    const refresh = setInterval(() => { if (!document.hidden) void read(); }, 60_000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { controller.abort(); clearInterval(refresh); clearInterval(clock); };
  }, []);
  const cutoff = session?.demo?.expiresAt ? Date.parse(session.demo.expiresAt) : null;
  const publicOpen = !!session?.demo?.open && (cutoff === null || now < cutoff);
  const remaining = cutoff === null ? null : Math.max(0, Math.ceil((cutoff - now) / 60_000));
  return { session, error, publicOpen, canExplore: !!session?.authenticated || publicOpen, deadline: session?.demo?.expiresAt ?? null, remaining };
};

export const remainingTime = (minutes: number | null) => minutes === null ? '' : `${Math.floor(minutes / 60)}h ${minutes % 60}m remaining`;
