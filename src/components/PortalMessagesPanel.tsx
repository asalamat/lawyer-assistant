"use client";

import { useState } from "react";
import type { PortalMessage } from "@/lib/types";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function PortalMessagesPanel({
  matterId,
  initialMessages,
}: {
  matterId: string;
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
      const res = await fetch(`/api/portal/matters/${matterId}/messages`);
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
      const res = await fetch(`/api/portal/matters/${matterId}/messages`, {
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
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg">Messages</h2>
        <button onClick={handleRefresh} disabled={refreshing} className="text-xs text-accent hover:underline">
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {messages.length === 0 ? (
        <p className="text-sm text-muted">No messages yet — send one below if you have a question.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`surface-row max-w-[80%] text-sm ${message.senderType === "client" ? "self-end" : "self-start"}`}
            >
              <p>{message.content}</p>
              <p className="mt-1 text-xs text-muted">
                {message.senderType === "client" ? "You" : "Your lawyer"} · {formatTimestamp(message.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSend} className="mt-3 flex items-end gap-2">
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a message…"
          rows={2}
          className="surface-input flex-1"
        />
        <button type="submit" disabled={sending} className="btn-primary px-3 py-1.5">
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
