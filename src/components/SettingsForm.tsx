"use client";

import { useState } from "react";

interface KeyStatus {
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}

export default function SettingsForm({ initialStatus }: { initialStatus: KeyStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicApiKey: apiKey }),
      });
      if (!res.ok) throw new Error("Failed to save key");
      const nextStatus: KeyStatus = await res.json();
      setStatus(nextStatus);
      setApiKey("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div>
        <h2 className="font-medium">Anthropic API key</h2>
        <p className="text-sm text-zinc-500">
          {status.configured
            ? `Currently configured (${status.preview}, from ${status.source === "settings" ? "settings" : ".env.local"}). Enter a new key below to replace it.`
            : "No API key configured yet."}
        </p>
      </div>
      <input
        type="password"
        autoComplete="off"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-ant-..."
        className="rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved. Takes effect immediately, no restart needed.</p>}
      <button
        type="submit"
        disabled={saving || !apiKey.trim()}
        className="self-start rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save key"}
      </button>
    </form>
  );
}
