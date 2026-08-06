"use client";

import { useState } from "react";
import type { MatterClassification } from "@/lib/types";

const LABELS: Record<MatterClassification, string> = {
  standard: "Standard",
  privileged: "Privileged",
  "highly-sensitive": "Highly sensitive",
};

export default function ClassificationSuggestionBanner({
  matterId,
  suggestion,
}: {
  matterId: string;
  suggestion: { classification: MatterClassification; reason: string };
}) {
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);
  const [appliedAs, setAppliedAs] = useState<MatterClassification | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  async function handleApply() {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification: suggestion.classification }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to apply");
      }
      setAppliedAs(suggestion.classification);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }

  if (appliedAs) {
    return (
      <p className="mt-2 text-xs text-green-600">Classification set to {LABELS[appliedAs]}.</p>
    );
  }

  return (
    <div className="surface-row mt-2 flex flex-col gap-1 text-xs">
      <p>
        <span className="font-medium">Suggested classification: {LABELS[suggestion.classification]}.</span>{" "}
        {suggestion.reason}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleApply}
          disabled={applying}
          className="text-accent underline decoration-accent/40 disabled:opacity-50"
        >
          {applying ? "Applying…" : "Apply"}
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="text-muted hover:text-foreground">
          Dismiss
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
