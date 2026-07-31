"use client";

import { useState } from "react";
import { formatDateOnly } from "@/lib/formatDate";
import type { MatterDeadline } from "@/lib/types";

export default function DeadlinesPanel({
  matterId,
  initialDeadlines,
}: {
  matterId: string;
  initialDeadlines: MatterDeadline[];
}) {
  const [deadlines, setDeadlines] = useState(initialDeadlines);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/deadlines`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to extract deadlines");
      setDeadlines(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Deadlines &amp; important dates</h2>
        <button onClick={handleExtract} disabled={generating} className="btn-primary px-3 py-1.5">
          {generating ? "Extracting…" : deadlines.length > 0 ? "Re-extract" : "Extract deadlines"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {deadlines.length === 0 ? (
        <p className="text-sm text-muted">
          No deadlines extracted yet. Upload documents, then extract deadlines.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {deadlines.map((deadline) => (
            <li key={deadline.id} className="surface-row flex items-center justify-between text-sm">
              <div>
                <p>{deadline.description}</p>
                {deadline.sourceDocument && (
                  <p className="text-xs text-muted">Source: {deadline.sourceDocument}</p>
                )}
              </div>
              <span className="shrink-0 text-sm font-medium text-accent">
                {deadline.dueDate ? formatDateOnly(deadline.dueDate) : "Date unclear"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
