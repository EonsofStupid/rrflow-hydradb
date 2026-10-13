'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, useNodesState, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CircleDot, Network, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import '@xyflow/react/dist/style.css';
import styles from './relation-graph.module.css';

export interface GraphEdgeInput { source: string; relation: string; target: string; weight?: number | null }
interface RelationGraphProps { edges: GraphEdgeInput[]; focus?: string | null; height?: number; className?: string; onSelect?: (node: string) => void }
type EntityNode = Node<{ label: string; degree: number; active: boolean; connected: boolean; inspect: (name: string) => void }, 'entity'>;
type Selection = { kind: 'node'; name: string } | { kind: 'edge'; index: number } | null;

const Entity = ({ data }: NodeProps<EntityNode>) => <div className={cn(styles.entity, data.active && styles.active, data.connected && styles.connected)}>
  <Handle type="target" position={Position.Left} isConnectable={false} className={styles.handle} />
  <button type="button" className="nodrag nopan" onClick={() => data.inspect(data.label)} aria-label={`Inspect ${data.label}`} aria-pressed={data.active}>
    <span className={styles.nodeMark} aria-hidden><CircleDot size={18} /></span>
    <span className={styles.nodeText}><strong title={data.label}>{data.label}</strong><small>{data.degree} {data.degree === 1 ? 'connection' : 'connections'}</small></span>
  </button>
  <Handle type="source" position={Position.Right} isConnectable={false} className={styles.handle} />
</div>;
const nodeTypes = { entity: Entity };
const caption = (value: string) => value.replaceAll('_', ' ');

