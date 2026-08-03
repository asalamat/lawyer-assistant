"use client";

import { useRef, useState } from "react";
import type { ReferenceDocument } from "@/lib/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReferenceLibraryPanel({
  initialDocuments,
}: {
  initialDocuments: ReferenceDocument[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
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

      {documents.length === 0 ? (
        <p className="text-sm text-muted">
          No reference documents yet. Upload statutes, key cases, or other material you want
          available to attach across multiple matters.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li key={doc.id} className="surface-row flex items-center justify-between text-sm">
              <span>{doc.fileName}</span>
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
      )}
    </div>
  );
}
