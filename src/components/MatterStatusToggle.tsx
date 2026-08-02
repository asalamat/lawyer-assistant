"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Matter } from "@/lib/types";

const NEXT_ACTIONS: Record<Matter["status"], { label: string; next: Matter["status"] }[]> = {
  open: [
    { label: "Close matter", next: "closed" },
    { label: "Archive matter", next: "archived" },
  ],
  closed: [
    { label: "Reopen matter", next: "open" },
    { label: "Archive matter", next: "archived" },
  ],
  archived: [{ label: "Restore matter", next: "closed" }],
};

const BADGE_CLASS: Record<Matter["status"], string> = {
  open: "badge-accent",
  closed: "badge",
  archived: "badge",
};

export default function MatterStatusToggle({ matter }: { matter: Matter }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(nextStatus: Matter["status"]) {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className={BADGE_CLASS[matter.status]}>{matter.status}</span>
      {NEXT_ACTIONS[matter.status].map(({ label, next }) => (
        <button
          key={next}
          onClick={() => handleChange(next)}
          disabled={updating}
          className="text-xs text-accent underline decoration-accent/40 disabled:opacity-50"
        >
          {updating ? "…" : label}
        </button>
      ))}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
