"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { CONNECTIONS_GRAPH_TYPES } from "@/lib/graphTypeConfigs";
import type { Graph } from "./GraphView";

// React Flow (@xyflow/react) is a large dependency that this panel only
// ever needs after the user clicks "Visualize" — dynamically importing it
// keeps its JS and CSS out of this page's initial bundle for the (common)
// case where no graph has been built yet.
const GraphView = dynamic(() => import("./GraphView"), { ssr: false });

export default function EvidenceConnectionsPanel({
  matterId,
  hasDocuments,
}: {
  matterId: string;
  hasDocuments: boolean;
}) {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVisualize() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/evidence-connections`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to build graph");
      setGraph(body);
      window.localStorage.setItem(`graphView:${matterId}:connections`, JSON.stringify(body));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!hasDocuments) return null;

  return (
    <div className="surface-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Evidence connections</h2>
        <div className="flex items-center gap-2">
          {graph && (
            <a
              href={`/graph-view/${matterId}?kind=connections`}
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
        Analyzes the matter&apos;s documents directly to show which piece of evidence corroborates,
        contradicts, or is missing for each allegation — including photo descriptions, not just text.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {graph && <GraphView graph={graph} typeConfig={CONNECTIONS_GRAPH_TYPES} />}
    </div>
  );
}
