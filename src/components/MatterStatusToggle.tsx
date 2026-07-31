"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Matter } from "@/lib/types";

export default function MatterStatusToggle({ matter }: { matter: Matter }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const nextStatus = matter.status === "open" ? "closed" : "open";
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
      <span className={matter.status === "open" ? "badge-accent" : "badge"}>
        {matter.status}
      </span>
      <button
        onClick={handleToggle}
        disabled={updating}
        className="text-xs text-accent underline decoration-accent/40 disabled:opacity-50"
      >
        {updating ? "…" : matter.status === "open" ? "Close matter" : "Reopen matter"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
