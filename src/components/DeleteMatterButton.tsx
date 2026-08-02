"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Matter } from "@/lib/types";

export default function DeleteMatterButton({ matter }: { matter: Matter }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typedTitle, setTypedTitle] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matter.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete matter");
      router.push("/matters");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-red-600 underline decoration-red-600/40"
      >
        Delete matter
      </button>
    );
  }

  return (
    <div className="surface-row flex flex-col gap-2 border-red-600/30 bg-red-600/5 text-sm">
      <p className="font-medium text-red-700 dark:text-red-400">
        This permanently deletes &quot;{matter.title}&quot; and all its documents, chat history,
        digests, drafts, timesheets, and invoices. This cannot be undone.
      </p>
      <p>
        Type <span className="font-mono">{matter.title}</span> to confirm:
      </p>
      <input
        value={typedTitle}
        onChange={(e) => setTypedTitle(e.target.value)}
        className="surface-input"
      />
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={typedTitle !== matter.title || deleting}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          onClick={() => {
            setConfirming(false);
            setTypedTitle("");
            setError(null);
          }}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
