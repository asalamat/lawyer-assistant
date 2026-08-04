"use client";

import Link from "next/link";
import { useState } from "react";
import DictateButton from "./DictateButton";

export default function ComposeEmailPanel({
  matterId,
  clientEmail,
  emailConfigured,
  documents,
}: {
  matterId: string;
  clientEmail: string | null;
  emailConfigured: boolean;
  documents: { id: string; fileName: string }[];
}) {
  const [to, setTo] = useState(clientEmail ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [draftInstructions, setDraftInstructions] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

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

  function toggleAttachment(id: string) {
    setAttachmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleDraft() {
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/email-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: draftInstructions }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate draft");
      if (body.subject) setSubject(body.subject);
      setMessage(body.body ?? "");
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDrafting(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, message, documentIds: attachmentIds }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to send email");
      setResult({ ok: true, message: `Sent to ${body.to}.` });
      setSubject("");
      setMessage("");
      setAttachmentIds([]);
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Failed to send email" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <h2 className="font-display text-lg">Compose email</h2>

      <div className="surface-row flex flex-col gap-2">
        <p className="text-sm font-medium">Smart draft</p>
        <div className="flex items-center gap-2">
          <input
            value={draftInstructions}
            onChange={(e) => setDraftInstructions(e.target.value)}
            placeholder="What should this email say? (e.g. let them know the hearing was adjourned)"
            className="surface-input flex-1"
          />
          <DictateButton disabled={drafting} onText={(text) => setDraftInstructions((prev) => (prev ? `${prev} ${text}` : text))} />
          <button type="button" onClick={handleDraft} disabled={drafting} className="btn-secondary">
            {drafting ? "Drafting…" : "Generate draft"}
          </button>
        </div>
        <p className="text-xs text-muted">
          Grounded in this matter&apos;s uploaded documents. Always review before sending — this is
          a first draft, not ready to send as-is.
        </p>
        {draftError && <p className="text-sm text-red-600">{draftError}</p>}
      </div>

      <form onSubmit={handleSend} className="flex flex-col gap-3">
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
        <div className="flex flex-col gap-1">
          <textarea
            required
            placeholder="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            className="surface-input"
          />
          <DictateButton
            disabled={sending}
            onText={(text) => setMessage((prev) => (prev ? `${prev} ${text}` : text))}
          />
        </div>

        {documents.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Attach documents</p>
            <div className="flex flex-col gap-1">
              {documents.map((doc) => (
                <label key={doc.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={attachmentIds.includes(doc.id)}
                    onChange={() => toggleAttachment(doc.id)}
                  />
                  {doc.fileName}
                </label>
              ))}
            </div>
          </div>
        )}

        {result && (
          <p className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>
            {result.message}
          </p>
        )}
        <button type="submit" disabled={sending} className="btn-primary self-start">
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
