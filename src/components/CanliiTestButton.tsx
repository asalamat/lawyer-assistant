"use client";

import { useState } from "react";

export default function CanliiTestButton() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/settings/canlii/test");
      const body = await res.json();
      if (body.ok) {
        setResult({ ok: true, message: `Connected — ${body.databaseCount} case databases available.` });
      } else {
        setResult({ ok: false, message: body.error ?? "Connection failed." });
      }
    } catch {
      setResult({ ok: false, message: "Connection failed." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button onClick={handleTest} disabled={testing} className="btn-secondary self-start">
        {testing ? "Testing…" : "Test connection"}
      </button>
      {result && (
        <p className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>{result.message}</p>
      )}
    </div>
  );
}
