"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import GraphView, { type Graph } from "@/components/GraphView";
import { GRAPH_TYPE_CONFIGS, type GraphKind } from "@/lib/graphTypeConfigs";

// Deliberately outside src/app/matters/[id]/ — that segment's layout adds
// the matter header/tabs, and the root layout adds the app-wide sidebar +
// top bar (see ConditionalNav.tsx/TopUtilityBar.tsx, which both hide
// themselves specifically for this route) — the point of "open in new tab"
// is a distraction-free, graph-only view, not the full app chrome around
// it. Generic across every graph kind (evidence, defence, ...) — see
// graphTypeConfigs.ts — rather than one route per kind.
export default function GraphFullscreenPage() {
  return (
    <Suspense>
      <GraphFullscreenContent />
    </Suspense>
  );
}

function GraphFullscreenContent() {
  const { id } = useParams<{ id: string }>();
  const kind = (useSearchParams().get("kind") ?? "evidence") as GraphKind;
  const [graph, setGraph] = useState<Graph | null | "missing">(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      const raw = window.localStorage.getItem(`graphView:${id}:${kind}`);
      setGraph(raw ? JSON.parse(raw) : "missing");
    });
  }, [id, kind]);

  if (graph === null) return null;

  const typeConfig = GRAPH_TYPE_CONFIGS[kind] ?? GRAPH_TYPE_CONFIGS.evidence;
  const title = kind === "defence" ? "Defence graph" : "Evidence graph";

  if (graph === "missing") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted">
          No graph data found in this tab. Generate the graph from the matter&apos;s page first,
          then use &quot;Open in new tab&quot; again.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col gap-3 px-4 py-6">
      <h1 className="font-display text-2xl italic">{title}</h1>
      <div className="flex-1">
        <GraphView graph={graph} typeConfig={typeConfig} height="calc(100vh - 100px)" />
      </div>
    </main>
  );
}
