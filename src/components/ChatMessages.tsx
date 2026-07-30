"use client";

import { useState } from "react";
import { verifyCitations } from "@/lib/citationCheck";
import type { ChatMessage } from "@/lib/types";

export default function ChatMessages({
  matterId,
  initialMessages,
  knownFilenames,
}: {
  matterId: string;
  initialMessages: ChatMessage[];
  knownFilenames: string[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setSending(true);
    setError(null);
    const asked = question;
    setQuestion("");
    try {
      const res = await fetch(`/api/matters/${matterId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: asked }),
      });
      if (!res.ok) throw new Error("Failed to get an answer");
      const assistantMessage: ChatMessage = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          matterId,
          role: "user",
          content: asked,
          createdAt: new Date().toISOString(),
        },
        assistantMessage,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setQuestion(asked);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Ask a question about this matter&apos;s uploaded documents.
          </p>
        ) : (
          messages.map((message) => {
            const unverified =
              message.role === "assistant"
                ? verifyCitations(message.content, knownFilenames).filter((c) => !c.verified)
                : [];
            return (
              <div
                key={message.id}
                className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                  message.role === "assistant"
                    ? "self-start bg-black/5 dark:bg-white/10"
                    : "self-end bg-foreground text-background"
                }`}
              >
                {message.content}
                {unverified.length > 0 && (
                  <p className="mt-2 text-xs text-red-600">
                    ⚠ Cites {unverified.map((c) => c.filename).join(", ")}, which{" "}
                    {unverified.length === 1 ? "isn't" : "aren't"} among this matter&apos;s
                    uploaded documents — verify before relying on this.
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={sending}
          placeholder="Ask about this matter..."
          className="flex-1 rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          {sending ? "Asking…" : "Send"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
