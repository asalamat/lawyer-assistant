"use client";

import { useState } from "react";
import type { PiiMaskingSettings } from "@/lib/settings";

const IDENTIFIER_LABELS: { key: keyof Omit<PiiMaskingSettings, "enabled">; label: string; detail: string }[] = [
  { key: "sin", label: "SIN (Canadian Social Insurance Number)", detail: "Validated with the real SIN checksum to avoid masking random 9-digit numbers." },
  { key: "ssn", label: "SSN (US Social Security Number)", detail: "Format XXX-XX-XXXX." },
  { key: "creditCard", label: "Credit card numbers", detail: "13-19 digit sequences validated via the Luhn checksum." },
  { key: "phone", label: "Phone numbers", detail: "May reduce how useful AI drafts are for correspondence that needs to state a real callback number." },
  { key: "email", label: "Email addresses", detail: "May reduce how useful AI drafts are for correspondence that needs to state a real reply address." },
];

export default function PiiMaskingSettingsForm({
  initialSettings,
}: {
  initialSettings: PiiMaskingSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: PiiMaskingSettings) {
    setSettings(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
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
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => save({ ...settings, enabled: e.target.checked })}
        />
        Mask sensitive identifiers before sending matter content to any AI provider
      </label>
      <p className="text-xs text-muted">
        Applies to chat, digests, evidence matrices, deadline extraction, drafts, the
        self-checking drafting agent, and independent review — everywhere matter content is sent
        to Anthropic, OpenAI, or Google Gemini. A masked identifier is replaced with a placeholder
        like <span className="font-mono">[REDACTED:SIN]</span> before the request leaves this
        app; the AI never sees the real value, and any draft it writes will show the placeholder
        instead of the real number unless you turn masking off first.
      </p>

      <div className={`flex flex-col gap-2 ${settings.enabled ? "" : "opacity-50"}`}>
        {IDENTIFIER_LABELS.map(({ key, label, detail }) => (
          <label key={key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              disabled={!settings.enabled}
              checked={settings[key]}
              onChange={(e) => save({ ...settings, [key]: e.target.checked })}
            />
            <span>
              {label}
              <span className="block text-xs text-muted">{detail}</span>
            </span>
          </label>
        ))}
      </div>

      {saving && <p className="text-xs text-muted">Saving…</p>}
      {saved && !saving && <p className="text-xs text-green-600">Saved.</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
