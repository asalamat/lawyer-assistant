"use client";

import { useState } from "react";
import type { LegislationWatch } from "@/lib/types";

export default function LegislationWatchPanel({
  initialWatches,
  cronSecret,
}: {
  initialWatches: LegislationWatch[];
  cronSecret: string;
}) {
  const [watches, setWatches] = useState(initialWatches);
  const [databaseId, setDatabaseId] = useState("");
  const [legislationId, setLegislationId] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<{ id: string; message: string } | null>(null);
  const [showCron, setShowCron] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/legislation-watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseId, legislationId, label }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add watch");
      setWatches((prev) => [body, ...prev]);
      setDatabaseId("");
      setLegislationId("");
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setWatches((prev) => prev.filter((w) => w.id !== id));
    await fetch(`/api/legislation-watches/${id}`, { method: "DELETE" });
  }

  async function handleCheck(id: string) {
    setCheckingId(id);
    setCheckResult(null);
    try {
      const res = await fetch(`/api/legislation-watches/${id}/check`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Check failed");
      setWatches((prev) => prev.map((w) => (w.id === id ? body.watch : w)));
      setCheckResult({
        id,
        message: body.error
          ? `Check failed: ${body.error}`
          : body.changed
            ? "Changed since last check."
            : "No change detected.",
      });
    } catch (err) {
      setCheckResult({ id, message: err instanceof Error ? err.message : "Check failed" });
    } finally {
      setCheckingId(null);
    }
  }

  const cronCommand = `curl -X POST https://YOUR-APP-URL/api/legislation-watches/check-all -H "Authorization: Bearer ${cronSecret}"`;

  return (
    <div className="surface-card flex flex-col gap-3">
      <div>
        <h3 className="font-medium">Legislation watches</h3>
        <p className="text-sm text-muted">
          Add a specific statute/regulation to watch for changes (repeal status, effective
          dates, or section structure — CanLII&apos;s API doesn&apos;t expose the actual statute
          text, so in-place wording changes to an existing section can&apos;t be detected this
          way). Requires a CanLII key above.
        </p>
      </div>

      <form onSubmit={handleAdd} className="grid gap-2 sm:grid-cols-4">
        <input
          required
          placeholder="Database ID (e.g. cccc)"
          value={databaseId}
          onChange={(e) => setDatabaseId(e.target.value)}
          className="surface-input"
        />
        <input
          required
          placeholder="Legislation ID"
          value={legislationId}
          onChange={(e) => setLegislationId(e.target.value)}
          className="surface-input"
        />
        <input
          required
          placeholder="Label (e.g. Criminal Code)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="surface-input"
        />
        <button type="submit" disabled={adding} className="btn-primary">
          {adding ? "Adding…" : "Add watch"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {watches.length === 0 ? (
        <p className="text-sm text-muted">No legislation watches yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {watches.map((watch) => (
            <li key={watch.id} className="surface-row flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{watch.label}</p>
                  <p className="text-xs text-muted">
                    {watch.databaseId}/{watch.legislationId}
                    {watch.lastCheckedAt &&
                      ` · last checked ${new Date(watch.lastCheckedAt).toLocaleString()}`}
                    {watch.lastChangedAt &&
                      ` · last changed ${new Date(watch.lastChangedAt).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => handleCheck(watch.id)}
                    disabled={checkingId === watch.id}
                    className="btn-secondary px-2 py-1 text-xs"
                  >
                    {checkingId === watch.id ? "Checking…" : "Check now"}
                  </button>
                  <button
                    onClick={() => handleDelete(watch.id)}
                    className="text-xs text-muted hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {checkResult?.id === watch.id && (
                <p className="text-xs text-accent">{checkResult.message}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setShowCron((prev) => !prev)}
        className="self-start text-xs text-accent hover:underline"
      >
        {showCron ? "Hide" : "Show"} unattended-checking setup
      </button>
      {showCron && (
        <div className="surface-row text-xs">
          <p className="mb-1 text-muted">
            To check all watches automatically on a schedule, set up an OS-level cron job (this
            app has no built-in background scheduler) hitting this endpoint with your cron
            secret:
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-black/[0.04] p-2 dark:bg-white/[0.06]">
            {cronCommand}
          </pre>
        </div>
      )}
    </div>
  );
}
