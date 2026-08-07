"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RetryExtractionButton({
  matterId,
  documentId,
}: {
  matterId: string;
  documentId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/documents/${documentId}/retry-extraction`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Retry failed");
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
        onClick={handleRetry}
        disabled={loading}
        className="text-xs text-accent underline decoration-accent/40 disabled:opacity-50"
      >
        {loading ? "Retrying…" : "Retry"}
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </span>
  );
}
