function Step({
  title,
  detail,
  tone = "default",
}: {
  title: string;
  detail: string;
  tone?: "default" | "success" | "failure";
}) {
  return (
    <div
      className={`surface-row flex min-w-[10rem] flex-1 flex-col gap-1 text-center ${
        tone === "success"
          ? "border-emerald-600/30"
          : tone === "failure"
            ? "border-red-600/30"
            : ""
      }`}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted">{detail}</span>
    </div>
  );
}

function Arrow({ direction = "right" }: { direction?: "right" | "down" }) {
  return (
    <span className="flex shrink-0 items-center justify-center text-muted" aria-hidden>
      {direction === "right" ? "→" : "↓"}
    </span>
  );
}

// Visual walkthrough of what happens between dropping a file and it being
// either chat-ready or flagged for review — referenced from the
// "document-upload" Help topic. Plain flex/Tailwind rather than SVG, same
// as the rest of this app's non-chart UI, so it inherits theme tokens
// (light/dark, accent color) for free instead of hardcoding colors.
export default function UploadProcessDiagram() {
  return (
    <div className="surface-card flex flex-col gap-4">
      <p className="text-xs font-medium text-muted">How a document moves through the app</p>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <Step title="1. Upload" detail="Drag-and-drop, or a file inside an uploaded .zip" />
        <Arrow direction="right" />
        <Step
          title="2. Duplicate check"
          detail="Exact byte-for-byte match against this matter's other files (instant)"
        />
        <Arrow direction="right" />
        <Step title="3. Text extraction" detail="PDF / Word / OCR / transcription, depending on file type" />
      </div>

      <div className="flex items-center justify-center gap-2">
        <Arrow direction="down" />
        <span className="text-xs text-muted">then, depending on the result of step 3:</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-emerald-600/20 bg-emerald-600/[0.04] p-3">
          <span className="badge-accent self-start">Extraction succeeded</span>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Step
              tone="success"
              title="4a. Chunk & embed"
              detail="Split into passages, each turned into a vector for retrieval"
            />
            <Arrow direction="right" />
            <Step
              tone="success"
              title="5a. Near-duplicate check"
              detail="Compared against other documents in the matter by content similarity"
            />
          </div>
          <p className="text-xs text-muted">
            → Readable by chat, digests, drafts, and every other AI feature. Shows a{" "}
            <span className="badge">chat-readable</span>{" "}
            badge on the matter&apos;s Overview tab.
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-red-600/20 bg-red-600/[0.04] p-3">
          <span className="rounded-full bg-red-600/10 px-2 py-0.5 self-start text-xs text-red-700 dark:text-red-400">
            Extraction failed
          </span>
          <Step
            tone="failure"
            title="4b. Marked for review"
            detail="The real error is recorded, not just swallowed"
          />
          <p className="text-xs text-muted">
            → Shows an <span className="rounded-full bg-red-600/10 px-1.5 py-0.5 text-red-700 dark:text-red-400">extraction failed</span>{" "}
            badge on Overview (hover it for the error) with a <strong>Retry</strong>{" "}
            button, which re-runs step 3 — useful once you&apos;ve fixed the cause (e.g. re-scanning a corrupt
            PDF) or if a transient issue (e.g. a missing API key for OCR/transcription) has since
            been resolved. Never silently disappears from the document list.
          </p>
        </div>
      </div>
    </div>
  );
}
