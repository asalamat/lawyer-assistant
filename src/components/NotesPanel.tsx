"use client";

import { useState } from "react";
import type { MatterNote } from "@/lib/types";
import DictateButton from "./DictateButton";

export default function NotesPanel({
  matterId,
  initialNotes,
}: {
  matterId: string;
  initialNotes: MatterNote[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add note");
      setNotes((prev) => [body, ...prev]);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(noteId: string) {
    setNotes((prev) => prev.filter((note) => note.id !== noteId));
    await fetch(`/api/matters/${matterId}/notes/${noteId}`, { method: "DELETE" });
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <h2 className="font-display text-lg">Notes &amp; findings</h2>
      <p className="text-sm text-muted">
        Free-text notes here are included as context the next time you generate this
        matter&apos;s digest.
      </p>
      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a note or finding…"
          rows={3}
          className="surface-input"
        />
        <div className="flex items-center gap-2">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Adding…" : "Add note"}
          </button>
          <DictateButton
            disabled={submitting}
            onText={(text) => setContent((prev) => (prev ? `${prev} ${text}` : text))}
          />
        </div>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {notes.length === 0 ? (
        <p className="text-sm text-muted">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="surface-row text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-muted">
                  {new Date(note.createdAt).toLocaleString()}
                </span>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="text-xs text-muted hover:text-red-600"
                  aria-label="Delete note"
                >
                  Remove
                </button>
              </div>
              <p className="whitespace-pre-wrap">{note.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
