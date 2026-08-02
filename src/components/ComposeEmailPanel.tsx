"use client";

import Link from "next/link";
import { useState } from "react";

export default function ComposeEmailPanel({
  matterId,
  clientEmail,
  emailConfigured,
}: {
  matterId: string;
  clientEmail: string | null;
  emailConfigured: boolean;
}) {
  const [to, setTo] = useState(clientEmail ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!emailConfigured) {
    return (
      <div className="surface-card text-sm">
        <p className="text-muted">
          Email isn&apos;t configured yet.{" "}
          <Link href="/settings/email" className="text-accent hover:underline">
            Set up an outgoing mail server in Settings
          </Link>{" "}
          to send email directly from this matter.
        </p>
      </div>
    );
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, message }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to send email");
      setResult({ ok: true, message: `Sent to ${body.to}.` });
      setSubject("");
      setMessage("");
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Failed to send email" });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSend} className="surface-card flex flex-col gap-3">
      <h2 className="font-display text-lg">Compose email</h2>
      <input
        required
        type="email"
        placeholder="To"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="surface-input"
      />
      <input
        required
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="surface-input"
      />
      <textarea
        required
        placeholder="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={8}
        className="surface-input"
      />
      {result && (
        <p className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>{result.message}</p>
      )}
      <button type="submit" disabled={sending} className="btn-primary self-start">
        {sending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
