"use client";

import { useState } from "react";
import type { WitnessPrepAnalysis } from "@/lib/matters";
import ExportPdfButton from "./ExportPdfButton";
import MarkdownContent from "./MarkdownContent";
import TranslateButton from "./TranslateButton";

export default function WitnessPrepPanel({
  matterId,
  initialAnalyses,
  witnessNames,
}: {
  matterId: string;
  initialAnalyses: WitnessPrepAnalysis[];
  witnessNames: string[];
}) {
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [witnessName, setWitnessName] = useState(witnessNames[0] ?? "");
  const [customName, setCustomName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(analyses[0]?.id ?? null);

  const nameToUse = witnessName === "__custom__" ? customName.trim() : witnessName;

  async function handleGenerate() {
    if (!nameToUse) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/witness-prep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ witnessName: nameToUse }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate");
      setAnalyses((prev) => [body, ...prev]);
      setExpandedId(body.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg">Witness / examination prep</h2>
        <p className="text-sm text-muted">
          Pulls every statement attributed to a named witness from this matter&apos;s documents, flags
          inconsistencies, and suggests direct/cross-examination questions grounded in the record. Not a
          prediction of how the witness will answer.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={witnessName}
          onChange={(e) => setWitnessName(e.target.value)}
          className="surface-input w-auto"
        >
          {witnessNames.length === 0 && <option value="">No witnesses added yet</option>}
          {witnessNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value="__custom__">Other name…</option>
        </select>
        {witnessName === "__custom__" && (
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Witness name as it appears in documents"
            className="surface-input w-auto"
          />
        )}
        <button onClick={handleGenerate} disabled={generating || !nameToUse} className="btn-primary px-3 py-1.5">
          {generating ? "Generating…" : "Generate prep"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {analyses.length === 0 ? (
        <p className="text-sm text-muted">No witness prep generated yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {analyses.map((a) => (
            <li key={a.id} className="surface-row flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{a.witnessName}</span>
                  <span className="ml-2 text-xs text-muted">{new Date(a.createdAt).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => setExpandedId((prev) => (prev === a.id ? null : a.id))}
                  className="text-xs text-accent hover:underline"
                >
                  {expandedId === a.id ? "Hide" : "Show"}
                </button>
              </div>
              {expandedId === a.id && (
                <div className="flex flex-col gap-2 border-t border-border pt-2">
                  <MarkdownContent content={a.content} />
                  <div className="flex items-center gap-2">
                    <ExportPdfButton title={`Witness prep — ${a.witnessName}`} content={a.content} />
                    <TranslateButton content={a.content} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
