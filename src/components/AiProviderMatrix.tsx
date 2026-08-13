"use client";

import { useState } from "react";
import type { AiProvider, IndependentReviewProvider } from "@/lib/settings";

const ALL_PROVIDERS: IndependentReviewProvider[] = ["anthropic", "openai", "gemini", "ollama", "deepseek", "moonshot"];

// Duplicated from settings.ts's AI_PROVIDER_LABELS rather than imported —
// this is a client component, and importing a runtime value (not just a
// type) from settings.ts would pull that whole server-only module (fs,
// secureStore, etc.) into the browser bundle.
const LABELS: Record<IndependentReviewProvider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  gemini: "Google (Gemini)",
  ollama: "Ollama (local)",
  deepseek: "DeepSeek",
  moonshot: "Moonshot AI (Kimi)",
};

// DeepSeek and Moonshot can't be primary providers yet — most primary
// features (deadline extraction, evidence graphs, redline) need strict
// structured-JSON output, and those two aren't verified to support that as
// reliably as the four primary providers. A review is always plain text,
// so that risk doesn't apply to the independent-review column.
const PRIMARY_ELIGIBLE = new Set<IndependentReviewProvider>(["anthropic", "openai", "gemini", "ollama"]);

function reorderList<T>(list: T[]): { moveUp: (index: number) => T[] } {
  return {
    moveUp(index: number) {
      if (index === 0) return list;
      const next = [...list];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    },
  };
}

export default function AiProviderMatrix({
  initialPrimaryOrder,
  initialIndependentOrder,
  initialSamePrimaryProvider,
  configured,
}: {
  initialPrimaryOrder: AiProvider[];
  initialIndependentOrder: IndependentReviewProvider[];
  initialSamePrimaryProvider: boolean;
  configured: Record<IndependentReviewProvider, boolean>;
}) {
  const [primaryOrder, setPrimaryOrder] = useState<AiProvider[]>(initialPrimaryOrder);
  const [independentOrder, setIndependentOrder] = useState<IndependentReviewProvider[]>(initialIndependentOrder);
  const [samePrimaryProvider, setSamePrimaryProvider] = useState(initialSamePrimaryProvider);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function savePrimary(next: AiProvider[]) {
    setPrimaryOrder(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/ai-provider-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setSamePrimaryProvider(next[0] === independentOrder[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function saveIndependent(next: IndependentReviewProvider[]) {
    setIndependentOrder(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/independent-review-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next }),
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

  function togglePrimary(provider: IndependentReviewProvider, checked: boolean) {
    if (!PRIMARY_ELIGIBLE.has(provider)) return;
    const asAiProvider = provider as AiProvider;
    if (checked) {
      if (primaryOrder.includes(asAiProvider)) return;
      savePrimary([...primaryOrder, asAiProvider]);
      return;
    }
    if (primaryOrder.length <= 1) {
      setError("At least one primary provider is required.");
      return;
    }
    savePrimary(primaryOrder.filter((p) => p !== asAiProvider));
  }

  function toggleIndependent(provider: IndependentReviewProvider, checked: boolean) {
    if (checked) {
      if (independentOrder.includes(provider)) return;
      saveIndependent([...independentOrder, provider]);
      return;
    }
    if (independentOrder.length <= 1) {
      setError("At least one independent-review provider is required.");
      return;
    }
    saveIndependent(independentOrder.filter((p) => p !== provider));
  }

  return (
    <div className="surface-card flex flex-col gap-4">
      <div>
        <h3 className="font-medium">Providers</h3>
        <p className="text-sm text-muted">
          Check a provider into either role — <strong>Primary</strong> powers chat, digests, drafting,
          and deadline extraction; <strong>Independent review</strong> gets a second opinion on
          already-generated analysis. A provider can be in both, either, or neither. Below, reorder
          each role&apos;s sequence — if the first one fails, the app falls through to the next.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="py-1.5 font-medium">Provider</th>
              <th className="py-1.5 text-center font-medium">Primary</th>
              <th className="py-1.5 text-center font-medium">Independent review</th>
            </tr>
          </thead>
          <tbody>
            {ALL_PROVIDERS.map((provider) => (
              <tr key={provider} className="border-b border-border last:border-b-0">
                <td className="py-2">
                  {LABELS[provider]}
                  {configured[provider] ? (
                    <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      API key configured
                    </span>
                  ) : (
                    <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs text-muted dark:bg-white/10">
                      No API key
                    </span>
                  )}
                </td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={primaryOrder.includes(provider as AiProvider)}
                    disabled={saving || !PRIMARY_ELIGIBLE.has(provider)}
                    title={!PRIMARY_ELIGIBLE.has(provider) ? "Not available as a primary provider yet" : undefined}
                    onChange={(e) => togglePrimary(provider, e.target.checked)}
                  />
                </td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={independentOrder.includes(provider)}
                    disabled={saving}
                    onChange={(e) => toggleIndependent(provider, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-medium">Primary sequence</h4>
          <ol className="flex flex-col gap-2">
            {primaryOrder.map((provider, index) => (
              <li key={provider} className="surface-row flex items-center justify-between text-sm">
                <span>
                  {index + 1}. {LABELS[provider]}
                  {index === 0 && <span className="ml-2 badge-accent">First</span>}
                </span>
                {index > 0 && (
                  <button
                    onClick={() => savePrimary(reorderList(primaryOrder).moveUp(index))}
                    disabled={saving}
                    className="text-xs text-accent hover:underline"
                  >
                    Move up
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-medium">Independent review sequence</h4>
          <ol className="flex flex-col gap-2">
            {independentOrder.map((provider, index) => (
              <li key={provider} className="surface-row flex items-center justify-between text-sm">
                <span>
                  {index + 1}. {LABELS[provider]}
                  {index === 0 && <span className="ml-2 badge-accent">First</span>}
                </span>
                {index > 0 && (
                  <button
                    onClick={() => saveIndependent(reorderList(independentOrder).moveUp(index))}
                    disabled={saving}
                    className="text-xs text-accent hover:underline"
                  >
                    Move up
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {samePrimaryProvider && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Your first primary provider and first independent-review provider are both{" "}
          {LABELS[primaryOrder[0] as IndependentReviewProvider]} — a review from the same model
          family can share the same blind spots it&apos;s meant to catch. Reorder one of the
          sequences above so they don&apos;t match.
        </p>
      )}
    </div>
  );
}
