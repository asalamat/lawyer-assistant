"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ClassificationSuggestionBanner from "./ClassificationSuggestionBanner";
import type { MatterClassification } from "@/lib/types";

interface ZipImportResult {
  fileName: string;
  status: "uploaded" | "failed";
  documentId?: string;
  error?: string;
}

interface ClassificationSuggestion {
  classification: MatterClassification;
  reason: string;
}

interface ZipImportResponse {
  results: ZipImportResult[];
  newDeadlines: number;
  classificationSuggestion: ClassificationSuggestion | null;
}

export default function UploadDropzone({
  matterId,
  uploadUrl,
  onUploaded,
}: {
  matterId?: string;
  uploadUrl?: string;
  onUploaded?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zipResults, setZipResults] = useState<ZipImportResult[] | null>(null);
  const [newDeadlines, setNewDeadlines] = useState(0);
  const [classificationSuggestion, setClassificationSuggestion] =
    useState<ClassificationSuggestion | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const url = uploadUrl ?? `/api/matters/${matterId}/documents`;
  // Bulk zip import only makes sense for a matter's own documents — the
  // reference library and other callers of this component pass their own
  // uploadUrl and don't get this behaviour.
  const zipImportUrl = matterId ? `/api/matters/${matterId}/documents/import-zip` : null;

  async function uploadZip(file: globalThis.File): Promise<{ newDeadlines: number; classificationSuggestion: ClassificationSuggestion | null }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(zipImportUrl!, { method: "POST", body: formData });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `Failed to import ${file.name}`);
    const { results, newDeadlines, classificationSuggestion } = body as ZipImportResponse;
    setZipResults(results);
    return { newDeadlines, classificationSuggestion };
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setZipResults(null);
    setNewDeadlines(0);
    setClassificationSuggestion(null);
    let foundDeadlines = 0;
    let foundSuggestion: ClassificationSuggestion | null = null;
    try {
      for (const file of Array.from(files)) {
        if (zipImportUrl && file.name.toLowerCase().endsWith(".zip")) {
          const result = await uploadZip(file);
          foundDeadlines += result.newDeadlines;
          if (result.classificationSuggestion) foundSuggestion = result.classificationSuggestion;
          continue;
        }
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(url, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
        const body = await res.json().catch(() => null);
        if (typeof body?.newDeadlines === "number") foundDeadlines += body.newDeadlines;
        if (body?.classificationSuggestion) foundSuggestion = body.classificationSuggestion;
      }
      setNewDeadlines(foundDeadlines);
      setClassificationSuggestion(foundSuggestion);
      if (onUploaded) onUploaded();
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
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
        <p>
          {uploading
            ? "Uploading…"
            : zipImportUrl
              ? "Drag files here or click to upload — a .zip is unpacked and each file imported individually"
              : "Drag files here or click to upload"}
        </p>
        {error && <p className="text-red-600">{error}</p>}
      </div>

      {matterId && classificationSuggestion && (
        <ClassificationSuggestionBanner matterId={matterId} suggestion={classificationSuggestion} />
      )}

      {newDeadlines > 0 && (
        <p className="mt-2 text-xs text-muted">
          Found {newDeadlines} new deadline{newDeadlines === 1 ? "" : "s"} in the uploaded
          document{newDeadlines === 1 ? "" : "s"}.
          {matterId && (
            <>
              {" "}
              <Link href={`/matters/${matterId}/deadlines`} className="text-accent hover:underline">
                View
              </Link>
              .
            </>
          )}
        </p>
      )}

      {zipResults && (
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {zipResults.map((r, i) => (
            <li key={`${r.fileName}-${i}`} className={r.status === "failed" ? "text-red-600" : "text-muted"}>
              {r.status === "uploaded" ? "✓" : "✗"} {r.fileName}
              {r.error ? ` — ${r.error}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
