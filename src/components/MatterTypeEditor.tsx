"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TASK_TEMPLATES } from "@/lib/taskTemplates";
import type { Matter } from "@/lib/types";

// Same suggestion list as the new-matter form (MatterList.tsx) — every
// recognized matterType that seeds a task checklist/limitation deadline/
// requirements checklist, so picking one from the list is guaranteed to
// actually match instead of silently typing something the fuzzy lookup
// misses. Still free text underneath — nothing stops typing anything else.
const MATTER_TYPE_SUGGESTIONS = Object.keys(TASK_TEMPLATES);

export default function MatterTypeEditor({ matter }: { matter: Matter }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(matter.matterType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!value.trim()) {
      setError("Matter type is required");
      return;
    }
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

  // A plain <span>, not a <form> — this whole component sits inside a <p>
  // in the matter layout header, and <form> isn't valid content inside <p>;
  // browsers silently split the <p> to fix the invalid nesting, which
  // breaks hydration and, with it, this component's own event handling
  // (that's what was actually causing the missing error message).
  return (
    <span className="inline-flex items-center gap-2">
      <input
        autoFocus
        list="matter-type-edit-suggestions"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        className="surface-input px-2 py-0.5 text-sm"
        style={{ width: `${Math.max(value.length, 10)}ch` }}
      />
      <datalist id="matter-type-edit-suggestions">
        {MATTER_TYPE_SUGGESTIONS.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="text-xs text-accent underline decoration-accent/40"
      >
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
    </span>
  );
}
