'use client';
import { useState, type ComponentProps } from 'react';
import dynamic from 'next/dynamic';
import type { KnowledgeMap } from './knowledge-map';
import styles from '../source-atlas/source-atlas.module.css';

const ContextMap = dynamic(() => import('./knowledge-map').then(module => module.KnowledgeMap), { loading: () => <p role="status">Opening your context…</p> });
const SourceAtlas = dynamic(() => import('../source-atlas/source-atlas').then(module => module.SourceAtlas), { loading: () => <p role="status">Opening your source roadmap…</p> });

export const Connectome = (props: ComponentProps<typeof KnowledgeMap>) => {
  const [view, setView] = useState<'context' | 'atlas'>('context');
  return <><div className={styles.tabs} role="group" aria-label="Connectome views">
    <button aria-pressed={view === 'context'} onClick={() => setView('context')}>Memories & context</button>
    <button aria-pressed={view === 'atlas'} onClick={() => setView('atlas')}>Source Atlas</button>
  </div>{view === 'context' ? <ContextMap {...props} /> : <SourceAtlas onManage={props.onManage} onWork={props.onWork} />}</>;
};
