"use client";

import { useState } from "react";

const STORAGE_KEY = "pdfExport";

export default function MatterFullReportButton({
  matterId,
  clientEmail,
  emailConfigured,
}: {
  matterId: string;
  clientEmail: string | null;
  emailConfigured: boolean;
}) {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleDownload() {
    setDownloadError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/report`);
      const report = await res.json();
      if (!res.ok) throw new Error(report.error ?? "Failed to build report");
      if (report.sections.length === 0) {
        setDownloadError("Nothing generated for this matter yet — there's nothing to include.");
        return;
      }
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ title: `${report.matterTitle} — Full matter report`, sections: report.sections }),
      );
      window.open("/export/pdf", "_blank", "noopener,noreferrer");
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleEmail() {
    let to = clientEmail ?? "";
    if (!to) {
      const entered = window.prompt("Email the full report to which address?");
      if (!entered) return;
      to = entered;
    }
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/report/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to send report");
      setSendResult({ ok: true, message: `Sent to ${body.to}.` });
    } catch (err) {
      setSendResult({ ok: false, message: err instanceof Error ? err.message : "Failed to send report" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button onClick={handleDownload} className="btn-secondary shrink-0 px-3 py-1.5 text-sm">
          Download full report
        </button>
        {emailConfigured && (
          <button onClick={handleEmail} disabled={sending} className="btn-secondary shrink-0 px-3 py-1.5 text-sm">
            {sending ? "Sending…" : "Email to client"}
          </button>
        )}
      </div>
      {downloadError && <p className="text-xs text-red-600">{downloadError}</p>}
      {sendResult && (
        <p className={`text-xs ${sendResult.ok ? "text-emerald-600" : "text-red-600"}`}>{sendResult.message}</p>
      )}
    </div>
  );
}
