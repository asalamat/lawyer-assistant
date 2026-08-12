"use client";

import { useState } from "react";

interface DocuSignStatus {
  configured: boolean;
  enabled: boolean;
  integrationKey: string | null;
  userId: string | null;
  accountId: string | null;
  demo: boolean;
}

export default function DocuSignSettingsForm({ initialStatus }: { initialStatus: DocuSignStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [integrationKey, setIntegrationKey] = useState(initialStatus.integrationKey ?? "");
  const [userId, setUserId] = useState(initialStatus.userId ?? "");
  const [accountId, setAccountId] = useState(initialStatus.accountId ?? "");
  const [privateKey, setPrivateKey] = useState("");
  const [demo, setDemo] = useState(initialStatus.demo);
  const [enabled, setEnabled] = useState(initialStatus.enabled);
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
      const res = await fetch("/api/settings/docusign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationKey, userId, accountId, privateKey, demo, enabled }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save DocuSign settings");
      setStatus(body);
      setPrivateKey("");
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
      const res = await fetch("/api/settings/docusign/test", { method: "POST" });
      const body = await res.json();
      setTestResult(
        body.ok
          ? { ok: true, message: `Connected — account ${body.accountId}.` }
          : { ok: false, message: body.error ?? "Connection failed." },
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
        <h3 className="font-medium">DocuSign (JWT Grant, remote signing)</h3>
        <p className="text-sm text-muted">
          {status.configured
            ? `Configured for integration key ${status.integrationKey} on the ${status.demo ? "demo/sandbox" : "production"} environment.`
            : "Not configured yet."}{" "}
          Uses JWT Grant + remote signing specifically because this app has no public URL of its
          own — DocuSign emails the client directly and hosts the entire signing page itself, so
          nothing here needs to be reachable from outside this computer. Re-enter the private key
          to change any setting.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Integration key (Client ID)
        <input
          required
          value={integrationKey}
          onChange={(e) => setIntegrationKey(e.target.value)}
          placeholder="e.g. 8a1b2c3d-...-guid"
          className="surface-input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        User ID (impersonated user&apos;s GUID, from &ldquo;My Account Information&rdquo;)
        <input
          required
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="e.g. 9f8e7d6c-...-guid"
          className="surface-input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Account ID (API Account ID)
        <input
          required
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="e.g. 12345678-...-guid"
          className="surface-input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        RSA private key (PEM)
        <textarea
          required={!status.configured}
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          placeholder={status.configured ? "Leave blank to keep the current key" : "-----BEGIN RSA PRIVATE KEY-----..."}
          rows={5}
          className="surface-input font-mono text-xs"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
        Demo/sandbox environment (uncheck once you&apos;re ready for production)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Route e-signature requests through DocuSign (turns off this app&apos;s own native signing
        links everywhere they&apos;d otherwise be used)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary self-start">
          {saving ? "Saving…" : "Save"}
        </button>
        {status.configured && (
          <button type="button" onClick={handleTest} disabled={testing} className="btn-secondary self-start">
            {testing ? "Testing…" : "Test connection"}
          </button>
        )}
      </div>
      {testResult && (
        <p className={`text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}>{testResult.message}</p>
      )}

      <p className="text-xs text-muted">
        One-time setup after saving: DocuSign requires an admin-consent grant before JWT Grant will
        work. Open this URL once, in a browser, logged in as the same account:{" "}
        <code className="font-mono">
          https://{demo ? "account-d" : "account"}.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={integrationKey || "YOUR_INTEGRATION_KEY"}&redirect_uri=https://www.docusign.com
        </code>{" "}
        and click Allow. This only needs to be done once per integration key.
      </p>
    </form>
  );
}
