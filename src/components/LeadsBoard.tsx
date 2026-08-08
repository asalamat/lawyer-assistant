"use client";

import Link from "next/link";
import { useState } from "react";
import { LEAD_STAGES, type Lead, type LeadStage } from "@/lib/types";

const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  consultation_scheduled: "Consultation scheduled",
  proposal_sent: "Proposal sent",
  won: "Won",
  lost: "Lost",
};

export default function LeadsBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email || null, source: source || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add lead");
      setLeads((prev) => [body, ...prev]);
      setName("");
      setEmail("");
      setSource("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function handleMove(id: string, stage: LeadStage) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="surface-card flex flex-wrap items-end gap-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="surface-input flex-1"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className="surface-input"
        />
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Source (optional)"
          className="surface-input"
        />
        <button type="submit" disabled={creating} className="btn-primary">
          {creating ? "…" : "Add lead"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {LEAD_STAGES.map((stage) => (
          <div key={stage} className="flex flex-col gap-2">
            <h2 className="text-xs font-medium text-muted">
              {STAGE_LABELS[stage]} ({leads.filter((l) => l.stage === stage).length})
            </h2>
            <div className="flex flex-col gap-2">
              {leads
                .filter((l) => l.stage === stage)
                .map((lead) => (
                  <div key={lead.id} className="surface-card flex flex-col gap-2 p-3">
                    <Link href={`/leads/${lead.id}`} className="text-sm font-medium hover:text-accent">
                      {lead.name}
                    </Link>
                    {lead.source && <p className="text-xs text-muted">{lead.source}</p>}
                    <select
                      value={lead.stage}
                      onChange={(e) => handleMove(lead.id, e.target.value as LeadStage)}
                      className="surface-input text-xs"
                    >
                      {LEAD_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {STAGE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
