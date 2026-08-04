"use client";

import { useState } from "react";
import type { IndependentReview } from "@/lib/types";
import ExportPdfButton from "./ExportPdfButton";
import MarkdownContent from "./MarkdownContent";

interface GeneratedDoc {
  id: string;
  content: string;
}

export default function GeneratedDocPanel({
  title,
  apiPath,
  initialDoc,
  emptyMessage,
  matterId,
  sourceType,
  initialReviews = [],
}: {
  title: string;
  apiPath: string;
  initialDoc: GeneratedDoc | null;
  emptyMessage: string;
  matterId: string;
  sourceType: IndependentReview["sourceType"];
  initialReviews?: IndependentReview[];
}) {
  const [doc, setDoc] = useState(initialDoc);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState(initialReviews);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const currentReview = doc ? reviews.find((r) => r.sourceId === doc.id) : undefined;

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

  async function handleReview() {
    if (!doc) return;
    setReviewing(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/independent-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, sourceId: doc.id, content: doc.content }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to get independent review");
      setReviews((prev) => [body, ...prev]);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">{title}</h2>
        <div className="flex items-center gap-2">
          {doc && <ExportPdfButton title={title} content={doc.content} />}
          <button onClick={handleGenerate} disabled={generating} className="btn-primary px-3 py-1.5">
            {generating ? "Generating…" : doc ? "Regenerate" : "Generate"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {doc ? (
        <>
          <MarkdownContent content={doc.content} />
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted">
              {currentReview ? "Reviewed by Gemini" : "No independent review yet"}
            </span>
            <button
              onClick={handleReview}
              disabled={reviewing}
              className="btn-secondary px-3 py-1.5 text-sm"
            >
              {reviewing ? "Reviewing…" : currentReview ? "Re-review" : "Get independent review"}
            </button>
          </div>
          {reviewError && <p className="text-sm text-red-600">{reviewError}</p>}
          {currentReview && (
            <div className="surface-row text-sm">
              <p className="mb-1 text-xs font-medium text-muted">Independent review (Gemini)</p>
              <MarkdownContent content={currentReview.content} />
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">{emptyMessage}</p>
      )}
    </div>
  );
}
