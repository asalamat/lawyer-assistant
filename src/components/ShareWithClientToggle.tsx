"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ShareWithClientToggle({
  matterId,
  documentId,
  initialShared,
}: {
  matterId: string;
  documentId: string;
  initialShared: boolean;
}) {
  const router = useRouter();
  const [shared, setShared] = useState(initialShared);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/documents/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared: !shared }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update sharing");
      setShared(!shared);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={
          shared
            ? "rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent disabled:opacity-50"
            : "text-xs text-muted underline decoration-muted/40 disabled:opacity-50"
        }
      >
        {loading ? "…" : shared ? "Shared with client" : "Share with client"}
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </span>
  );
}
