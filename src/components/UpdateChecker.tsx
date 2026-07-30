"use client";

import { useEffect, useState } from "react";

interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  date: string;
}

interface UpdateStatus {
  branch: string;
  current: CommitInfo | null;
  latest: CommitInfo | null;
  commitsBehind: number;
  upToDate: boolean;
  error: string | null;
}

export default function UpdateChecker() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<string | null>(null);

  async function checkStatus() {
    try {
      const res = await fetch("/api/system/update");
      setStatus(await res.json());
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    checkStatus();
  }, []);

  async function handlePull() {
    setPulling(true);
    setPullResult(null);
    try {
      const res = await fetch("/api/system/update", { method: "POST" });
      const result = await res.json();
      setPullResult(result.message);
      if (result.success) await checkStatus();
    } finally {
      setPulling(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <h2 className="font-medium">Software updates</h2>

      {checking ? (
        <p className="text-sm text-zinc-500">Checking for updates…</p>
      ) : status?.error ? (
        <p className="text-sm text-red-600">Could not check for updates: {status.error}</p>
      ) : status?.upToDate ? (
        <p className="text-sm text-zinc-500">
          Up to date on <code>{status.branch}</code> ({status.current?.shortSha}: {status.current?.message})
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-500">
            {status?.commitsBehind} commit{status?.commitsBehind === 1 ? "" : "s"} behind{" "}
            <code>origin/{status?.branch}</code>. Latest: {status?.latest?.shortSha} —{" "}
            {status?.latest?.message}
          </p>
          <button
            onClick={handlePull}
            disabled={pulling}
            className="self-start rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
          >
            {pulling ? "Pulling…" : "Pull latest"}
          </button>
        </div>
      )}

      {pullResult && <p className="text-sm">{pullResult}</p>}

      {status && !status.error && (
        <p className="text-xs text-zinc-500">
          Note: pulling updates the source on disk. In dev mode changes hot-reload automatically;
          a production server (<code>next start</code>) needs a manual restart to pick up the new build.
        </p>
      )}
    </div>
  );
}
