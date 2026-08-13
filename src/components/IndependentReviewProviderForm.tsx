"use client";

import { useState } from "react";
import type { IndependentReviewProvider } from "@/lib/settings";

const LABELS: Record<IndependentReviewProvider, string> = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  moonshot: "Moonshot AI (Kimi)",
};

export default function IndependentReviewProviderForm({
  initialProvider,
  initialSamePrimaryProvider,
  configuredProviders,
}: {
  initialProvider: IndependentReviewProvider;
  initialSamePrimaryProvider: boolean;
  configuredProviders: IndependentReviewProvider[];
}) {
  const [provider, setProvider] = useState(initialProvider);
  const [samePrimaryProvider, setSamePrimaryProvider] = useState(initialSamePrimaryProvider);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: IndependentReviewProvider) {
    setProvider(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/independent-review-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setSamePrimaryProvider(body.samePrimaryProvider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <div>
        <h3 className="font-medium">Independent review provider</h3>
        <p className="text-sm text-muted">
          Which model gets a second opinion on a digest, evidence matrix, or chat answer. Deliberately
          separate from the primary provider order above — the point is a genuinely different model
          checking the first one&apos;s work, not another backup.
        </p>
      </div>
      <select
        value={provider}
        onChange={(e) => handleChange(e.target.value as IndependentReviewProvider)}
        disabled={saving}
        className="surface-input"
      >
        {(Object.keys(LABELS) as IndependentReviewProvider[]).map((p) => (
          <option key={p} value={p}>
            {LABELS[p]}
            {!configuredProviders.includes(p) ? " (no API key yet)" : ""}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {samePrimaryProvider && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Your primary AI provider and your independent review provider are both {LABELS[provider]} —
          a review from the same model family can share the same blind spots it&apos;s meant to catch.
          Pick a different provider above, or reorder your primary providers in Settings &gt; AI model.
        </p>
      )}
    </div>
  );
}
