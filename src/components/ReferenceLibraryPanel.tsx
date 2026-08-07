"use client";

import { useRef, useState } from "react";
import {
  REFERENCE_DOCUMENT_CATEGORIES,
  REFERENCE_DOCUMENT_CATEGORY_LABELS,
  type ReferenceDocument,
  type ReferenceDocumentCategory,
} from "@/lib/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReferenceLibraryPanel({
  initialDocuments,
  canApprove,
}: {
  initialDocuments: ReferenceDocument[];
  canApprove: boolean;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState<ReferenceDocumentCategory>("firm_knowledge");
  const inputRef = useRef<HTMLInputElement>(null);

  const pending = documents.filter((doc) => !doc.approved);
  const approved = documents.filter((doc) => doc.approved);

  async function handleApprove(id: string) {
    setApprovingId(id);
    try {
      const res = await fetch(`/api/reference-library/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to approve");
      }
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === id ? { ...doc, approved: 1 } : doc)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setApprovingId(null);
    }
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", uploadCategory);
        const res = await fetch("/api/reference-library", { method: "POST", body: formData });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Failed to upload ${file.name}`);
        setDocuments((prev) => [body, ...prev]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    await fetch(`/api/reference-library/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">New uploads are:</span>
        {REFERENCE_DOCUMENT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setUploadCategory(cat)}
            className={
              uploadCategory === cat
                ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                : "rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:text-foreground"
            }
          >
            {REFERENCE_DOCUMENT_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          void upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors ${
          dragActive ? "border-accent bg-accent/[0.05]" : "border-border"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void upload(e.target.files)}
        />
        <p>{uploading ? "Uploading…" : "Drag statutes, cases, or other reference material here"}</p>
        {error && <p className="text-red-600">{error}</p>}
      </div>

      {documents.length === 0 && (
        <p className="text-sm text-muted">
          No reference documents yet. Upload statutes, key cases, or other material you want
          available to attach across multiple matters.
        </p>
      )}

      {pending.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-lg">Pending approval ({pending.length})</h2>
          <ul className="flex flex-col gap-2">
            {pending.map((doc) => (
              <li key={doc.id} className="surface-row flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    {doc.fileName}
                    <span className="badge ml-2">{REFERENCE_DOCUMENT_CATEGORY_LABELS[doc.category]}</span>
                  </span>
                  <span className="flex items-center gap-3 text-muted">
                    {formatBytes(doc.sizeBytes)}
                    {canApprove && (
                      <button
                        onClick={() => handleApprove(doc.id)}
                        disabled={approvingId === doc.id}
                        className="text-xs text-accent underline decoration-accent/40 disabled:opacity-50"
                      >
                        {approvingId === doc.id ? "Approving…" : "Approve"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-xs text-muted hover:text-red-600"
                      aria-label="Delete reference document"
                    >
                      Remove
                    </button>
                  </span>
                </div>
                {doc.sensitivityFlag && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    ⚠ {doc.sensitivityFlag}
                  </p>
                )}
                <p className="text-xs text-muted">Not attachable to any matter until approved.</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {approved.length > 0 && (
        <div>
          {pending.length > 0 && <h2 className="mb-2 font-display text-lg">Approved</h2>}
          <ul className="flex flex-col gap-2">
            {approved.map((doc) => (
              <li key={doc.id} className="surface-row flex items-center justify-between text-sm">
                <span>
                  {doc.fileName}
                  <span className="badge ml-2">{REFERENCE_DOCUMENT_CATEGORY_LABELS[doc.category]}</span>
                </span>
                <span className="flex items-center gap-3 text-muted">
                  {formatBytes(doc.sizeBytes)}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-xs text-muted hover:text-red-600"
                    aria-label="Delete reference document"
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
