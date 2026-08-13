"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { IndependentReview } from "@/lib/types";
import ExportPdfButton from "./ExportPdfButton";
import MarkdownContent from "./MarkdownContent";
import TranslateButton from "./TranslateButton";

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
  initialUnverifiedCitations = [],
}: {
  title: string;
  apiPath: string;
  initialDoc: GeneratedDoc | null;
  emptyMessage: string;
  matterId: string;
  sourceType: IndependentReview["sourceType"];
  initialReviews?: IndependentReview[];
  // Deterministic quality-control check (see citationCheck.ts /
  // getKnownFilenames) — filenames this document cites that don't match
  // any real document/attached reference material for this matter.
  initialUnverifiedCitations?: string[];
}) {
  const router = useRouter();
  const [doc, setDoc] = useState(initialDoc);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState(initialReviews);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [unverifiedCitations, setUnverifiedCitations] = useState(initialUnverifiedCitations);

  const currentReview = doc ? reviews.find((r) => r.sourceId === doc.id) : undefined;

  // Keeps this component's state in sync when the server-rendered props
  // change without a full remount — specifically, router.refresh() below,
  // fired once a generation started elsewhere (another tab, or before the
  // user navigated away and came back) is detected to have finished.
  // Adjusted during render (React's documented pattern for this), not in
  // an effect, so it doesn't cost an extra render pass.
  const [prevInitialDoc, setPrevInitialDoc] = useState(initialDoc);
  if (initialDoc !== prevInitialDoc) {
    setPrevInitialDoc(initialDoc);
    setDoc(initialDoc);
    setUnverifiedCitations(initialUnverifiedCitations);
    setReviews(initialReviews);
  }

  // On mount, check whether a generation for this matter+feature is
  // already running (started before this page loaded, e.g. the user
  // navigated away mid-generation and came back). If so, poll until it
  // finishes, then pull in the fresh result via router.refresh() rather
  // than re-deriving unverifiedCitations/reviews client-side — that
  // computation already lives server-side in each page.tsx.
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let wasInProgress = false;

    async function checkStatus() {
      const res = await fetch(`/api/matters/${matterId}/generation-status?type=${sourceType}`);
      const status = await res.json().catch(() => ({ inProgress: false }));
      if (cancelled) return;

      if (status.inProgress) {
        wasInProgress = true;
        setGenerating(true);
        if (!interval) interval = setInterval(checkStatus, 3000);
      } else if (wasInProgress) {
        wasInProgress = false;
        setGenerating(false);
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
        router.refresh();
      }
    }

    checkStatus();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [matterId, sourceType, router]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(apiPath, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate");
      setDoc(body);
      setUnverifiedCitations(body.unverifiedCitations ?? []);
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
      {unverifiedCitations.length > 0 && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          Quality check: this cites {unverifiedCitations.length === 1 ? "a file" : "files"} that{" "}
          {unverifiedCitations.length === 1 ? "doesn't" : "don't"} match any real document in this
          matter — {unverifiedCitations.join(", ")}. Review before relying on that part.
        </p>
      )}
      {doc ? (
        <>
          <MarkdownContent content={doc.content} />
          <TranslateButton content={doc.content} />
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted">
              {currentReview ? "Independent review complete" : "No independent review yet"}
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
            <div className="surface-row flex flex-col gap-2 text-sm">
              <p className="mb-1 text-xs font-medium text-muted">Independent review</p>
              <MarkdownContent content={currentReview.content} />
              <TranslateButton content={currentReview.content} />
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">{emptyMessage}</p>
      )}
    </div>
  );
}
