"use client";

import { useState } from "react";

interface SmtpStatus {
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean;
  username: string | null;
  fromName: string | null;
  fromEmail: string | null;
}

export default function SmtpSettingsForm({ initialStatus }: { initialStatus: SmtpStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [host, setHost] = useState(initialStatus.host ?? "");
  const [port, setPort] = useState(String(initialStatus.port ?? 465));
  const [secure, setSecure] = useState(initialStatus.secure);
  const [username, setUsername] = useState(initialStatus.username ?? "");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState(initialStatus.fromName ?? "");
  const [fromEmail, setFromEmail] = useState(initialStatus.fromEmail ?? "");
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
      const res = await fetch("/api/settings/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port: Number(port),
          secure,
          username,
          password,
          fromName,
          fromEmail,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save SMTP settings");
      setStatus(body);
      setPassword("");
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
      const res = await fetch("/api/settings/smtp/test");
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
        <h3 className="font-medium">Outgoing mail server (SMTP)</h3>
        <p className="text-sm text-muted">
          {status.configured
            ? `Configured for ${status.username} at ${status.host}:${status.port}. Re-enter the password to change any setting.`
            : "Not configured yet. Enter your mail provider's SMTP details."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">SMTP host</span>
          <input
            required
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.gmail.com"
            className="surface-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Port</span>
          <input
            required
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="465"
            className="surface-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Username</span>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="you@example.com"
            className="surface-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Password</span>
          <input
            required
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={status.configured ? "•••••••• (re-enter to save)" : "app password"}
            className="surface-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">From name</span>
          <input
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Jane Doe Law"
            className="surface-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">From email</span>
          <input
            required
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="billing@example.com"
            className="surface-input"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
        Use TLS/SSL (recommended; typically on for port 465, off for 587 with STARTTLS)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}
      {testResult && (
        <p className={`text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
          {testResult.message}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary self-start">
          {saving ? "Saving…" : "Save SMTP settings"}
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
