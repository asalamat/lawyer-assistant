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
}

interface NearDuplicateMatch {
  fileName: string;
  score: number;
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
  const [nearDuplicates, setNearDuplicates] = useState<NearDuplicateMatch[]>([]);
  const [backgroundCheckPending, setBackgroundCheckPending] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const url = uploadUrl ?? `/api/matters/${matterId}/documents`;
  // Bulk zip import only makes sense for a matter's own documents — the
  // reference library and other callers of this component pass their own
  // uploadUrl and don't get this behaviour.
  const zipImportUrl = matterId ? `/api/matters/${matterId}/documents/import-zip` : null;

  async function uploadZip(file: globalThis.File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(zipImportUrl!, { method: "POST", body: formData });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `Failed to import ${file.name}`);
    const { results } = body as ZipImportResponse;
    setZipResults(results);
    // The zip route runs the deadline/classification check in the
    // background rather than blocking this response (it reads the
    // matter's full document corpus, which was taking well over a
    // minute for a large batch) — there's nothing to show immediately.
    if (results.some((r) => r.status === "uploaded")) setBackgroundCheckPending(true);
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setZipResults(null);
    setNewDeadlines(0);
    setClassificationSuggestion(null);
    setNearDuplicates([]);
    setBackgroundCheckPending(false);
    let foundDeadlines = 0;
    let foundSuggestion: ClassificationSuggestion | null = null;
    const foundNearDuplicates: NearDuplicateMatch[] = [];
    try {
      for (const file of Array.from(files)) {
        if (zipImportUrl && file.name.toLowerCase().endsWith(".zip")) {
          await uploadZip(file);
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
        if (body?.nearDuplicate) foundNearDuplicates.push(body.nearDuplicate);
      }
      setNewDeadlines(foundDeadlines);
      setClassificationSuggestion(foundSuggestion);
      setNearDuplicates(foundNearDuplicates);
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

      {nearDuplicates.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-xs text-amber-700 dark:text-amber-400">
          {nearDuplicates.map((match, i) => (
            <li key={`${match.fileName}-${i}`}>
              Near-duplicate ({Math.round(match.score * 100)}% similar) of &quot;{match.fileName}&quot; —
              worth checking whether this is the same document re-uploaded in a different format.
            </li>
          ))}
        </ul>
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

      {backgroundCheckPending && (
        <p className="mt-2 text-xs text-muted">
          Checking for new deadlines and reviewing classification in the background — this can
          take a little while for a large batch.
          {matterId && (
            <>
              {" "}
              <Link href={`/matters/${matterId}/deadlines`} className="text-accent hover:underline">
                Check the Deadlines tab
              </Link>{" "}
              shortly.
            </>
          )}
        </p>
      )}
    </div>
  );
}
