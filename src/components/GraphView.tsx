"use client";

import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import type { GraphTypeConfig } from "@/lib/graphTypeConfigs";

function useIsDarkMode(): boolean {
  const [isDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  return isDark;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string | null;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const ROW_HEIGHT = 90;

// Generic node-graph renderer shared by every graph visualization in the
// app (evidence graph, defence graph, and any future one) — the only
// thing that varies between them is which node types exist and how
// they're labeled/colored/columned, captured in typeConfig
// (src/lib/graphTypeConfigs.ts). The layout/interaction logic (focus,
// filtering, dark mode) is identical regardless of what the graph
// represents.
export default function GraphView({
  graph,
  typeConfig,
  height = 500,
}: {
  graph: Graph;
  typeConfig: GraphTypeConfig;
  height?: number | string;
}) {
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(typeConfig.order));
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const isDark = useIsDarkMode();

  const filteredNodes = graph.nodes.filter((n) => visibleTypes.has(n.type));
  const filteredIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = graph.edges.filter(
    (e) => filteredIds.has(e.source) && filteredIds.has(e.target),
  );

  const connectedIds = useMemo(() => {
    if (!focusedId) return null;
    const ids = new Set([focusedId]);
    for (const edge of filteredEdges) {
      if (edge.source === focusedId) ids.add(edge.target);
      if (edge.target === focusedId) ids.add(edge.source);
    }
    return ids;
  }, [focusedId, filteredEdges]);

  const columnCounts: Record<string, number> = {};
  const nodes: Node[] = filteredNodes.map((n) => {
    const col = columnCounts[n.type] ?? 0;
    columnCounts[n.type] = col + 1;
    const dimmed = connectedIds ? !connectedIds.has(n.id) : false;
    const colors = typeConfig.colors[n.type] ?? { bg: "#e5e5e5", border: "#737373" };
    return {
      id: n.id,
      position: { x: typeConfig.columnX[n.type] ?? 0, y: col * ROW_HEIGHT },
      data: { label: n.label },
      style: {
        background: colors.bg,
        color: "#1c1917",
        border: `2px solid ${colors.border}`,
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.35,
        width: 240,
        opacity: dimmed ? 0.25 : 1,
      },
    };
  });

  const edges: Edge[] = filteredEdges.map((e, i) => {
    const dimmed = connectedIds ? !(connectedIds.has(e.source) && connectedIds.has(e.target)) : false;
    return {
      id: `e${i}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: e.label ?? undefined,
      animated: false,
      style: { opacity: dimmed ? 0.15 : 0.8, strokeWidth: 1.5 },
      labelStyle: { fontSize: 12, fontWeight: 500, fill: "#1c1917" },
      labelBgStyle: { fill: "#ffffff", fillOpacity: 0.85 },
      labelBgPadding: [4, 2],
    };
  });

  function toggleType(type: string) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {typeConfig.order.map((type) => (
          <label key={type} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={visibleTypes.has(type)}
              onChange={() => toggleType(type)}
            />
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: typeConfig.colors[type]?.border }}
            />
            {typeConfig.labels[type] ?? type}
          </label>
        ))}
        {focusedId && (
          <button
            onClick={() => setFocusedId(null)}
            className="text-xs text-accent underline decoration-accent/40"
          >
            Clear focus
          </button>
        )}
      </div>
      <div
        style={{ height }}
        className="overflow-hidden rounded-lg border border-border bg-white dark:bg-neutral-900"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={(_, node) => setFocusedId((prev) => (prev === node.id ? null : node.id))}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color={isDark ? "#525252" : "#d4d4d4"} />
          <Controls />
        </ReactFlow>
      </div>
      <p className="text-xs text-muted">
        Click a node to highlight only its direct connections. Toggle the checkboxes above to
        narrow down by type.
      </p>
    </div>
  );
}
