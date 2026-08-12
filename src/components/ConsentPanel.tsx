"use client";

import { useState } from "react";
import type { SignableDocument, SignableDocumentKind } from "@/lib/signableDocuments";

export interface ConsentRow extends SignableDocument {
  signerName: string | null;
  signatureImage: string | null;
}

// Kept here rather than imported from signableDocuments.ts: that module pulls
// in the database layer, which can't be bundled for the browser.
const KIND_OPTIONS: { value: SignableDocumentKind; label: string }[] = [
  { value: "retainer", label: "Retainer agreement" },
  { value: "conflict_waiver", label: "Conflict waiver" },
  { value: "privacy_consent", label: "Privacy consent" },
  { value: "custom", label: "Other document" },
];

const STATUS_STYLES: Record<string, string> = {
  draft: "badge",
  sent: "badge bg-amber-500/10 text-amber-700 dark:text-amber-400",
  signed: "badge bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  declined: "badge bg-red-600/10 text-red-700 dark:text-red-400",
  voided: "badge text-muted",
  expired: "badge text-muted",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting signature",
  signed: "Signed",
  declined: "Declined",
  voided: "Voided",
  expired: "Expired",
};

function kindLabel(kind: string): string {
  return KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

export default function ConsentPanel({
  matterId,
  initialDocuments,
  matterDocuments,
}: {
  matterId: string;
  initialDocuments: ConsentRow[];
  matterDocuments: { id: string; fileName: string }[];
}) {
  const [rows, setRows] = useState(initialDocuments);
  const [kind, setKind] = useState<SignableDocumentKind>("retainer");
  const [title, setTitle] = useState("");
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signing links are only ever returned by the request that issues them, so
  // they live in component state — reloading the page shows the status
  // without re-exposing the token. "Resend" mints a fresh link on demand.
  const [signUrls, setSignUrls] = useState<Record<string, string>>({});
  const [emailedTo, setEmailedTo] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingVoidId, setConfirmingVoidId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/signable-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, sourceDocumentId: sourceDocumentId || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to prepare document");
      setRows((prev) => [{ ...body, signerName: null, signatureImage: null }, ...prev]);
      setTitle("");
      setSourceDocumentId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function runAction(docId: string, action: "resend" | "decline" | "void") {
    setBusyId(docId);
    setError(null);
    setConfirmingVoidId(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/signable-documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update document");
      setRows((prev) =>
        prev.map((row) => (row.id === docId ? { ...row, ...body.document } : row)),
      );
      if (body.signUrl) {
        setSignUrls((prev) => ({ ...prev, [docId]: body.signUrl }));
        setEmailedTo((prev) => {
          const next = { ...prev };
          if (body.emailedTo) next[docId] = body.emailedTo;
          else delete next[docId];
          return next;
        });
      } else {
        setSignUrls((prev) => {
          const next = { ...prev };
          delete next[docId];
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink(docId: string, signUrl: string) {
    await navigator.clipboard.writeText(`${window.location.origin}${signUrl}`);
    setCopiedId(docId);
    setTimeout(() => setCopiedId((current) => (current === docId ? null : current)), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="surface-card flex flex-col gap-3">
        <h2 className="font-display text-lg">New signable document</h2>
        <p className="text-sm text-muted">
          Prepare a retainer, waiver or consent for this client to sign. If they have an email on
          file and SMTP is configured, the signing link is emailed to them automatically —
          otherwise (or as a backup) copy the link yourself. No login is needed at their end and
          the link expires on its own.
        </p>
        <form onSubmit={handleCreate} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Kind
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SignableDocumentKind)}
              className="surface-input"
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Retainer agreement — hourly, 2026"
              className="surface-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Source document <span className="text-xs text-muted">(optional)</span>
            <select
              value={sourceDocumentId}
              onChange={(e) => setSourceDocumentId(e.target.value)}
              className="surface-input"
            >
              <option value="">No attached document</option>
              {matterDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.fileName}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={creating} className="btn-primary self-start">
            {creating ? "Preparing…" : "Prepare document"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="surface-card flex flex-col gap-3">
        <h2 className="font-display text-lg">Consent &amp; signatures</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Nothing prepared for signature yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => {
              const busy = busyId === row.id;
              const signUrl = signUrls[row.id];
              return (
                <li key={row.id} className="surface-row flex flex-col gap-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{row.title}</p>
                      <p className="text-xs text-muted">
                        {kindLabel(row.kind)}
                        {row.signedAt && row.signerName
                          ? ` · signed by ${row.signerName} on ${new Date(row.signedAt).toLocaleDateString()}`
                          : row.sentAt
                            ? ` · sent ${new Date(row.sentAt).toLocaleDateString()}`
                            : ` · prepared ${new Date(row.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <span className={STATUS_STYLES[row.status] ?? "badge"}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {row.status !== "signed" && row.status !== "voided" && (
                      <button
                        onClick={() => runAction(row.id, "resend")}
                        disabled={busy}
                        className="text-accent hover:underline disabled:opacity-50"
                      >
                        {row.status === "sent" ? "Resend link" : "Send for signature"}
                      </button>
                    )}
                    {row.status === "sent" && (
                      <button
                        onClick={() => runAction(row.id, "decline")}
                        disabled={busy}
                        className="text-muted hover:text-foreground disabled:opacity-50"
                      >
                        Mark declined
                      </button>
                    )}
                    {row.status !== "voided" &&
                      (confirmingVoidId === row.id ? (
                        <span className="flex items-center gap-2">
                          <span className="text-muted">Void this document?</span>
                          <button
                            onClick={() => runAction(row.id, "void")}
                            disabled={busy}
                            className="text-red-600 hover:underline disabled:opacity-50"
                          >
                            Yes, void
                          </button>
                          <button
                            onClick={() => setConfirmingVoidId(null)}
                            className="text-muted hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmingVoidId(row.id)}
                          disabled={busy}
                          className="text-muted hover:text-red-600 disabled:opacity-50"
                        >
                          Void
                        </button>
                      ))}
                  </div>

                  {row.status === "signed" && row.signatureImage && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted">Drawn signature</span>
                      {/* eslint-disable-next-line @next/next/no-img-element -- a stored data: URL, not an optimizable remote/local asset */}
                      <img
                        src={row.signatureImage}
                        alt={`Signature of ${row.signerName ?? "signer"}`}
                        className="h-16 w-fit rounded border border-black/10 bg-white dark:border-white/10"
                      />
                    </div>
                  )}
                  {signUrl && (
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-black/[0.03] px-3 py-2 dark:bg-white/[0.05]">
                        <code className="min-w-0 flex-1 truncate font-mono text-xs">{signUrl}</code>
                        <button
                          onClick={() => copyLink(row.id, signUrl)}
                          className="text-xs text-accent hover:underline"
                        >
                          {copiedId === row.id ? "Copied" : "Copy link"}
                        </button>
                      </div>
                      <p className="text-xs text-muted">
                        {emailedTo[row.id]
                          ? `Emailed to ${emailedTo[row.id]}. Also copy the link above if you'd rather send it another way.`
                          : "No client email on file (or email isn't configured) — copy the link above and send it yourself."}
                      </p>
                    </div>
                  )}
                  {row.status === "sent" && !signUrl && (
                    <p className="text-xs text-muted">
                      A link was issued for this document. Use &ldquo;Resend link&rdquo; to get a
                      fresh one — the previous link stops working when you do.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
