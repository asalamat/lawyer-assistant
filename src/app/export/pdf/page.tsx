"use client";

import { useEffect, useState } from "react";
import MarkdownContent from "@/components/MarkdownContent";

const STORAGE_KEY = "pdfExport";

interface ExportPayload {
  title: string;
  content: string;
}

// Chromeless (see isChromelessRoute) — a clean, print-formatted view of one
// generated document. "Export PDF" is just the browser's native print
// dialog with a destination of "Save as PDF": no PDF-generation library
// needed, and print CSS gives full control over the output without a
// second rendering pipeline to keep in sync with MarkdownContent.
export default function ExportPdfPage() {
  const [payload, setPayload] = useState<ExportPayload | null | "missing">(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setPayload(raw ? JSON.parse(raw) : "missing");
    });
  }, []);

  if (payload === null) return null;

  if (payload === "missing") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted">
          No document data found in this tab. Use &quot;Export PDF&quot; from the document again.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-8 py-10 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-muted">Review below, then print or save as PDF.</p>
        <button onClick={() => window.print()} className="btn-primary px-3 py-1.5 text-sm">
          Print / Save as PDF
        </button>
      </div>
      <div>
        <h1 className="font-display text-2xl italic">{payload.title}</h1>
        <p className="mt-1 text-xs text-muted print:hidden">
          Generated {new Date().toLocaleString()} — AI-generated content, review before relying on
          it.
        </p>
      </div>
      <MarkdownContent content={payload.content} />
    </main>
  );
}
