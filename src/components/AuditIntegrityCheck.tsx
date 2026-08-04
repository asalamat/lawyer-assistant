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

  async function handleVerify() {
    setChecking(true);
    try {
      const res = await fetch("/api/audit/verify");
      if (res.ok) setResult(await res.json());
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <button onClick={handleVerify} disabled={checking} className="btn-secondary">
        {checking ? "Verifying…" : "Verify log integrity"}
      </button>
      {result && (
        <span className={result.valid ? "text-green-600" : "text-red-600 font-medium"}>
          {result.valid
            ? `Intact — ${result.checkedCount} entries, hash chain unbroken`
            : `Tampering detected near entry ${result.brokenAtId}`}
        </span>
      )}
    </div>
  );
}
