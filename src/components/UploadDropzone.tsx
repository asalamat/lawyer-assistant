"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function UploadDropzone({ matterId }: { matterId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/matters/${matterId}/documents`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
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
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${
        dragActive
          ? "border-foreground bg-black/[.03] dark:bg-white/[.05]"
          : "border-black/15 dark:border-white/15"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />
      <p>{uploading ? "Uploading…" : "Drag files here or click to upload"}</p>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
