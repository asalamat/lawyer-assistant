"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReferenceDocument } from "@/lib/types";

export default function ReferenceDocumentsAttachPanel({
  matterId,
  initialAttached,
  library,
}: {
  matterId: string;
  initialAttached: ReferenceDocument[];
  library: ReferenceDocument[];
}) {
  const [attached, setAttached] = useState(initialAttached);
  const [selected, setSelected] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attachedIds = new Set(attached.map((doc) => doc.id));
  const available = library.filter((doc) => !attachedIds.has(doc.id));

  async function handleAttach() {
    if (!selected) return;
    setAttaching(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/reference-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceDocumentId: selected }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to attach reference document");
      const doc = library.find((d) => d.id === selected);
      if (doc) setAttached((prev) => [...prev, doc]);
      setSelected("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAttaching(false);
    }
  }

  async function handleDetach(id: string) {
    setAttached((prev) => prev.filter((doc) => doc.id !== id));
    await fetch(`/api/matters/${matterId}/reference-documents/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <h2 className="mb-2 font-display text-lg">Reference documents</h2>
      <p className="mb-2 text-sm text-muted">
        Attach statutes or case law from the{" "}
        <Link href="/reference-library" className="text-accent hover:underline">
          reference library
        </Link>{" "}
        to include them as context for this matter&apos;s chat, digests, and drafts.
      </p>

      {attached.length === 0 ? (
        <p className="text-sm text-muted">No reference documents attached to this matter.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {attached.map((doc) => (
            <li key={doc.id} className="surface-row flex items-center justify-between text-sm">
              <span>{doc.fileName}</span>
              <button
                onClick={() => handleDetach(doc.id)}
                className="text-xs text-muted hover:text-red-600"
              >
                Detach
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="mt-3 flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="surface-input flex-1"
          >
            <option value="">Select a reference document…</option>
            {available.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.fileName}
              </option>
            ))}
          </select>
          <button
            onClick={handleAttach}
            disabled={attaching || !selected}
            className="btn-secondary"
          >
            {attaching ? "Attaching…" : "Attach"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
