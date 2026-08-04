"use client";

import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";

interface GraphNode {
  id: string;
  label: string;
  type: "party" | "allegation" | "evidence" | "gap";
}

interface GraphEdge {
  source: string;
  target: string;
  label: string | null;
}

interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const TYPE_ORDER: GraphNode["type"][] = ["party", "allegation", "evidence", "gap"];
const TYPE_LABELS: Record<GraphNode["type"], string> = {
  party: "Parties",
  allegation: "Allegations",
  evidence: "Evidence",
  gap: "Gaps",
};
const TYPE_COLORS: Record<GraphNode["type"], { bg: string; border: string }> = {
  party: { bg: "#eef2ff", border: "#6366f1" },
  allegation: { bg: "#fef3c7", border: "#d97706" },
  evidence: { bg: "#dcfce7", border: "#16a34a" },
  gap: { bg: "#fee2e2", border: "#dc2626" },
};

const COLUMN_X: Record<GraphNode["type"], number> = {
  party: 0,
  allegation: 340,
  evidence: 680,
  gap: 1020,
};
const ROW_HEIGHT = 90;

export default function EvidenceGraphView({ graph }: { graph: Graph }) {
  const [visibleTypes, setVisibleTypes] = useState<Set<GraphNode["type"]>>(
    new Set(TYPE_ORDER),
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);

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
    const colors = TYPE_COLORS[n.type];
    return {
      id: n.id,
      position: { x: COLUMN_X[n.type], y: col * ROW_HEIGHT },
      data: { label: n.label },
      style: {
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: 8,
        padding: 8,
        fontSize: 12,
        width: 220,
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
      style: { opacity: dimmed ? 0.15 : 0.8 },
      labelStyle: { fontSize: 10 },
    };
  });

  function toggleType(type: GraphNode["type"]) {
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
        {TYPE_ORDER.map((type) => (
          <label key={type} className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={visibleTypes.has(type)}
              onChange={() => toggleType(type)}
            />
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: TYPE_COLORS[type].border }}
            />
            {TYPE_LABELS[type]}
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
        style={{ height: 500 }}
        className="overflow-hidden rounded-lg border border-border bg-white dark:bg-neutral-900"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={(_, node) => setFocusedId((prev) => (prev === node.id ? null : node.id))}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
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
