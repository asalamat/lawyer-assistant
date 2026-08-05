"use client";

import { useState } from "react";

const LANGUAGES = ["French", "Spanish", "Mandarin Chinese", "Punjabi", "Arabic", "Tagalog"];

export default function TranslationLanguageForm({
  initialLanguage,
}: {
  initialLanguage: string;
}) {
  const isPreset = LANGUAGES.includes(initialLanguage);
  const [selected, setSelected] = useState(isPreset ? initialLanguage : "Other");
  const [customLanguage, setCustomLanguage] = useState(isPreset ? "" : initialLanguage);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const language = selected === "Other" ? customLanguage.trim() : selected;

  async function handleSave() {
    if (!language) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings/translation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">Default language</p>
      <p className="text-xs text-muted">
        Pre-selected on every &quot;Translate&quot; button throughout the app — digests, evidence
        matrices, drafts, chat answers, and the smart email draft. You can still pick a different
        language at any time in each button&apos;s dropdown; this just sets what&apos;s already
        selected.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setSaved(false);
          }}
          className="surface-input"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
          <option value="Other">Other…</option>
        </select>
        {selected === "Other" && (
          <input
            value={customLanguage}
            onChange={(e) => {
              setCustomLanguage(e.target.value);
              setSaved(false);
            }}
            placeholder="Language name"
            className="surface-input"
          />
        )}
        <button onClick={handleSave} disabled={saving || !language} className="btn-secondary">
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
