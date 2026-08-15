"use client";

import { useState } from "react";
import type { SmsMessage } from "@/lib/matters";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function SmsPanel({
  matterId,
  initialMessages,
  clientPhone,
  smsConfigured,
}: {
  matterId: string;
  initialMessages: SmsMessage[];
  clientPhone: string | null;
  smsConfigured: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/matters/${matterId}/sms`);
      if (res.ok) setMessages(await res.json());
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const responseBody = await res.json();
      if (!res.ok) throw new Error(responseBody.error ?? "Failed to send message");
      setMessages((prev) => [...prev, responseBody]);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  const canSend = smsConfigured && Boolean(clientPhone);

  return (
    <div className="surface-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Text messages (SMS)</h2>
        <button onClick={handleRefresh} disabled={refreshing} className="text-xs text-accent hover:underline">
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {!smsConfigured && (
        <p className="text-sm text-muted">
          SMS isn&apos;t configured yet — connect a Twilio account in Settings &gt; SMS.
        </p>
      )}
      {smsConfigured && !clientPhone && (
        <p className="text-sm text-muted">
          This client has no phone number on file — add one from the client&apos;s record to send a text.
        </p>
      )}
      {messages.length === 0 ? (
        <p className="text-sm text-muted">No text messages yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`surface-row max-w-[80%] text-sm ${message.direction === "outbound" ? "self-end" : "self-start"}`}
            >
              <p>{message.body}</p>
              <p className="mt-1 text-xs text-muted">
                {message.direction === "outbound" ? "You" : "Client"} · {formatTimestamp(message.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSend} className="flex items-end gap-2">
        <textarea
          required
          disabled={!canSend}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={canSend ? "Text the client…" : "SMS not available for this matter yet"}
          rows={2}
          className="surface-input flex-1"
        />
        <button type="submit" disabled={sending || !canSend} className="btn-primary px-3 py-1.5">
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {smsConfigured && clientPhone && (
        <p className="text-xs text-muted">
          Replies aren&apos;t instant — this app checks for new texts every few minutes rather than
          receiving them live.
        </p>
      )}
    </div>
  );
}
