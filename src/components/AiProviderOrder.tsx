"use client";

import { useState } from "react";
import type { AiProvider } from "@/lib/settings";

const LABELS: Record<AiProvider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  gemini: "Google (Gemini)",
};

export default function AiProviderOrder({ initialOrder }: { initialOrder: AiProvider[] }) {
  const [order, setOrder] = useState(initialOrder);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(nextOrder: AiProvider[]) {
    setOrder(nextOrder);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/ai-provider-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: nextOrder }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...order];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    save(next);
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <div>
        <h3 className="font-medium">Provider order</h3>
        <p className="text-sm text-muted">
          If the first provider fails (billing, rate limit, outage), the app automatically
          falls through to the next one for that request.
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {order.map((provider, index) => (
          <li key={provider} className="surface-row flex items-center justify-between text-sm">
            <span>
              {index + 1}. {LABELS[provider]}
              {index === 0 && <span className="ml-2 badge-accent">Primary</span>}
            </span>
            {index > 0 && (
              <button
                onClick={() => moveUp(index)}
                disabled={saving}
                className="text-xs text-accent hover:underline"
              >
                Move up
              </button>
            )}
          </li>
        ))}
      </ol>
      {saved && <p className="text-sm text-green-600">Saved.</p>}
    </div>
  );
}
