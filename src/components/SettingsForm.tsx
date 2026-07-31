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
    <form onSubmit={handleSubmit} className="surface-card flex flex-col gap-3">
      <div>
        <h3 className="font-medium">Anthropic API key</h3>
        <p className="text-sm text-muted">
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
        className="surface-input"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved. Takes effect immediately, no restart needed.</p>}
      <button type="submit" disabled={saving || !apiKey.trim()} className="btn-primary self-start">
        {saving ? "Saving…" : "Save key"}
      </button>
    </form>
  );
}
