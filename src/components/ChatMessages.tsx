"use client";

import { useState } from "react";
import { verifyCitations } from "@/lib/citationCheck";
import type { ChatMessage, IndependentReview } from "@/lib/types";
import DictateButton from "./DictateButton";
import ExportPdfButton from "./ExportPdfButton";
import MarkdownContent from "./MarkdownContent";
import TranslateButton from "./TranslateButton";

type Rating = "up" | "down";

export default function ChatMessages({
  matterId,
  initialMessages,
  knownFilenames,
  initialFeedback,
  initialReviews = [],
}: {
  matterId: string;
  initialMessages: ChatMessage[];
  knownFilenames: string[];
  initialFeedback: Record<string, Rating>;
  initialReviews?: IndependentReview[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [reviews, setReviews] = useState(initialReviews);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function handleReview(message: ChatMessage) {
    setReviewingId(message.id);
    setReviewError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/independent-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "chat_message",
          sourceId: message.id,
          content: message.content,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to get independent review");
      setReviews((prev) => [body, ...prev]);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setReviewingId(null);
    }
  }

  async function handleRate(messageId: string, rating: Rating) {
    setFeedback((prev) => ({ ...prev, [messageId]: rating }));
    try {
      await fetch(`/api/chat-messages/${messageId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
    } catch {
      // best-effort — the optimistic UI state is harmless if this fails
    }
  }

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
          <p className="text-sm text-muted">
            Ask a question about this matter&apos;s uploaded documents.
          </p>
        ) : (
          messages.map((message) => {
            const unverified =
              message.role === "assistant"
                ? verifyCitations(message.content, knownFilenames).filter((c) => !c.verified)
                : [];
            const review = reviews.find((r) => r.sourceId === message.id);
            return (
              <div
                key={message.id}
                className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
                  message.role === "assistant"
                    ? "self-start border border-border bg-card"
                    : "self-end whitespace-pre-wrap bg-accent text-accent-foreground"
                }`}
              >
                {message.role === "assistant" ? (
                  <MarkdownContent content={message.content} />
                ) : (
                  message.content
                )}
                {unverified.length > 0 && (
                  <p className="mt-2 text-xs text-red-600">
                    ⚠ Cites {unverified.map((c) => c.filename).join(", ")}, which{" "}
                    {unverified.length === 1 ? "isn't" : "aren't"} among this matter&apos;s
                    uploaded documents — verify before relying on this.
                  </p>
                )}
                {message.role === "assistant" && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleRate(message.id, "up")}
                      aria-label="Approve this answer"
                      className={`text-xs ${
                        feedback[message.id] === "up" ? "opacity-100" : "opacity-40 hover:opacity-70"
                      }`}
                    >
                      👍
                    </button>
                    <button
                      onClick={() => handleRate(message.id, "down")}
                      aria-label="Flag this answer"
                      className={`text-xs ${
                        feedback[message.id] === "down" ? "opacity-100" : "opacity-40 hover:opacity-70"
                      }`}
                    >
                      👎
                    </button>
                    <button
                      onClick={() => handleReview(message)}
                      disabled={reviewingId === message.id}
                      className="text-xs text-accent underline decoration-accent/40 disabled:opacity-50"
                    >
                      {reviewingId === message.id
                        ? "Reviewing…"
                        : review
                          ? "Re-review"
                          : "Get independent review"}
                    </button>
                    <ExportPdfButton
                      title="Chat answer"
                      content={message.content}
                      className="text-xs text-accent underline decoration-accent/40"
                    />
                  </div>
                )}
                {message.role === "assistant" && (
                  <div className="mt-1">
                    <TranslateButton content={message.content} />
                  </div>
                )}
                {message.role === "assistant" && review && (
                  <div className="surface-row mt-2 flex flex-col gap-2 text-xs">
                    <p className="mb-1 font-medium text-muted">Independent review (Gemini)</p>
                    <MarkdownContent content={review.content} />
                    <TranslateButton content={review.content} />
                  </div>
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
          className="surface-input flex-1"
        />
        <DictateButton
          disabled={sending}
          onText={(text) => setQuestion((prev) => (prev ? `${prev} ${text}` : text))}
        />
        <button type="submit" disabled={sending} className="btn-primary">
          {sending ? "Asking…" : "Send"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {reviewError && <p className="text-sm text-red-600">{reviewError}</p>}
    </div>
  );
}
