"use client";

import { useState } from "react";
import { DRAFT_TYPES, type AgentRun, type Draft, type DraftType } from "@/lib/types";
import AgentTraceButton from "./AgentTraceButton";
import DictateButton from "./DictateButton";

type DraftWithAgentRun = Draft & { agentRun?: AgentRun };

export default function DraftsPanel({
  matterId,
  initialDrafts,
}: {
  matterId: string;
  initialDrafts: Draft[];
}) {
  const [drafts, setDrafts] = useState<DraftWithAgentRun[]>(initialDrafts);
  const [draftType, setDraftType] = useState<DraftType>(DRAFT_TYPES[0]);
  const [instructions, setInstructions] = useState("");
  const [agentic, setAgentic] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftType, instructions, agentic }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate draft");
      setDrafts((prev) => [body, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <h2 className="font-display text-lg">Drafting</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={draftType}
          onChange={(e) => setDraftType(e.target.value as DraftType)}
          className="surface-input"
        >
          {DRAFT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <input
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Optional instructions (recipient, tone, key points)…"
          className="surface-input flex-1"
        />
        <DictateButton
          disabled={generating}
          onText={(text) => setInstructions((prev) => (prev ? `${prev} ${text}` : text))}
        />
        <button onClick={handleGenerate} disabled={generating} className="btn-primary">
          {generating ? "Drafting…" : "Generate draft"}
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={agentic} onChange={(e) => setAgentic(e.target.checked)} />
        Self-checking (agent) — drafts, then searches the matter&apos;s documents to verify its own
        citations and revises itself if any don&apos;t hold up. Slower, requires an Anthropic API
        key.
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {drafts.length === 0 ? (
        <p className="text-sm text-muted">No drafts generated yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {drafts.map((draft) => (
            <li key={draft.id} className="surface-row text-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{draft.draftType}</span>
                <span className="text-xs text-muted">
                  {new Date(draft.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="whitespace-pre-wrap">{draft.content}</div>
              <div className="mt-2">
                <AgentTraceButton matterId={matterId} draftId={draft.id} initialAgentRun={draft.agentRun} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
