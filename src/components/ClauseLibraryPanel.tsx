"use client";

import { useState } from "react";
import type { ClauseLibraryEntry } from "@/lib/types";

export default function ClauseLibraryPanel({
  initialEntries,
}: {
  initialEntries: ClauseLibraryEntry[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [clauseType, setClauseType] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [fallbackLanguage, setFallbackLanguage] = useState("");
  const [unacceptableLanguage, setUnacceptableLanguage] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/clause-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauseType,
          preferredLanguage,
          fallbackLanguage: fallbackLanguage || null,
          unacceptableLanguage: unacceptableLanguage || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add clause");
      setEntries((prev) => [...prev, body].sort((a, b) => a.clauseType.localeCompare(b.clauseType)));
      setClauseType("");
      setPreferredLanguage("");
      setFallbackLanguage("");
      setUnacceptableLanguage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/settings/clause-library/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="surface-card flex flex-col gap-3">
        <input
          required
          value={clauseType}
          onChange={(e) => setClauseType(e.target.value)}
          placeholder="Clause type (e.g. Limitation of liability)"
          className="surface-input"
        />
        <textarea
          required
          value={preferredLanguage}
          onChange={(e) => setPreferredLanguage(e.target.value)}
          placeholder="Preferred language — what this firm wants the clause to say"
          rows={3}
          className="surface-input"
        />
        <textarea
          value={fallbackLanguage}
          onChange={(e) => setFallbackLanguage(e.target.value)}
          placeholder="Fallback language (optional) — acceptable if the preferred version is rejected"
          rows={2}
          className="surface-input"
        />
        <textarea
          value={unacceptableLanguage}
          onChange={(e) => setUnacceptableLanguage(e.target.value)}
          placeholder="Unacceptable language (optional) — a real problem if the contract has this"
          rows={2}
          className="surface-input"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={creating} className="btn-primary self-start">
          {creating ? "…" : "Save clause"}
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-muted">No clause library entries yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="surface-row flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{entry.clauseType}</span>
                <button onClick={() => handleDelete(entry.id)} className="text-xs text-muted hover:text-red-600">
                  Remove
                </button>
              </div>
              <p className="text-muted">
                <span className="font-medium text-foreground">Preferred:</span> {entry.preferredLanguage}
              </p>
              {entry.fallbackLanguage && (
                <p className="text-muted">
                  <span className="font-medium text-foreground">Fallback:</span> {entry.fallbackLanguage}
                </p>
              )}
              {entry.unacceptableLanguage && (
                <p className="text-muted">
                  <span className="font-medium text-foreground">Unacceptable:</span> {entry.unacceptableLanguage}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
