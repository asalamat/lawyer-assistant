"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function LeadDetailPanel({ initialLead }: { initialLead: Lead }) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [name, setName] = useState(lead.name);
  const [email, setEmail] = useState(lead.email ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [source, setSource] = useState(lead.source ?? "");
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [matterTitle, setMatterTitle] = useState("");
  const [matterType, setMatterType] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email || null, phone: phone || null, source: source || null, notes: notes || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setLead(body);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleStageChange(stage: LeadStage) {
    setLead((prev) => ({ ...prev, stage }));
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    setConverting(true);
    setConvertError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: matterTitle, matterType }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to convert lead");
      router.push(`/matters/${body.matter.id}`);
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/leads" className="text-sm text-accent hover:underline">
          ← Leads
        </Link>
        <h1 className="font-display text-3xl italic">{lead.name}</h1>
      </div>

      {lead.convertedMatterId ? (
        <p className="surface-card text-sm">
          This lead was converted to a matter.{" "}
          <Link href={`/matters/${lead.convertedMatterId}`} className="text-accent hover:underline">
            View matter →
          </Link>
        </p>
      ) : (
        <div className="surface-card flex flex-col gap-3">
          <h2 className="font-display text-lg">Convert to matter</h2>
          <form onSubmit={handleConvert} className="flex flex-col gap-3">
            <input
              required
              value={matterTitle}
              onChange={(e) => setMatterTitle(e.target.value)}
              placeholder="Matter title"
              className="surface-input"
            />
            <input
              required
              value={matterType}
              onChange={(e) => setMatterType(e.target.value)}
              placeholder="Matter type (e.g. Litigation, Family, General)"
              className="surface-input"
            />
            {convertError && <p className="text-sm text-red-600">{convertError}</p>}
            <button type="submit" disabled={converting} className="btn-primary self-start">
              {converting ? "Converting…" : "Convert to matter"}
            </button>
          </form>
        </div>
      )}

      <div className="surface-card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Details</h2>
          <select
            value={lead.stage}
            onChange={(e) => handleStageChange(e.target.value as LeadStage)}
            className="surface-input text-sm"
          >
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <input required value={name} onChange={(e) => setName(e.target.value)} className="surface-input" placeholder="Name" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="surface-input" placeholder="Email" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="surface-input" placeholder="Phone" />
          <input value={source} onChange={(e) => setSource(e.target.value)} className="surface-input" placeholder="Source" />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="surface-input"
            placeholder="Notes"
          />
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          <button type="submit" disabled={saving} className="btn-primary self-start">
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
