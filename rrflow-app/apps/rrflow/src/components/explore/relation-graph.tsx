'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export interface GraphEdgeInput {
  source: string;
  relation: string;
  target: string;
  weight?: number | null;
}

interface RelationGraphProps {
  edges: GraphEdgeInput[];
  /** Node to emphasize, e.g. the item being inspected. */
  focus?: string | null;
  height?: number;
  className?: string;
  onSelect?: (node: string) => void;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
}

/**
 * Dependency-free force layout for HydraDB graph slices. A few hundred
 * iterations of repulsion + springs is plenty for the ≤ 80 edges we show;
 * the goal is a legible picture of what the graph lane returned, not a
 * physics toy.
 */
const layout = (
  edges: GraphEdgeInput[],
  width: number,
  height: number,
): Map<string, LayoutNode> => {
  const nodes = new Map<string, LayoutNode>();
  const touch = (id: string) => {
    let node = nodes.get(id);
    if (!node) {
      const angle = nodes.size * 2.399963; // golden angle spiral: deterministic start
      const radius = 12 + 9 * Math.sqrt(nodes.size);
      node = {
        id,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        degree: 0,
      };
      nodes.set(id, node);
    }
    node.degree += 1;
    return node;
  };
  const springs = edges.map((edge) => [touch(edge.source), touch(edge.target)] as const);

  const list = [...nodes.values()];
  const ideal = Math.max(
    60,
    Math.min(140, Math.sqrt((width * height) / Math.max(1, list.length)) * 0.9),
  );
  for (let iteration = 0; iteration < 260; iteration += 1) {
    const cooling = 1 - iteration / 260;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distance = Math.hypot(dx, dy) || 0.01;
        if (distance < 1) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          distance = 1;
        }
        const force = (ideal * ideal) / distance / 40;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    for (const [a, b] of springs) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 0.01;
      const force = ((distance - ideal) / distance) * 0.05;
      a.vx += dx * force;
      a.vy += dy * force;
      b.vx -= dx * force;
      b.vy -= dy * force;
    }
    for (const node of list) {
      // Gentle gravity toward the center keeps disconnected pieces on screen.
      node.vx += (width / 2 - node.x) * 0.004;
      node.vy += (height / 2 - node.y) * 0.004;
      node.x += Math.max(-12, Math.min(12, node.vx * cooling));
      node.y += Math.max(-12, Math.min(12, node.vy * cooling));
      node.vx *= 0.6;
      node.vy *= 0.6;
      node.x = Math.max(24, Math.min(width - 24, node.x));
      node.y = Math.max(20, Math.min(height - 20, node.y));
    }
  }
  return nodes;
};

const WIDTH = 720;

export const RelationGraph = ({
  edges,
  focus = null,
  height = 380,
  className,
  onSelect,
}: RelationGraphProps) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const nodes = useMemo(() => layout(edges.slice(0, 80), WIDTH, height), [edges, height]);

  if (edges.length === 0) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        No graph relations in this result.
      </div>
    );
  }

  const active = hovered ?? focus;
  const isDim = (id: string) => active !== null && active !== id;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className={cn('w-full rounded-md border bg-muted/30', className)}
      role="img"
      aria-label={`Graph with ${nodes.size} entities and ${edges.length} relations`}
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="22"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground/60" />
        </marker>
      </defs>
      {edges.slice(0, 80).map((edge, index) => {
        const a = nodes.get(edge.source);
        const b = nodes.get(edge.target);
        if (!a || !b) return null;
        const highlighted = active !== null && (edge.source === active || edge.target === active);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={`${edge.source}-${edge.relation}-${edge.target}-${index}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              markerEnd="url(#arrow)"
              className={cn(
                'stroke-muted-foreground/40',
                highlighted && 'stroke-primary',
                active !== null && !highlighted && 'stroke-muted-foreground/15',
              )}
              strokeWidth={highlighted ? 2 : 1.2}
            />
            <text
              x={mx}
              y={my - 4}
              textAnchor="middle"
              className={cn(
                'fill-muted-foreground text-[9px]',
                highlighted && 'fill-primary font-medium',
                active !== null && !highlighted && 'opacity-20',
              )}
            >
              {edge.relation}
            </text>
          </g>
        );
      })}
      {[...nodes.values()].map((node) => {
        const radius = 6 + Math.min(10, node.degree * 1.5);
        const isFocus = focus === node.id;
        return (
          <g
            key={node.id}
            transform={`translate(${node.x} ${node.y})`}
            className="cursor-pointer"
            onMouseEnter={() => setHovered(node.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect?.(node.id)}
            tabIndex={0}
            role="button"
            aria-label={node.id}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSelect?.(node.id);
            }}
          >
            <circle
              r={radius}
              className={cn(
                'fill-background stroke-primary transition-opacity',
                isFocus && 'fill-primary',
                isDim(node.id) && 'opacity-30',
              )}
              strokeWidth={isFocus ? 3 : 1.5}
            />
            <text
              y={radius + 11}
              textAnchor="middle"
              className={cn('fill-foreground text-[10px]', isDim(node.id) && 'opacity-30')}
            >
              {node.id.length > 26 ? `${node.id.slice(0, 25)}…` : node.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
