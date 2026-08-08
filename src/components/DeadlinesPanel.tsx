"use client";

import { useState } from "react";
import { formatDateOnly } from "@/lib/formatDate";
import type { DeadlineRule, MatterDeadline } from "@/lib/types";

const SOURCE_LABELS: Record<MatterDeadline["source"], string> = {
  extracted: "AI-extracted",
  "rule-computed": "Rule-computed",
  manual: "Manual",
};

function CalculatorPanel({
  matterId,
  rules,
  onComputed,
}: {
  matterId: string;
  rules: DeadlineRule[];
  onComputed: (deadline: MatterDeadline) => void;
}) {
  const [ruleId, setRuleId] = useState(rules[0]?.id ?? "");
  const [triggerDate, setTriggerDate] = useState("");
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setComputing(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/deadlines/compute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId, triggerDate }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to compute deadline");
      onComputed(body);
      setTriggerDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setComputing(false);
    }
  }

  if (rules.length === 0) {
    return (
      <p className="text-sm text-muted">
        No deadline rules configured yet — an admin can add some in Settings &gt; Deadline rules.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <select value={ruleId} onChange={(e) => setRuleId(e.target.value)} className="surface-input">
        {rules.map((rule) => (
          <option key={rule.id} value={rule.id}>
            {rule.name}
          </option>
        ))}
      </select>
      <input
        type="date"
        required
        value={triggerDate}
        onChange={(e) => setTriggerDate(e.target.value)}
        placeholder="Trigger date"
        className="surface-input"
      />
      <button type="submit" disabled={computing} className="btn-secondary">
        {computing ? "…" : "Calculate & add"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export default function DeadlinesPanel({
  matterId,
  initialDeadlines,
  rules,
}: {
  matterId: string;
  initialDeadlines: MatterDeadline[];
  rules: DeadlineRule[];
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

  function handleComputed(deadline: MatterDeadline) {
    setDeadlines((prev) =>
      [...prev, deadline].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    );
  }

  return (
    <div className="flex flex-col gap-4">
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
            No deadlines yet. Upload documents and extract deadlines, or calculate one below.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {deadlines.map((deadline) => (
              <li key={deadline.id} className="surface-row flex items-center justify-between text-sm">
                <div>
                  <p>
                    {deadline.description}
                    <span className="badge ml-2">{SOURCE_LABELS[deadline.source]}</span>
                  </p>
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

      <div className="surface-card flex flex-col gap-3">
        <h2 className="font-display text-lg">Calculate a deadline</h2>
        <p className="text-sm text-muted">
          Pick a saved rule and the date it triggers from — the result is added straight to the
          list above, tagged so it survives a later re-extract.
        </p>
        <CalculatorPanel matterId={matterId} rules={rules} onComputed={handleComputed} />
      </div>
    </div>
  );
}
