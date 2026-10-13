'use client';
import { useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, Fingerprint, LockKeyhole, ShieldCheck, Sparkles, Split } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEventAccess, remainingTime } from './event-access';
import styles from './workspace-entry.module.css';

const Dashboard = dynamic(() => import('@/components/dashboard').then(module => module.Dashboard));
export const WorkspaceEntry = () => {
  const { session, error: accessError, publicOpen, canExplore, deadline, remaining } = useEventAccess();
  const [login, setLogin] = useState(false);
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const signIn = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); const result = await response.json(); if (!response.ok || !result.authenticated) throw new Error(result.error || 'The password was not accepted.'); setPassword(''); window.location.assign('/workspace'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Sign-in failed.'); setBusy(false); }
  };
  if (session?.local) return <Dashboard />;
  return <main className={styles.root}>
    <header className={styles.header}><Link href="/" className={styles.brand}><Split size={24} /> rrflow<span>.</span></Link><span><ShieldCheck size={14} /> Personal & work, with clear boundaries</span></header>
    <section className={styles.hero}><span className="eyebrow accent"><Fingerprint size={15} /> CONTEXT THAT KNOWS ITS PLACE</span><h1>One life.<br /><span>Room for every part of it.</span></h1><p>Your ambitions, projects, and hard-earned lessons belong together—with a clear boundary between personal life and Shippin work.</p><div className={styles.orbit} aria-hidden><span><Fingerprint />Personal</span><i /><strong><Split />RRFLOW</strong><i /><span><Sparkles />Shippin</span></div></section>
    <div className={styles.choices}><section><span className={styles.icon}><Sparkles /></span><span className="eyebrow accent">ONE CLICK TO EXPLORE</span><h2>See the idea in action.</h2><p>Explore a curated workspace: illustrative life context, public project sources, and a real failure-to-lesson trail read from HydraDB.</p><p className={styles.eventStatus}>{publicOpen ? `Public demo event · ${remainingTime(remaining)}` : session ? 'The public event is closed. Sign in to explore.' : 'Checking the event window…'}{deadline && <small>Public access ends <time dateTime={deadline}>{new Date(deadline).toLocaleString()}</time></small>}</p>{canExplore ? <Link className={styles.primary} href="/demo">Explore the demo <ArrowRight size={17} /></Link> : <Button onClick={() => setLogin(true)} disabled={!session}>Sign in to explore <LockKeyhole size={15} /></Button>}<small>{publicOpen ? 'Guided walkthrough · no password during the event' : 'Access requires your workspace password'}</small></section><section><span className={styles.icon}><LockKeyhole /></span><span className="eyebrow accent">YOUR PRIVATE WORKSPACE</span><h2>The real work lives here.</h2><p>Open your connected Personal and Shippin brains, review placements, inspect sources, and manage the lessons that guide your next decision.</p>{session?.authenticated ? <Link className={styles.primary} href="/workspace">Open my workspace <ArrowRight size={17} /></Link> : <Button className="primary-button" onClick={() => { setError(''); setLogin(true); }} disabled={!session}>Unlock my workspace <LockKeyhole size={15} /></Button>}<small>{session?.authenticated ? 'Your protected session is active' : 'Password-protected · real connected data'}</small></section></div>
    {(error || accessError) && !login && <p role="alert" className={styles.error}>{error || accessError}</p>}
    <footer>Built with Digo app-starter · Knowledge in HydraDB · Feedback through Raindrop</footer>
    <Dialog open={login} onOpenChange={value => { if (!busy) { setLogin(value); setPassword(''); } }}><DialogContent><DialogHeader><DialogTitle>Open your private workspace</DialogTitle><DialogDescription>Enter the temporary workspace password. Your session lasts up to eight hours.</DialogDescription></DialogHeader><form className={styles.form} onSubmit={signIn}><label>Workspace password<input autoFocus autoComplete="current-password" type="password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} /></label>{!session?.configured && <p role="alert">Private workspace access is not configured on this deployment yet. The curated demo is still available.</p>}{error && <p role="alert">{error}</p>}<Button type="submit" disabled={busy || !session?.configured}>{busy ? 'Checking access…' : 'Unlock workspace'}<ArrowRight size={16} /></Button></form></DialogContent></Dialog>
  </main>;
};
