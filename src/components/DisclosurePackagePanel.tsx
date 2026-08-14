"use client";

import { useState } from "react";
import type { DisclosurePackageDocument, RedactionFlag } from "@/lib/matters";

export default function DisclosurePackagePanel({
  matterId,
  initialFlags,
  initialPackage,
}: {
  matterId: string;
  initialFlags: RedactionFlag[];
  initialPackage: DisclosurePackageDocument[];
}) {
  const [flags, setFlags] = useState(initialFlags);
  const [pkg, setPkg] = useState(initialPackage);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  async function refreshPackage() {
    const res = await fetch(`/api/matters/${matterId}/disclosure-package`);
    if (res.ok) setPkg(await res.json());
  }

  async function handleScan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/redaction-flags`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Scan failed");
      setFlags(body);
      await refreshPackage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setScanning(false);
    }
  }

  async function handleResolve(flagId: string, status: "cleared" | "confirmed") {
    setResolvingId(flagId);
    try {
      const res = await fetch(`/api/matters/${matterId}/redaction-flags/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update flag");
      setFlags((prev) => prev.map((f) => (f.id === flagId ? body : f)));
      await refreshPackage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setResolvingId(null);
    }
  }

  const byDocument = new Map<string, RedactionFlag[]>();
  for (const f of flags) {
    byDocument.set(f.documentName, [...(byDocument.get(f.documentName) ?? []), f]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="surface-card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg">Redaction candidates</h2>
            <p className="text-sm text-muted">
              Scans every document for passages that look privileged or sensitive, so they can be reviewed
              one by one before disclosure. This never edits or redacts a document itself — a lawyer confirms
              each flag, then applies the redaction manually before sending.
            </p>
          </div>
          <button onClick={handleScan} disabled={scanning} className="btn-primary shrink-0 px-3 py-1.5">
            {scanning ? "Scanning…" : flags.length > 0 ? "Re-scan" : "Scan documents"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}

        {flags.length === 0 ? (
          <p className="text-sm text-muted">No redaction candidates flagged yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {[...byDocument.entries()].map(([documentName, docFlags]) => (
              <div key={documentName} className="flex flex-col gap-2">
                <p className="text-sm font-medium">{documentName}</p>
                <ul className="flex flex-col gap-2">
                  {docFlags.map((f) => (
                    <li key={f.id} className="surface-row flex flex-col gap-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            f.category === "PRIVILEGE"
                              ? "rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400"
                              : "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                          }
                        >
                          {f.category}
                        </span>
                        {f.status !== "flagged" && (
                          <span className="text-xs text-muted">
                            {f.status === "confirmed" ? "Confirmed for redaction" : "Cleared — not privileged"}
                          </span>
                        )}
                      </div>
                      <blockquote className="border-l-2 border-border pl-2 text-muted italic">
                        &quot;{f.passage}&quot;
                      </blockquote>
                      <p className="text-xs text-muted">{f.reason}</p>
                      {f.status === "flagged" && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleResolve(f.id, "confirmed")}
                            disabled={resolvingId === f.id}
                            className="btn-secondary px-2.5 py-1 text-xs"
                          >
                            Confirm — needs redaction
                          </button>
                          <button
                            onClick={() => handleResolve(f.id, "cleared")}
                            disabled={resolvingId === f.id}
                            className="btn-secondary px-2.5 py-1 text-xs"
                          >
                            Clear — not privileged
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="surface-card flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg">Disclosure package</h2>
          <p className="text-sm text-muted">
            A document is ready once every flag against it has been cleared or confirmed — a confirmed flag
            still means redact it manually before sending, this only tracks review status.
          </p>
        </div>
        {pkg.length === 0 ? (
          <p className="text-sm text-muted">No documents uploaded for this matter yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pkg.map((doc) => (
              <li
                key={doc.documentId}
                className="surface-row flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>{doc.documentName}</span>
                <span className="flex items-center gap-2">
                  {doc.ready ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Ready to disclose
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                      {doc.unresolvedFlagCount} unresolved flag{doc.unresolvedFlagCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {doc.confirmedFlagCount > 0 && (
                    <span className="text-xs text-muted">
                      {doc.confirmedFlagCount} confirmed for manual redaction
                    </span>
                  )}
                  <a
                    href={`/api/matters/${matterId}/documents/${doc.documentId}/download`}
                    className="text-xs text-accent hover:underline"
                  >
                    Download
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
