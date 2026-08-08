"use client";

import Link from "next/link";
import { useState } from "react";
import type { SavedReport } from "@/lib/types";

function hrefFor(query: string): string {
  try {
    const filters = JSON.parse(query) as { dateFrom?: string; dateTo?: string; matterType?: string };
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.matterType) params.set("matterType", filters.matterType);
    return `/analytics?${params.toString()}`;
  } catch {
    return "/analytics";
  }
}

export default function SavedReportsPanel({
  initialReports,
  currentQuery,
}: {
  initialReports: SavedReport[];
  currentQuery: string;
}) {
  const [reports, setReports] = useState(initialReports);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alreadySaved = reports.some((r) => r.query === currentQuery);

  async function handleSave() {
    if (!label.trim() || !currentQuery) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), query: currentQuery }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save report");
      setReports((prev) => [body, ...prev]);
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setReports((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/saved-reports/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-2">
      {currentQuery && !alreadySaved && (
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Save this report as…"
            className="surface-input py-1 text-xs"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !label.trim()}
            className="text-xs text-accent underline decoration-accent/40 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save this report"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {reports.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Saved:</span>
          {reports.map((r) => (
            <span key={r.id} className="surface-row flex items-center gap-1 py-1 text-xs">
              <Link href={hrefFor(r.query)} className="hover:text-accent">
                {r.label}
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                aria-label={`Delete saved report "${r.label}"`}
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
