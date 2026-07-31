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
      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          matter.status === "open"
            ? "bg-green-500/10 text-green-700 dark:text-green-400"
            : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
        }`}
      >
        {matter.status}
      </span>
      <button
        onClick={handleToggle}
        disabled={updating}
        className="text-xs underline disabled:opacity-50"
      >
        {updating ? "…" : matter.status === "open" ? "Close matter" : "Reopen matter"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
