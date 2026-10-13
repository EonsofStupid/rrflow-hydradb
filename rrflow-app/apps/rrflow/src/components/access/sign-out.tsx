'use client';
import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';

export const SignOut = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <button className="icon-button" aria-label={error ? 'Sign-out failed; retry' : 'Sign out of private workspace'} title={error ? 'Sign-out failed; retry' : 'Private workspace · sign out'} disabled={busy} onClick={() => {
    setBusy(true);
    void fetch('/api/session', { method: 'DELETE' }).then(response => {
      if (!response.ok) throw new Error();
      window.location.assign('/');
    }).catch(() => { setError(true); setBusy(false); });
  }}><LockKeyhole size={17} /></button>;
};
