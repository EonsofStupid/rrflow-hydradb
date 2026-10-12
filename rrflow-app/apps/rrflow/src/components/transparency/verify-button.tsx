'use client';
import { useState } from 'react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { meshCatalog, type VerifyResult } from '@/lib/mesh-contracts';
import { useActivity } from './activity-provider';

/**
 * The clear proof button: makes fresh HydraDB calls right now and shows every one,
 * so anyone can see the integration is real rather than take the screen's word for it.
 */
export const VerifyHydraButton = () => {
  const { record, setPanelOpen } = useActivity();
  const [isChecking, setIsChecking] = useState(false);

  const handleVerify = async () => {
    setIsChecking(true);
    const pending = toast.loading('Checking HydraDB live…', { description: 'Listing databases and asking each brain for its status.' });
    try {
      const response = await fetch('/api/mesh/verify', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'The check could not run.');
      const result = body as VerifyResult;
      const ready = result.brains.filter(brain => brain.isListed && brain.isReady).length;
      const missing = result.brains.filter(brain => !brain.isListed).map(brain => meshCatalog[brain.id].name);
      const title = result.isHealthy
        ? `HydraDB verified: ${ready} of ${result.brains.length} brains found and ready`
        : `HydraDB check found problems: ${ready} of ${result.brains.length} brains ready`;
      toast.dismiss(pending);
      record(title, result.receipts, {
        notify: result.isHealthy ? 'success' : 'error',
        summary: `${result.receipts.length} live calls just now · ${result.databases.length} databases visible to this key${missing.length ? ` · missing: ${missing.join(', ')}` : ''}`,
      });
      setPanelOpen(true);
    } catch (error) {
      toast.dismiss(pending);
      record('HydraDB check could not run', [], {
        notify: 'error',
        summary: error instanceof Error ? error.message : 'RRFLOW could not reach its server.',
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <button type="button" onClick={() => void handleVerify()} disabled={isChecking}
      className="inline-flex items-center gap-2 rounded-md border border-emerald-400/60 bg-emerald-400/10 px-3 py-1.5 text-sm font-medium hover:bg-emerald-400/20 disabled:opacity-60">
      {isChecking ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4 text-emerald-400" aria-hidden />}
      Verify with HydraDB
    </button>
  );
};
