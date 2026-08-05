"use client";

import Link from "next/link";
import { useState } from "react";
import type { SavedSearch } from "@/lib/types";

export default function SavedSearchesPanel({
  initialSearches,
  currentQuery,
}: {
  initialSearches: SavedSearch[];
  currentQuery: string;
}) {
  const [searches, setSearches] = useState(initialSearches);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alreadySaved = searches.some((s) => s.query === currentQuery);

  async function handleSave() {
    if (!label.trim() || !currentQuery) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), query: currentQuery }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save search");
      setSearches((prev) => [body, ...prev]);
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSearches((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/saved-searches/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-2">
      {currentQuery && !alreadySaved && (
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`Save "${currentQuery}" as…`}
            className="surface-input py-1 text-xs"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !label.trim()}
            className="text-xs text-accent underline decoration-accent/40 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save this search"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {searches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Saved:</span>
          {searches.map((s) => (
            <span key={s.id} className="surface-row flex items-center gap-1 py-1 text-xs">
              <Link href={`/search?q=${encodeURIComponent(s.query)}`} className="hover:text-accent">
                {s.label}
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(s.id)}
                aria-label={`Delete saved search "${s.label}"`}
                className="text-muted hover:text-red-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
