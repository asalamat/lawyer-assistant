"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/formatDate";
import type { ChangeBackupStatus } from "@/lib/settings";

export default function ChangeBackupPanel({ initialStatus }: { initialStatus: ChangeBackupStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [enabled, setEnabled] = useState(initialStatus.enabled);
  const [debounceMinutes, setDebounceMinutes] = useState(String(initialStatus.debounceMinutes));
  const [cooldownMinutes, setCooldownMinutes] = useState(String(initialStatus.cooldownMinutes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/change-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          debounceMinutes: Number(debounceMinutes),
          cooldownMinutes: Number(cooldownMinutes),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setStatus(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface-row flex flex-col gap-3 text-sm">
      <p className="font-medium">Back up after activity</p>
      <p className="text-muted">
        In addition to the fixed schedule above, back up shortly after real activity in the app —
        a matter created, a document uploaded, a note saved, and so on. Waits for things to go
        quiet first, and won&apos;t back up more often than the cooldown below, so a busy stretch
        doesn&apos;t trigger a run every few seconds.
      </p>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enable activity-triggered backups
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-muted">Wait for</span>
          <input
            type="number"
            min={1}
            max={60}
            value={debounceMinutes}
            onChange={(e) => setDebounceMinutes(e.target.value)}
            className="surface-input w-16"
          />
          <span className="text-muted">min of quiet before backing up</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">No more than once every</span>
          <input
            type="number"
            min={1}
            max={1440}
            value={cooldownMinutes}
            onChange={(e) => setCooldownMinutes(e.target.value)}
            className="surface-input w-16"
          />
          <span className="text-muted">min</span>
        </label>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <button onClick={save} disabled={saving} className="btn-primary self-start px-3 py-1.5 text-xs">
        {saving ? "Saving…" : "Save"}
      </button>
      <p className="text-xs text-muted">
        Last activity-triggered backup: {status.lastRunAt ? formatDateTime(status.lastRunAt) : "Never"}
        {status.lastStatus === "error" && status.lastError ? (
          <span className="text-red-600"> — failed: {status.lastError}</span>
        ) : null}
      </p>
    </div>
  );
}
