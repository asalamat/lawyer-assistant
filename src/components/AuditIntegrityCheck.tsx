"use client";

import { useState } from "react";

interface Result {
  valid: boolean;
  checkedCount: number;
  brokenAtId: string | null;
}

export default function AuditIntegrityCheck() {
  const [result, setResult] = useState<Result | null>(null);
  const [checking, setChecking] = useState(false);
  const [reanchoring, setReanchoring] = useState(false);
  const [reason, setReason] = useState("");
  const [showReanchor, setShowReanchor] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleVerify() {
    setChecking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/audit/verify");
      if (res.ok) setResult(await res.json());
    } finally {
      setChecking(false);
    }
  }

  async function handleReanchor() {
    setReanchoring(true);
    try {
      const res = await fetch("/api/audit/reanchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to re-anchor");
      setMessage(`Re-anchored ${body.reanchoredCount} entries. Recorded permanently in the log.`);
      setShowReanchor(false);
      setReason("");
      await handleVerify();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setReanchoring(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-3">
        <button onClick={handleVerify} disabled={checking} className="btn-secondary">
          {checking ? "Verifying…" : "Verify log integrity"}
        </button>
        {result && (
          <span className={result.valid ? "text-green-600" : "text-red-600 font-medium"}>
            {result.valid
              ? `Intact — ${result.checkedCount} entries, hash chain unbroken`
              : `Chain broken near entry ${result.brokenAtId} — investigate before re-anchoring`}
          </span>
        )}
        {result && !result.valid && !showReanchor && (
          <button
            onClick={() => setShowReanchor(true)}
            className="text-xs text-accent underline decoration-accent/40"
          >
            Re-anchor…
          </button>
        )}
      </div>
      {showReanchor && (
        <div className="surface-row flex flex-col gap-2 border-amber-500/40 bg-amber-500/10">
          <p className="text-xs">
            Only re-anchor once you know <em>why</em> the chain broke (e.g. a bug you&apos;ve
            fixed) — this makes past damage stop flagging as broken on every future check, but the
            reason you give is the only record of why, permanently recorded as the next log entry.
          </p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why did the chain break? (required, recorded permanently)"
            className="surface-input"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReanchor}
              disabled={!reason.trim() || reanchoring}
              className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {reanchoring ? "Re-anchoring…" : "Re-anchor now"}
            </button>
            <button onClick={() => setShowReanchor(false)} className="btn-secondary px-3 py-1.5 text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  );
}
