"use client";

import { useState } from "react";

interface GeneratedDoc {
  content: string;
}

export default function GeneratedDocPanel({
  title,
  apiPath,
  initialDoc,
  emptyMessage,
}: {
  title: string;
  apiPath: string;
  initialDoc: GeneratedDoc | null;
  emptyMessage: string;
}) {
  const [doc, setDoc] = useState(initialDoc);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(apiPath, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate");
      setDoc(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">{title}</h2>
        <button onClick={handleGenerate} disabled={generating} className="btn-primary px-3 py-1.5">
          {generating ? "Generating…" : doc ? "Regenerate" : "Generate"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {doc ? (
        <div className="whitespace-pre-wrap text-sm">{doc.content}</div>
      ) : (
        <p className="text-sm text-muted">{emptyMessage}</p>
      )}
    </div>
  );
}
