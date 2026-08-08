"use client";

import { useState } from "react";
import { LEAD_STAGES, type Campaign, type CampaignStep, type LeadStage } from "@/lib/types";

const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  consultation_scheduled: "Consultation scheduled",
  proposal_sent: "Proposal sent",
  won: "Won",
  lost: "Lost",
};

interface StepDraft {
  delayDays: number;
  subject: string;
  body: string;
}

export default function CampaignsPanel({
  initialCampaigns,
  cronSecret,
}: {
  initialCampaigns: (Campaign & { steps: CampaignStep[] })[];
  cronSecret: string;
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [name, setName] = useState("");
  const [triggerStage, setTriggerStage] = useState<LeadStage>("contacted");
  const [steps, setSteps] = useState<StepDraft[]>([{ delayDays: 0, subject: "", body: "" }]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateStep(index: number, updates: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, triggerStage, steps }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create campaign");
      setCampaigns((prev) => [body, ...prev]);
      setName("");
      setTriggerStage("contacted");
      setSteps([{ delayDays: 0, subject: "", body: "" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
  }

  const cronCommand = `curl -X POST https://YOUR-APP-URL/api/campaigns/run-due -H "Authorization: Bearer ${cronSecret}"`;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="surface-card flex flex-col gap-3">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Campaign name (e.g. New lead welcome sequence)"
          className="surface-input"
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Enroll a lead automatically when it reaches</span>
          <select
            value={triggerStage}
            onChange={(e) => setTriggerStage(e.target.value as LeadStage)}
            className="surface-input"
          >
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <div key={i} className="surface-row flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Step {i + 1}</span>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-muted hover:text-red-600"
                  >
                    Remove step
                  </button>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">Send</span>
                <input
                  type="number"
                  min={0}
                  value={step.delayDays}
                  onChange={(e) => updateStep(i, { delayDays: Number(e.target.value) })}
                  className="surface-input w-20"
                />
                <span className="text-muted">days after enrollment</span>
              </label>
              <input
                required
                value={step.subject}
                onChange={(e) => updateStep(i, { subject: e.target.value })}
                placeholder="Subject"
                className="surface-input"
              />
              <textarea
                required
                value={step.body}
                onChange={(e) => updateStep(i, { body: e.target.value })}
                placeholder={"Body — {{lead.name}}, {{lead.email}}, {{lead.phone}}, {{lead.source}} fill in automatically"}
                rows={3}
                className="surface-input"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSteps((prev) => [...prev, { delayDays: prev.length * 3, subject: "", body: "" }])}
            className="btn-secondary self-start text-sm"
          >
            Add another step
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={creating} className="btn-primary self-start">
          {creating ? "…" : "Save campaign"}
        </button>
      </form>

      {campaigns.length === 0 ? (
        <p className="text-sm text-muted">No campaigns yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {campaigns.map((c) => (
            <li key={c.id} className="surface-row flex items-center justify-between text-sm">
              <span>
                <span className="font-medium">{c.name}</span>{" "}
                <span className="text-xs text-muted">
                  — triggers on {STAGE_LABELS[c.triggerStage]}, {c.steps.length} step{c.steps.length === 1 ? "" : "s"}
                </span>
              </span>
              <button onClick={() => handleDelete(c.id)} className="text-xs text-muted hover:text-red-600">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="surface-row flex flex-col gap-2 text-sm">
        <p className="font-medium">Sending scheduled emails</p>
        <p className="text-muted">
          This app has no built-in background scheduler — set up an OS-level scheduled task
          hitting this endpoint (a good interval is hourly) with your own secret:
        </p>
        <code className="block overflow-x-auto rounded bg-black/[0.04] p-2 text-xs dark:bg-white/[0.06]">
          {cronCommand}
        </code>
      </div>
    </div>
  );
}
