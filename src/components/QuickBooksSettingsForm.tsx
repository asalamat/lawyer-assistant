"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

interface QuickBooksStatus {
  appConfigured: boolean;
  sandbox: boolean;
  connected: boolean;
  companyName: string | null;
  realmId: string | null;
}

export default function QuickBooksSettingsForm({ initialStatus }: { initialStatus: QuickBooksStatus }) {
  const searchParams = useSearchParams();
  const [callbackNotice] = useState(() => ({
    connected: searchParams.get("qbConnected"),
    error: searchParams.get("qbError"),
  }));

  const [status, setStatus] = useState(initialStatus);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [sandbox, setSandbox] = useState(initialStatus.sandbox);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleSaveApp(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/quickbooks/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret, sandbox }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save QuickBooks app credentials");
      setStatus(body);
      setClientSecret("");
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/quickbooks/test");
      const body = await res.json();
      setTestResult(
        body.ok
          ? { ok: true, message: `Connected to ${body.companyName ?? "QuickBooks"}.` }
          : { ok: false, message: body.error ?? "Connection failed." },
      );
    } catch {
      setTestResult({ ok: false, message: "Connection failed." });
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/settings/quickbooks/disconnect", { method: "POST" });
      setStatus(await res.json());
      setTestResult(null);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {callbackNotice.connected && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          Connected to QuickBooks Online.
        </p>
      )}
      {callbackNotice.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {callbackNotice.error}
        </p>
      )}

      <form onSubmit={handleSaveApp} className="surface-card flex flex-col gap-3">
        <div>
          <h3 className="font-medium">QuickBooks app registration</h3>
          <p className="text-sm text-muted">
            {status.appConfigured
              ? "App credentials saved. Re-enter the Client Secret to change any setting."
              : "One-time step: create an app at developer.intuit.com, then enter its Client ID and Secret here."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Client ID</span>
            <input
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="ABxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="surface-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Client Secret</span>
            <input
              required
              type="password"
              autoComplete="off"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={status.appConfigured ? "•••••••• (re-enter to save)" : "client secret"}
              className="surface-input"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
          Sandbox (test) company — uncheck once you&apos;re ready to sync against a real QuickBooks company
        </label>
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        {saved && <p className="text-sm text-green-600">Saved.</p>}
        <button type="submit" disabled={saving} className="btn-primary self-start">
          {saving ? "Saving…" : "Save app credentials"}
        </button>
      </form>

      <div className="surface-card flex flex-col gap-3">
        <div>
          <h3 className="font-medium">Connection</h3>
          <p className="text-sm text-muted">
            {status.connected
              ? `Connected to ${status.companyName ?? "a QuickBooks company"}${status.sandbox ? " (sandbox)" : ""}.`
              : "Not connected yet."}
          </p>
        </div>
        {testResult && (
          <p className={`text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}>{testResult.message}</p>
        )}
        <div className="flex gap-2">
          {status.connected ? (
            <>
              <button onClick={handleTest} disabled={testing} className="btn-secondary self-start px-3 py-1.5 text-xs">
                {testing ? "Testing…" : "Test connection"}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="btn-secondary self-start px-3 py-1.5 text-xs"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </>
          ) : (
            <a
              href={status.appConfigured ? "/api/settings/quickbooks/connect" : undefined}
              aria-disabled={!status.appConfigured}
              className={`btn-primary self-start px-3 py-1.5 text-xs ${!status.appConfigured ? "pointer-events-none opacity-50" : ""}`}
            >
              Connect QuickBooks
            </a>
          )}
        </div>
        {!status.appConfigured && (
          <p className="text-xs text-muted">Save app credentials above before connecting.</p>
        )}
      </div>
    </div>
  );
}
