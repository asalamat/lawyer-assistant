"use client";

const STORAGE_KEY = "pdfExport";

export default function ExportPdfButton({
  title,
  content,
  className = "btn-secondary px-3 py-1.5 text-sm",
}: {
  title: string;
  content: string;
  className?: string;
}) {
  return (
    <a
      href="/export/pdf"
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        // Written synchronously in the click handler, before the browser
        // navigates — localStorage (not sessionStorage) so it's readable
        // in the new tab regardless of how that tab was opened. See the
        // evidence graph's "open in new tab" fix for why this distinction
        // matters: a real <a target="_blank"> click is "following a
        // link," not a script-initiated window, so sessionStorage would
        // not carry over.
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, content }));
      }}
      className={className}
    >
      Export PDF
    </a>
  );
}
