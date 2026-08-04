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
      // localStorage, not sessionStorage — sessionStorage only carries over
      // to a new tab when it's opened via window.open() (script-initiated);
      // a real <a target="_blank"> link (used below, deliberately, so the
      // popup blocker never intercepts it) is "following a link" per the
      // spec, which does NOT copy sessionStorage. localStorage is shared
      // across tabs of the same origin regardless of how the tab opened.
      window.localStorage.setItem(`evidenceGraph:${matterId}`, JSON.stringify(body));
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
        <div className="flex items-center gap-2">
          {graph && (
            <a
              href={`/evidence-graph/${matterId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary px-3 py-1.5 text-sm"
            >
              Open in new tab
            </a>
          )}
          <button
            type="button"
            onClick={handleVisualize}
            disabled={loading}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            {loading ? "Building…" : graph ? "Rebuild graph" : "Visualize"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {graph && <EvidenceGraphView graph={graph} />}
    </div>
  );
}
