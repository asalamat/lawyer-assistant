"use client";

import { useState } from "react";
import type { AgentRun } from "@/lib/types";

export default function AgentTraceButton({
  matterId,
  draftId,
  initialAgentRun,
}: {
  matterId: string;
  draftId: string;
  initialAgentRun?: AgentRun;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agentRun, setAgentRun] = useState<AgentRun | null>(initialAgentRun ?? null);
  const [checked, setChecked] = useState(Boolean(initialAgentRun));
  const [notFound, setNotFound] = useState(false);

  async function handleOpen() {
    setOpen(true);
    if (checked) return;
    setChecked(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/matters/${matterId}/drafts/${draftId}/agent-run`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) setAgentRun(await res.json());
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={handleOpen} className="text-xs text-accent underline decoration-accent/40">
        Agent trace
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="self-start text-xs text-muted underline decoration-muted/40"
      >
        Hide agent trace
      </button>
      {loading && <p className="text-xs text-muted">Loading…</p>}
      {notFound && <p className="text-xs text-muted">No agent trace for this draft.</p>}
      {agentRun && (
        <ol className="surface-row flex flex-col gap-1 text-xs">
          {agentRun.trace.map((step, i) => (
            <li key={i}>
              <span className="text-muted">
                {step.type === "tool_call" && "🔍 "}
                {step.type === "tool_result" && "→ "}
                {step.type === "revision" && "↻ "}
                {step.type === "final" && "✓ "}
              </span>
              {step.detail}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