export const RelationGraph = ({ edges, focus = null, height = 380, className, onSelect }: RelationGraphProps) => {
  const [selection, setSelection] = useState<Selection>(null);
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const instructionsId = useId();
  const graphId = useId();
  const visible = useMemo(() => edges.slice(0, 80), [edges]);
  const entities = useMemo(() => {
    const degrees = new Map<string, number>();
    for (const edge of visible) {
      degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
      if (edge.target !== edge.source) degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
    }
    return [...degrees].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [visible]);
  const selectedEdge = selection?.kind === 'edge' ? visible[selection.index] : null;
  const selectedName = selection?.kind === 'node' ? selection.name : focus;
  const activeName = entities.some(([name]) => name === selectedName) ? selectedName : null;
  const connections = useMemo(() => activeName ? visible.filter(edge => edge.source === activeName || edge.target === activeName) : [], [activeName, visible]);
  const neighbors = useMemo(() => new Set(connections.flatMap(edge => [edge.source, edge.target])), [connections]);
  const inspect = useCallback((name: string) => { setSelection({ kind: 'node', name }); onSelect?.(name); }, [onSelect]);
  const columns = Math.max(2, Math.ceil(Math.sqrt(entities.length)));
  const desiredNodes = useMemo<EntityNode[]>(() => entities.map(([name, degree], index) => ({
    id: name, type: 'entity', width: 170, height: 70, position: { x: (index % columns) * 235, y: Math.floor(index / columns) * 145 },
    data: { label: name, degree, active: name === activeName || !!selectedEdge && [selectedEdge.source, selectedEdge.target].includes(name), connected: neighbors.has(name), inspect },
    draggable: false, selectable: false, focusable: false, style: { pointerEvents: 'all' },
  })), [entities, columns, activeName, selectedEdge, neighbors, inspect]);
  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNode>(desiredNodes);
  useEffect(() => {
    // React Flow reports measured dimensions through onNodesChange. Keep them
    // when updating display data so refreshed nodes retain their handle bounds.
    setNodes(current => {
      const previous = new Map(current.map(node => [node.id, node]));
      return desiredNodes.map(node => ({ ...node, measured: previous.get(node.id)?.measured }));
    });
  }, [desiredNodes, setNodes]);
  const flowEdges = useMemo<Edge[]>(() => visible.map((edge, index) => ({
    id: `relation-${index}`, source: edge.source, target: edge.target, type: 'default', label: caption(edge.relation),
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)', width: 16, height: 16 },
    className: cn(styles.edge, (selection?.kind === 'edge' && selection.index === index || activeName && [edge.source, edge.target].includes(activeName)) && styles.activeEdge),
    labelStyle: { fill: 'var(--text)', fontSize: 11, fontWeight: 500 }, labelBgStyle: { fill: 'rgb(var(--card-rgb))', fillOpacity: 0.96 }, labelBgPadding: [7, 4], labelBgBorderRadius: 5,
    interactionWidth: 24, reconnectable: false, deletable: false, focusable: true, ariaRole: 'button', ariaLabel: `Inspect relationship: ${edge.source} ${caption(edge.relation)} ${edge.target}`,
    domAttributes: { onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelection({ kind: 'edge', index }); } } },
  })), [visible, selection, activeName]);

  if (!visible.length) return <div className={cn(styles.empty, className)}><Network size={24} aria-hidden /><strong>No relationships returned yet</strong><p>This graph will show connections when they are available in the selected result.</p></div>;

  return <section className={cn(styles.root, className)} aria-label="Knowledge relationship graph">
    <header className={styles.header}><span><Network size={15} aria-hidden />{entities.length} entities <span aria-hidden>·</span> {visible.length} relationships</span><small>{edges.length > 80 ? `Showing the first 80 of ${edges.length} returned relationships` : 'From this result'}</small></header>
    <div className={styles.canvas} style={{ height: Math.max(280, height) }} aria-describedby={instructionsId}>
      <ReactFlow id={graphId} nodes={nodes} onNodesChange={onNodesChange} edges={flowEdges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.18, maxZoom: 1.05 }} minZoom={0.2} maxZoom={2.5}
        colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'} nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable deleteKeyCode={null} edgesReconnectable={false}
        onEdgeClick={(_, edge) => setSelection({ kind: 'edge', index: Number(edge.id.slice('relation-'.length)) })}
        onPaneClick={() => setSelection(null)} zoomOnScroll={false} panOnScroll={false} zoomOnPinch panOnDrag preventScrolling={false}
        ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': 'Zoom into relationships', 'controls.zoomOut.ariaLabel': 'Zoom out of relationships', 'controls.fitView.ariaLabel': 'Fit all relationships', 'minimap.ariaLabel': 'Relationship overview' }}>
        <Background gap={22} size={1} color="var(--line)" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap position="bottom-right" className={styles.minimap} nodeColor="var(--accent)" maskColor="rgb(var(--background-rgb) / 0.65)" pannable zoomable />
      </ReactFlow>
    </div>
    <p id={instructionsId} className={styles.help}>Drag the canvas to explore. Use + / − to zoom. Select an entity or a connection to inspect it; Tab and Enter work too.</p>
    <AnimatePresence mode="wait" initial={false}>
      {(selectedEdge || selection?.kind === 'node' && activeName) && <motion.div key={selectedEdge ? `edge-${selection?.kind === 'edge' ? selection.index : ''}` : activeName} className={styles.detail} role="region" aria-label="Selected graph details"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.16 }}>
        <button type="button" className={styles.close} aria-label="Close graph details" onClick={() => setSelection(null)}><X size={15} /></button>
        {selectedEdge ? <><span className={styles.eyebrow}>Recorded relationship</span><div className={styles.relationship}><button onClick={() => inspect(selectedEdge.source)}>{selectedEdge.source}</button><span><ArrowRight size={14} aria-hidden />{caption(selectedEdge.relation)}<ArrowRight size={14} aria-hidden /></span><button onClick={() => inspect(selectedEdge.target)}>{selectedEdge.target}</button></div><p>Direction: {selectedEdge.source} → {selectedEdge.target}{typeof selectedEdge.weight === 'number' && Number.isFinite(selectedEdge.weight) ? ` · Returned weight: ${selectedEdge.weight}` : ''}</p></> : <><span className={styles.eyebrow}>Selected entity</span><strong className={styles.detailTitle}>{activeName}</strong><p>{connections.length} recorded {connections.length === 1 ? 'relationship' : 'relationships'} in this view. Follow a connection to inspect its direction.</p><div className={styles.connectionList}>{connections.map((edge, index) => <button key={`${edge.source}-${edge.target}-${index}`} onClick={() => setSelection({ kind: 'edge', index: visible.indexOf(edge) })}><span>{edge.source}</span><span className={styles.predicate}>{caption(edge.relation)} →</span><span>{edge.target}</span></button>)}</div></>}
      </motion.div>}
    </AnimatePresence>
  </section>;
};
