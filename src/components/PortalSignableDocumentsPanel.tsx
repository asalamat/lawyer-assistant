"use client";

import { useState } from "react";
import SignDocumentForm from "./SignDocumentForm";

interface PendingSignableDocument {
  id: string;
  title: string;
  kindLabel: string;
}

export default function PortalSignableDocumentsPanel({
  matterId,
  initialPending,
}: {
  matterId: string;
  initialPending: PendingSignableDocument[];
}) {
  const [pending, setPending] = useState(initialPending);
  const [activeId, setActiveId] = useState<string | null>(null);

  function handleSigned(docId: string) {
    setPending((prev) => prev.filter((d) => d.id !== docId));
    setActiveId(null);
  }

  if (pending.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 font-display text-lg">Needs your signature</h2>
      <ul className="flex flex-col gap-2">
        {pending.map((doc) => (
          <li key={doc.id} className="surface-row flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{doc.title}</p>
                <p className="text-xs text-muted">{doc.kindLabel}</p>
              </div>
              <button
                onClick={() => setActiveId(activeId === doc.id ? null : doc.id)}
                className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
              >
                {activeId === doc.id ? "Close" : "Review & sign"}
              </button>
            </div>
            {activeId === doc.id && (
              <SignDocumentForm
                fetchUrl={`/api/portal/matters/${matterId}/signable-documents/${doc.id}`}
                submitUrl={`/api/portal/matters/${matterId}/signable-documents/${doc.id}`}
                onSigned={() => handleSigned(doc.id)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
