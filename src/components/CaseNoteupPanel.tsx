"use client";

import { useState } from "react";
import { findPossibleAppeals } from "@/lib/caseAppealHeuristic";
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
          {noteups.map((n) => {
            const possibleAppeals = n.found && n.title ? findPossibleAppeals(n.title, n.citingCases) : [];
            return (
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
                    {possibleAppeals.length > 0 && (
                      <span
                        className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                        title="A citing case shares a party name with this one — may be the same litigation on appeal. Not a verdict on whether this case is still good law, just worth checking."
                      >
                        {possibleAppeals.length} possible appeal{possibleAppeals.length > 1 ? "s" : ""} — review
                      </span>
                    )}
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
                    <NoteupRefList label="Citing cases" refs={n.citingCases} highlight={possibleAppeals} />
                    <NoteupRefList label="Cited legislation" refs={n.citedLegislations} />
                  </div>
                )}
                {!n.found && n.error && <p className="text-xs text-muted">{n.error}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NoteupRefList({
  label,
  refs,
  highlight = [],
}: {
  label: string;
  refs: { title: string; citation: string }[];
  highlight?: { title: string; citation: string }[];
}) {
  const highlighted = new Set(highlight.map((h) => h.citation));
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
            <li key={i} className={highlighted.has(ref.citation) ? "font-medium text-amber-700 dark:text-amber-400" : undefined}>
              {ref.title} — {ref.citation}
              {highlighted.has(ref.citation) && " (possible appeal)"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
