"use client";

import { useState } from "react";
import type { MatterRequirement } from "@/lib/types";

export default function RequirementsChecklistPanel({
  matterId,
  initialItems,
}: {
  matterId: string;
  initialItems: MatterRequirement[];
}) {
  const [items, setItems] = useState(initialItems);
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add requirement");
      setItems((prev) => [...prev, body]);
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(item: MatterRequirement) {
    const completed = !item.completed;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: completed ? 1 : 0 } : i)));
    const res = await fetch(`/api/matters/${matterId}/requirements/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    }
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/matters/${matterId}/requirements/${id}`, { method: "DELETE" });
  }

  const incomplete = items.filter((i) => !i.completed);
  const complete = items.filter((i) => i.completed);

  return (
    <div className="flex flex-col gap-4">
      <div className="surface-card flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg">Requirements</h2>
          <p className="text-sm text-muted">
            A starting checklist of documents/steps this kind of matter typically needs, based on its matter
            type — a starting point to adapt, not a complete or authoritative list for the actual case.
          </p>
        </div>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Add another requirement…"
            className="surface-input min-w-[14rem] flex-1"
          />
          <button type="submit" disabled={adding || !label.trim()} className="btn-primary px-3 py-2">
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="surface-card flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted">
            No requirements yet — none were seeded for this matter&apos;s type, add some manually above.
          </p>
        ) : (
          <>
            {incomplete.map((item) => (
              <div key={item.id} className="surface-row flex items-center justify-between gap-3 text-sm">
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input type="checkbox" checked={Boolean(item.completed)} onChange={() => handleToggle(item)} />
                  <span className="min-w-0 flex-1">{item.label}</span>
                </label>
                <button onClick={() => handleDelete(item.id)} className="shrink-0 text-muted hover:text-red-600">
                  ✕
                </button>
              </div>
            ))}
            {complete.length > 0 && (
              <>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Completed ({complete.length})
                </p>
                {complete.map((item) => (
                  <div key={item.id} className="surface-row flex items-center justify-between gap-3 text-sm">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <input type="checkbox" checked={Boolean(item.completed)} onChange={() => handleToggle(item)} />
                      <span className="min-w-0 flex-1 text-muted line-through">{item.label}</span>
                    </label>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="shrink-0 text-xs text-muted hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
