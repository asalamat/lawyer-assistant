"use client";

import { useEffect, useState } from "react";
import type { IntakeQuestion } from "@/lib/intake";

type LoadState =
  | { kind: "loading" }
  | { kind: "unavailable"; message: string }
  | { kind: "ready"; questions: IntakeQuestion[] };

export default function ClientIntakeForm({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/intake/${token}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "unavailable", message: body.error ?? "This link is not available." });
          return;
        }
        setState({ kind: "ready", questions: body.questions as IntakeQuestion[] });
      } catch {
        if (!cancelled) {
          setState({ kind: "unavailable", message: "Could not load this questionnaire." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, clientEmail, answers }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to submit");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (state.kind === "unavailable") {
    return (
      <div className="surface-card flex flex-col gap-2">
        <h2 className="font-display text-lg">This questionnaire isn&apos;t available</h2>
        <p className="text-sm text-muted">{state.message}</p>
        <p className="text-sm text-muted">
          If you still need to complete it, please contact the firm and ask for a new link.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="surface-card flex flex-col gap-2">
        <h2 className="font-display text-lg">Thank you</h2>
        <p className="text-sm text-muted">
          Your answers have been sent to the firm. You can close this page — this link won&apos;t
          work again.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card flex flex-col gap-4">
      <p className="text-sm text-muted">
        Answer as much as you can. If you&apos;re not sure about something, leave it blank and we
        can go over it together.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input
          required
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className="surface-input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Your email address
        <input
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          className="surface-input"
        />
      </label>

      {state.questions.map((question) => (
        <label key={question.id} className="flex flex-col gap-1 text-sm">
          {question.label}
          {question.type === "textarea" ? (
            <textarea
              rows={3}
              value={answers[question.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
              className="surface-input"
            />
          ) : question.type === "select" ? (
            <select
              value={answers[question.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
              className="surface-input"
            >
              <option value="">Select…</option>
              {(question.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={answers[question.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
              className="surface-input"
            />
          )}
        </label>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-primary self-start">
        {submitting ? "Submitting…" : "Submit answers"}
      </button>
    </form>
  );
}
