"use client";

import { useState } from "react";

interface OllamaStatus {
  configured: boolean;
  baseUrl: string;
  model: string;
}

export default function OllamaSettingsForm({ initialStatus }: { initialStatus: OllamaStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [baseUrl, setBaseUrl] = useState(initialStatus.baseUrl);
  const [model, setModel] = useState(initialStatus.model);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: true; models: string[] } | { ok: false; error: string } | null
  >(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, model }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setStatus(body);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/settings/ollama/test?baseUrl=${encodeURIComponent(baseUrl)}`);
      const body = await res.json();
      setTestResult(body);
    } catch {
      setTestResult({ ok: false, error: "Connection failed." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card flex flex-col gap-3">
      <div>
        <h3 className="font-medium">Ollama (local model, backup provider)</h3>
        <p className="text-sm text-muted">
          {status.configured
            ? `Configured to use "${status.model}" at ${status.baseUrl}.`
            : "Not configured yet."}{" "}
          Runs entirely on this machine — no account, no cost, nothing sent to a third party.
          Requires{" "}
          <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-accent underline">
            Ollama
          </a>{" "}
          installed and running locally, with at least one model already pulled (e.g.{" "}
          <code>ollama pull llama3.1</code>).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Base URL</span>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="surface-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Model name</span>
          <input
            required
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="llama3.1"
            className="surface-input"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}
      {testResult && (
        <p className={`text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
          {testResult.ok
            ? testResult.models.length > 0
              ? `Connected. Models available locally: ${testResult.models.join(", ")}.`
              : "Connected, but no models are pulled yet — run `ollama pull <model>` first."
            : testResult.error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary self-start">
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={handleTest} disabled={testing} className="btn-secondary self-start">
          {testing ? "Testing…" : "Test connection"}
        </button>
      </div>
    </form>
  );
}
