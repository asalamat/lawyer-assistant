"use client";

import { useState } from "react";
import type { MatterDigest } from "@/lib/types";

export default function MatterDigestPanel({
  matterId,
  initialDigest,
}: {
  matterId: string;
  initialDigest: MatterDigest | null;
}) {
  const [digest, setDigest] = useState(initialDigest);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/digest`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate digest");
      setDigest(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Matter digest</h2>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
        >
          {generating ? "Generating…" : digest ? "Regenerate" : "Generate summary"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {digest ? (
        <div className="whitespace-pre-wrap text-sm">{digest.content}</div>
      ) : (
        <p className="text-sm text-zinc-500">
          No digest generated yet. Upload documents, then generate a summary.
        </p>
      )}
    </div>
  );
}
