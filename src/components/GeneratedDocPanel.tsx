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
    <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
        >
          {generating ? "Generating…" : doc ? "Regenerate" : "Generate"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {doc ? (
        <div className="whitespace-pre-wrap text-sm">{doc.content}</div>
      ) : (
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      )}
    </div>
  );
}
