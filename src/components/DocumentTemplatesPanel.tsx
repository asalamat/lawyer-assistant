"use client";

import { useState } from "react";
import type { DocumentTemplate } from "@/lib/types";

export default function DocumentTemplatesPanel({
  initialTemplates,
}: {
  initialTemplates: DocumentTemplate[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/document-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null, content }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create template");
      setTemplates((prev) => [...prev, body].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setDescription("");
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/settings/document-templates/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="surface-card flex flex-col gap-3">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name (e.g. Retainer Letter)"
          className="surface-input"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="surface-input"
        />
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            "Dear {{matter.clientName}},\n\nThank you for retaining {{lawyerName}} regarding {{matter.title}} (file {{matter.fileNumber}}).\n\nOur hourly rate for this matter is {{hourlyRate}}.\n\nSincerely,\n{{lawyerName}}"
          }
          rows={10}
          className="surface-input font-mono text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={creating} className="btn-primary self-start">
          {creating ? "…" : "Save template"}
        </button>
      </form>

      {templates.length === 0 ? (
        <p className="text-sm text-muted">No document templates yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((template) => (
            <li key={template.id} className="surface-row flex items-center justify-between text-sm">
              <span>
                <span className="font-medium">{template.name}</span>
                {template.description && <span className="ml-2 text-muted">{template.description}</span>}
              </span>
              <button onClick={() => handleDelete(template.id)} className="text-xs text-muted hover:text-red-600">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
