"use client";

import { useState } from "react";
import type { CaseNoteup } from "@/lib/types";

export default function CaseNoteupPanel({
  matterId,
  initialNoteups,
}: {
  matterId: string;
  initialNoteups: CaseNoteup[];
}) {
  const [noteups, setNoteups] = useState(initialNoteups);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleCheck() {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/case-noteup`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Check failed");
      setNoteups(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg">Case citations</h2>
          <p className="text-sm text-muted">
            Scans this matter&apos;s documents and notes for Canadian case citations (e.g. &quot;2020
            ONCA 123&quot;) and looks each one up on CanLII for its citation history. Only citations
            in the standard neutral-citation format are detected.
          </p>
        </div>
        <button
          onClick={handleCheck}
          disabled={checking}
          className="btn-primary shrink-0 px-3 py-1.5"
        >
          {checking ? "Checking…" : noteups.length > 0 ? "Re-check" : "Check case citations"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {noteups.length === 0 ? (
        <p className="text-sm text-muted">No citations checked yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {noteups.map((n) => (
            <li key={n.id} className="surface-row flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  {n.found && n.url ? (
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent hover:underline"
                    >
                      {n.citation}
                    </a>
                  ) : (
                    <span className="font-medium">{n.citation}</span>
                  )}
                  {n.title && <span className="ml-2 text-muted">{n.title}</span>}
                </div>
                {n.found ? (
                  <button
                    onClick={() => setExpandedId((prev) => (prev === n.id ? null : n.id))}
                    className="text-xs text-accent hover:underline"
                  >
                    {expandedId === n.id ? "Hide" : "Show"} citing/cited (
                    {n.citingCases.length + n.citedCases.length + n.citedLegislations.length})
                  </button>
                ) : (
                  <span className="text-xs text-red-600">Not found on CanLII</span>
                )}
              </div>
              {n.found && expandedId === n.id && (
                <div className="grid gap-2 border-t border-border pt-2 text-xs sm:grid-cols-3">
                  <NoteupRefList label="Cited cases" refs={n.citedCases} />
                  <NoteupRefList label="Citing cases" refs={n.citingCases} />
                  <NoteupRefList label="Cited legislation" refs={n.citedLegislations} />
                </div>
              )}
              {!n.found && n.error && <p className="text-xs text-muted">{n.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteupRefList({ label, refs }: { label: string; refs: { title: string; citation: string }[] }) {
  return (
    <div>
      <p className="mb-1 font-medium text-muted">
        {label} ({refs.length})
      </p>
      {refs.length === 0 ? (
        <p className="text-muted">None</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {refs.map((ref, i) => (
            <li key={i}>
              {ref.title} — {ref.citation}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
