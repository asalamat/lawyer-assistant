"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Matter } from "@/lib/types";

export default function MatterTypeEditor({ matter }: { matter: Matter }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(matter.matterType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matterType: value }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update matter type");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        {matter.matterType}
        <button
          onClick={() => {
            setValue(matter.matterType);
            setEditing(true);
          }}
          className="text-xs text-accent underline decoration-accent/40"
        >
          change
        </button>
      </span>
    );
  }

  return (
    <form onSubmit={handleSave} className="inline-flex items-center gap-2">
      <input
        required
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="surface-input px-2 py-0.5 text-sm"
        style={{ width: `${Math.max(value.length, 10)}ch` }}
      />
      <button type="submit" disabled={saving} className="text-xs text-accent underline decoration-accent/40">
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={saving}
        className="text-xs text-muted underline decoration-muted/40"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
