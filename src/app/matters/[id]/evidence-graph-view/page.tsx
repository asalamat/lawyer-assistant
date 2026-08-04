"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import EvidenceGraphView from "@/components/EvidenceGraphView";

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

export default function EvidenceGraphFullscreenPage() {
  const { id } = useParams<{ id: string }>();
  const [graph, setGraph] = useState<Graph | null | "missing">(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      const raw = window.sessionStorage.getItem(`evidenceGraph:${id}`);
      setGraph(raw ? JSON.parse(raw) : "missing");
    });
  }, [id]);

  if (graph === null) return null;

  if (graph === "missing") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted">
          No graph data found in this tab. Generate the graph from the matter&apos;s Evidence
          matrix page first, then use &quot;Open in new tab&quot; again.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col gap-3 px-4 py-6">
      <h1 className="font-display text-2xl italic">Evidence graph</h1>
      <div className="flex-1">
        <EvidenceGraphView graph={graph} height="calc(100vh - 160px)" />
      </div>
    </main>
  );
}
