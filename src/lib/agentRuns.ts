import { randomUUID } from "crypto";
import db, { toPlain } from "./db";
import type { AgentRun, AgentTraceStep } from "./types";

// Persists the full step-by-step trace of an agentic (tool-calling loop)
// feature, so a lawyer can see exactly what it searched for and why it
// revised itself, rather than only the final output — the transparency
// this app's other AI features get "for free" from being single-shot.
export async function saveAgentRun(params: {
  matterId: string;
  kind: string;
  draftId: string | null;
  iterations: number;
  trace: AgentTraceStep[];
}): Promise<AgentRun> {
  const run: AgentRun = {
    id: randomUUID(),
    matterId: params.matterId,
    kind: params.kind,
    draftId: params.draftId,
    iterations: params.iterations,
    trace: params.trace,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO agent_runs (id, matterId, kind, draftId, iterations, traceJson, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(run.id, run.matterId, run.kind, run.draftId, run.iterations, JSON.stringify(run.trace), run.createdAt);
  return run;
}

interface AgentRunRow {
  id: string;
  matterId: string;
  kind: string;
  draftId: string | null;
  iterations: number;
  traceJson: string;
  createdAt: string;
}

export async function getAgentRunForDraft(draftId: string): Promise<AgentRun | null> {
  const row = db.prepare("SELECT * FROM agent_runs WHERE draftId = ?").get(draftId) as unknown as
    | AgentRunRow
    | undefined;
  if (!row) return null;
  const plain = toPlain<AgentRunRow>(row);
  return {
    id: plain.id,
    matterId: plain.matterId,
    kind: plain.kind,
    draftId: plain.draftId,
    iterations: plain.iterations,
    trace: JSON.parse(plain.traceJson) as AgentTraceStep[],
    createdAt: plain.createdAt,
  };
}
