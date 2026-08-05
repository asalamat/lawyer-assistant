"use client";

import { useState } from "react";
import { DEFENCE_GRAPH_TYPES } from "@/lib/graphTypeConfigs";
import GraphView, { type Graph } from "./GraphView";

export default function DefenceGraphPanel({
  matterId,
  hasMemo,
}: {
  matterId: string;
  hasMemo: boolean;
}) {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVisualize() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/defence-graph`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to build graph");
      setGraph(body);
      window.localStorage.setItem(`graphView:${matterId}:defence`, JSON.stringify(body));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!hasMemo) return null;

  return (
    <div className="surface-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Defence graph</h2>
        <div className="flex items-center gap-2">
          {graph && (
            <a
              href={`/graph-view/${matterId}?kind=defence`}
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
      <p className="text-sm text-muted">
        Built from the most recent defence strategy memo: opposing-case weaknesses, defence
        theories, evidentiary/procedural issues, and next steps, with how they connect.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {graph && <GraphView graph={graph} typeConfig={DEFENCE_GRAPH_TYPES} />}
    </div>
  );
}
