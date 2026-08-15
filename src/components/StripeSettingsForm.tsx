"use client";

import { useState } from "react";

interface StripeStatus {
  configured: boolean;
  publishableKey: string | null;
}

export default function StripeSettingsForm({ initialStatus }: { initialStatus: StripeStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [secretKey, setSecretKey] = useState("");
  const [publishableKey, setPublishableKey] = useState(initialStatus.publishableKey ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey, publishableKey }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save Stripe settings");
      setStatus(body);
      setSecretKey("");
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
      const res = await fetch("/api/settings/stripe/test");
      const body = await res.json();
      setTestResult(
        body.ok ? { ok: true, message: "Connected successfully." } : { ok: false, message: body.error ?? "Connection failed." },
      );
    } catch {
      setTestResult({ ok: false, message: "Connection failed." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card flex flex-col gap-3">
      <div>
        <h3 className="font-medium">Stripe</h3>
        <p className="text-sm text-muted">
          {status.configured
            ? "Configured. Re-enter the Secret key to change it."
            : "Create a Stripe account, then enter its API keys here."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Secret key</span>
          <input
            required
            type="password"
            autoComplete="off"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder={status.configured ? "•••••••• (re-enter to save)" : "sk_live_… or sk_test_…"}
            className="surface-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Publishable key</span>
          <input
            required
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
            placeholder="pk_live_… or pk_test_…"
            className="surface-input"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}
      {testResult && (
        <p className={`text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}>{testResult.message}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary self-start">
          {saving ? "Saving…" : "Save Stripe settings"}
        </button>
        {status.configured && (
          <button type="button" onClick={handleTest} disabled={testing} className="btn-secondary self-start">
            {testing ? "Testing…" : "Test connection"}
          </button>
        )}
      </div>
    </form>
  );
}
