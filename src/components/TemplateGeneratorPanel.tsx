"use client";

import { useState } from "react";
import type { AssembledDocument, DocumentTemplate } from "@/lib/types";
import ExportPdfButton from "./ExportPdfButton";
import MarkdownContent from "./MarkdownContent";
import TranslateButton from "./TranslateButton";

type TemplateWithFields = DocumentTemplate & { fields: { autoFill: string[]; custom: string[] } };

interface SignatureRequestState {
  status: "sending" | "sent" | "error";
  signUrl?: string;
  emailedTo?: string | null;
  error?: string;
}

export default function TemplateGeneratorPanel({
  matterId,
  initialDocuments,
  templates,
}: {
  matterId: string;
  initialDocuments: AssembledDocument[];
  templates: TemplateWithFields[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [signatureRequests, setSignatureRequests] = useState<Record<string, SignatureRequestState>>({});

  const selectedTemplate = templates.find((t) => t.id === templateId);

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    setFieldValues({});
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/assembled-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, fields: fieldValues }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate document");
      setDocuments((prev) => [body, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  async function saveAsDocument(docId: string): Promise<string> {
    const res = await fetch(`/api/matters/${matterId}/assembled-documents/${docId}/save-as-document`, {
      method: "POST",
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Failed to save as a document");
    setSavedIds((prev) => new Set(prev).add(docId));
    return body.id as string;
  }

  async function handleSaveAsDocument(docId: string) {
    await saveAsDocument(docId).catch(() => {});
  }

  // Saves the generated document (if not already saved) and immediately
  // prepares + sends it for signature — folds what would otherwise be two
  // separate trips (Save as document, then Consent tab > pick it as the
  // source) into one button, since "send this generated letter for
  // signature" is the actual thing being asked for here, not "save a file."
  async function handleSendForSignature(doc: AssembledDocument, templateName: string) {
    setSignatureRequests((prev) => ({ ...prev, [doc.id]: { status: "sending" } }));
    try {
      const sourceDocumentId = await saveAsDocument(doc.id);
      const createRes = await fetch(`/api/matters/${matterId}/signable-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "custom",
          title: `${templateName} — ${doc.createdAt.slice(0, 10)}`,
          sourceDocumentId,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error ?? "Failed to prepare document for signature");

      const sendRes = await fetch(`/api/matters/${matterId}/signable-documents/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend" }),
      });
      const sent = await sendRes.json();
      if (!sendRes.ok) throw new Error(sent.error ?? "Failed to send for signature");

      setSignatureRequests((prev) => ({
        ...prev,
        [doc.id]: { status: "sent", signUrl: sent.signUrl, emailedTo: sent.emailedTo },
      }));
    } catch (err) {
      setSignatureRequests((prev) => ({
        ...prev,
        [doc.id]: { status: "error", error: err instanceof Error ? err.message : "Something went wrong" },
      }));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="surface-card flex flex-col gap-3">
        <h2 className="font-display text-lg">Generate from a template</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-muted">
            No document templates exist yet — an admin can add one in Settings &gt; Document
            templates.
          </p>
        ) : (
          <form onSubmit={handleGenerate} className="flex flex-col gap-3">
            <select value={templateId} onChange={(e) => handleTemplateChange(e.target.value)} className="surface-input">
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {selectedTemplate?.fields.custom.map((field) => (
              <input
                key={field}
                required
                value={fieldValues[field] ?? ""}
                onChange={(e) => setFieldValues((prev) => ({ ...prev, [field]: e.target.value }))}
                placeholder={field}
                className="surface-input"
              />
            ))}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={generating} className="btn-primary self-start">
              {generating ? "Generating…" : "Generate"}
            </button>
          </form>
        )}
      </div>

      {documents.length > 0 && (
        <div className="flex flex-col gap-4">
          {documents.map((doc) => (
            <div key={doc.id} className="surface-card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ExportPdfButton title="Generated document" content={doc.content} />
                  <a
                    href={`/api/matters/${matterId}/assembled-documents/${doc.id}/export-docx`}
                    className="text-sm text-accent hover:underline"
                  >
                    Export .docx
                  </a>
                </div>
                <button
                  onClick={() => handleSaveAsDocument(doc.id)}
                  disabled={savedIds.has(doc.id)}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  {savedIds.has(doc.id) ? "Saved as document" : "Save as document"}
                </button>
                <button
                  onClick={() =>
                    handleSendForSignature(
                      doc,
                      templates.find((t) => t.id === doc.templateId)?.name ?? "Generated document",
                    )
                  }
                  disabled={signatureRequests[doc.id]?.status === "sending" || signatureRequests[doc.id]?.status === "sent"}
                  className="btn-secondary px-3 py-1.5 text-sm"
                >
                  {signatureRequests[doc.id]?.status === "sending"
                    ? "Preparing…"
                    : signatureRequests[doc.id]?.status === "sent"
                      ? "Sent for signature"
                      : "Send for signature"}
                </button>
              </div>
              {signatureRequests[doc.id]?.status === "sent" && (
                <p className="text-sm text-muted">
                  {signatureRequests[doc.id]?.emailedTo
                    ? `Emailed to ${signatureRequests[doc.id]?.emailedTo} for signature.`
                    : "Signing link ready (no client email on file, or email isn't configured)."}{" "}
                  <a href={signatureRequests[doc.id]?.signUrl} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                    Open it
                  </a>{" "}
                  to copy and send it another way, or manage it from the matter&apos;s Consent tab.
                </p>
              )}
              {signatureRequests[doc.id]?.status === "error" && (
                <p className="text-sm text-red-600">{signatureRequests[doc.id]?.error}</p>
              )}
              <MarkdownContent content={doc.content} />
              <TranslateButton content={doc.content} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
