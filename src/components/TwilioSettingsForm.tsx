"use client";

import { useState } from "react";

interface TwilioStatus {
  configured: boolean;
  accountSid: string | null;
  fromPhoneNumber: string | null;
}

export default function TwilioSettingsForm({ initialStatus }: { initialStatus: TwilioStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [accountSid, setAccountSid] = useState(initialStatus.accountSid ?? "");
  const [authToken, setAuthToken] = useState("");
  const [fromPhoneNumber, setFromPhoneNumber] = useState(initialStatus.fromPhoneNumber ?? "");
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
      const res = await fetch("/api/settings/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountSid, authToken, fromPhoneNumber }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save SMS settings");
      setStatus(body);
      setAuthToken("");
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
      const res = await fetch("/api/settings/sms/test");
      const body = await res.json();
      setTestResult(
        body.ok
          ? { ok: true, message: "Connected and authenticated successfully." }
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
        <h3 className="font-medium">Twilio</h3>
        <p className="text-sm text-muted">
          {status.configured
            ? `Configured with number ${status.fromPhoneNumber}. Re-enter the Auth Token to change any setting.`
            : "Not configured yet. Create a Twilio account and a phone number, then enter its details here."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Account SID</span>
          <input
            required
            value={accountSid}
            onChange={(e) => setAccountSid(e.target.value)}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="surface-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Auth Token</span>
          <input
            required
            type="password"
            autoComplete="off"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder={status.configured ? "•••••••• (re-enter to save)" : "auth token"}
            className="surface-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Twilio phone number</span>
          <input
            required
            value={fromPhoneNumber}
            onChange={(e) => setFromPhoneNumber(e.target.value)}
            placeholder="+15551234567"
            className="surface-input"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}
      {testResult && (
        <p className={`text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
          {testResult.message}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary self-start">
          {saving ? "Saving…" : "Save SMS settings"}
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
