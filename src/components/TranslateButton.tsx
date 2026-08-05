"use client";

import { useState } from "react";
import MarkdownContent from "./MarkdownContent";

// French first, given this app's Canadian legal context — the rest are
// common languages a client base might need, plus a free-text "Other".
const LANGUAGES = ["French", "Spanish", "Mandarin Chinese", "Punjabi", "Arabic", "Tagalog"];

export default function TranslateButton({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [customLanguage, setCustomLanguage] = useState("");
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetLanguage = language === "Other" ? customLanguage.trim() : language;

  async function handleTranslate() {
    if (!targetLanguage) return;
    setTranslating(true);
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, targetLanguage }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Translation failed");
      setTranslated(body.translated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTranslating(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-accent underline decoration-accent/40"
      >
        Translate
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setTranslated(null);
          }}
          className="surface-input py-1 text-xs"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
          <option value="Other">Other…</option>
        </select>
        {language === "Other" && (
          <input
            value={customLanguage}
            onChange={(e) => setCustomLanguage(e.target.value)}
            placeholder="Language name"
            className="surface-input py-1 text-xs"
          />
        )}
        <button
          type="button"
          onClick={handleTranslate}
          disabled={translating || !targetLanguage}
          className="btn-secondary px-2 py-1 text-xs disabled:opacity-50"
        >
          {translating ? "Translating…" : "Go"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTranslated(null);
            setError(null);
          }}
          className="text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {translated && (
        <div className="surface-row">
          <p className="mb-1 text-xs font-medium text-muted">Translation ({targetLanguage})</p>
          <MarkdownContent content={translated} />
        </div>
      )}
    </div>
  );
}
