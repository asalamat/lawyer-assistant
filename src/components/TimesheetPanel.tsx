"use client";

import { useState } from "react";
import { formatDateOnly } from "@/lib/formatDate";
import type { TimeEntry } from "@/lib/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TimesheetPanel({
  matterId,
  initialEntries,
}: {
  matterId: string;
  initialEntries: TimeEntry[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [workedOn, setWorkedOn] = useState(today());
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workedOn, description, hours: Number(hours) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to log time");
      setEntries((prev) =>
        [body, ...prev].sort(
          (a, b) => b.workedOn.localeCompare(a.workedOn) || b.createdAt.localeCompare(a.createdAt),
        ),
      );
      setDescription("");
      setHours("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(entryId: string) {
    setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    await fetch(`/api/matters/${matterId}/time-entries/${entryId}`, { method: "DELETE" });
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Timesheet</h2>
        <span className="badge-accent">{totalHours.toFixed(1)} hrs total</span>
      </div>

      <form onSubmit={handleAdd} className="grid gap-2 sm:grid-cols-[auto_1fr_auto_auto]">
        <input
          required
          type="date"
          value={workedOn}
          onChange={(e) => setWorkedOn(e.target.value)}
          className="surface-input"
        />
        <input
          required
          placeholder="What did you work on?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="surface-input"
        />
        <input
          required
          type="number"
          step="0.1"
          min="0.1"
          placeholder="Hours"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          className="surface-input w-24"
        />
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Logging…" : "Log time"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {entries.length === 0 ? (
        <p className="text-sm text-muted">No time logged yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="surface-row flex items-center justify-between text-sm">
              <div>
                <p>{entry.description}</p>
                <p className="text-xs text-muted">{formatDateOnly(entry.workedOn)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-medium text-accent">{entry.hours.toFixed(1)}h</span>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-xs text-muted hover:text-red-600"
                  aria-label="Delete time entry"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
