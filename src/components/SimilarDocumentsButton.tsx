"use client";

import { useState } from "react";

interface SimilarDocument {
  id: string;
  kind: "document" | "reference";
  fileName: string;
  score: number;
}

export default function SimilarDocumentsButton({
  matterId,
  documentId,
}: {
  matterId: string;
  documentId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SimilarDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    if (results || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/documents/${documentId}/similar`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to find similar documents");
      setResults(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={handleOpen} className="text-xs text-accent underline decoration-accent/40">
        Similar
      </button>
    );
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-muted underline decoration-muted/40"
      >
        Hide
      </button>
      <div className="surface-card absolute right-0 z-10 mt-1 w-64 text-left">
        <p className="mb-1 text-xs font-medium text-muted">Similar documents</p>
        {loading && <p className="text-xs text-muted">Comparing…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {results && results.length === 0 && (
          <p className="text-xs text-muted">No other readable documents to compare against yet.</p>
        )}
        {results && results.length > 0 && (
          <ul className="flex flex-col gap-1">
            {results.map((r) => (
              <li key={`${r.kind}:${r.id}`} className="flex items-center justify-between text-xs">
                <span className="truncate">
                  {r.fileName}
                  {r.kind === "reference" && <span className="ml-1 text-muted">(reference library)</span>}
                </span>
                <span className="ml-2 shrink-0 text-muted">{Math.round(r.score * 100)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </span>
  );
}
