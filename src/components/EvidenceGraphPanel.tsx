"use client";

import { useState } from "react";
import EvidenceGraphView from "./EvidenceGraphView";

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

export default function EvidenceGraphPanel({
  matterId,
  hasMatrix,
}: {
  matterId: string;
  hasMatrix: boolean;
}) {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVisualize() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/evidence-graph`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to build graph");
      setGraph(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!hasMatrix) return null;

  return (
    <div className="surface-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Evidence graph</h2>
        <button onClick={handleVisualize} disabled={loading} className="btn-secondary px-3 py-1.5 text-sm">
          {loading ? "Building…" : graph ? "Rebuild graph" : "Visualize"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {graph && <EvidenceGraphView graph={graph} />}
    </div>
  );
}
