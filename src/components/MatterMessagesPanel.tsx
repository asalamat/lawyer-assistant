"use client";

import { useState } from "react";
import type { PortalMessage } from "@/lib/types";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function MatterMessagesPanel({
  matterId,
  hasClientPortal,
  initialMessages,
}: {
  matterId: string;
  hasClientPortal: boolean;
  initialMessages: PortalMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/matters/${matterId}/portal-messages`);
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
      const res = await fetch(`/api/matters/${matterId}/portal-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to send message");
      setMessages((prev) => [...prev, body]);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Client messages</h2>
        <button onClick={handleRefresh} disabled={refreshing} className="text-xs text-accent hover:underline">
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {!hasClientPortal && (
        <p className="text-sm text-muted">
          This matter has no linked client — link one from the matter&apos;s client record to use
          portal messaging.
        </p>
      )}
      {messages.length === 0 ? (
        <p className="text-sm text-muted">No messages yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`surface-row max-w-[80%] text-sm ${message.senderType === "staff" ? "self-end" : "self-start"}`}
            >
              <p>{message.content}</p>
              <p className="mt-1 text-xs text-muted">
                {message.senderType === "staff" ? "You" : "Client"} · {formatTimestamp(message.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSend} className="flex items-end gap-2">
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a message to the client…"
          rows={2}
          className="surface-input flex-1"
        />
        <button type="submit" disabled={sending} className="btn-primary px-3 py-1.5">
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
