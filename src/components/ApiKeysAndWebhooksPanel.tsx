"use client";

import { useState } from "react";
import type { ApiKey, WebhookEventType, WebhookSubscription } from "@/lib/types";
import { WEBHOOK_EVENT_TYPES } from "@/lib/types";

export default function ApiKeysAndWebhooksPanel({
  initialApiKeys,
  initialWebhooks,
}: {
  initialApiKeys: ApiKey[];
  initialWebhooks: WebhookSubscription[];
}) {
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [keyLabel, setKeyLabel] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [eventType, setEventType] = useState<WebhookEventType>(WEBHOOK_EVENT_TYPES[0]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    setCreatingKey(true);
    setKeyError(null);
    setRevealedKey(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: keyLabel }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create API key");
      const { key, ...apiKey } = body;
      setApiKeys((prev) => [apiKey, ...prev]);
      setRevealedKey(key);
      setKeyLabel("");
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleRevokeKey(id: string) {
    setApiKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)),
    );
    await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
  }

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    setCreatingWebhook(true);
    setWebhookError(null);
    setRevealedSecret(null);
    try {
      const res = await fetch("/api/settings/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, url: webhookUrl }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create webhook");
      setWebhooks((prev) => [body, ...prev]);
      setRevealedSecret(body.secret);
      setWebhookUrl("");
    } catch (err) {
      setWebhookError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreatingWebhook(false);
    }
  }

  async function handleDeleteWebhook(id: string) {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
    await fetch(`/api/settings/webhooks/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-base">API keys</h3>
        <form onSubmit={handleCreateKey} className="surface-card flex flex-wrap items-end gap-2">
          <input
            required
            value={keyLabel}
            onChange={(e) => setKeyLabel(e.target.value)}
            placeholder="Label (e.g. Zapier integration)"
            className="surface-input flex-1"
          />
          <button type="submit" disabled={creatingKey} className="btn-primary">
            {creatingKey ? "…" : "Generate key"}
          </button>
        </form>
        {keyError && <p className="text-sm text-red-600">{keyError}</p>}
        {revealedKey && (
          <div className="surface-row border-amber-500/40 bg-amber-500/10 text-sm">
            <p className="font-medium">
              This key won&apos;t be shown again — copy it now:
            </p>
            <code className="mt-1 block overflow-x-auto rounded bg-black/[0.04] p-2 text-xs dark:bg-white/[0.06]">
              {revealedKey}
            </code>
          </div>
        )}

        {apiKeys.length === 0 ? (
          <p className="text-sm text-muted">No API keys yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {apiKeys.map((k) => (
              <li key={k.id} className="surface-row flex items-center justify-between text-sm">
                <span>
                  <span className="font-medium">{k.label}</span>{" "}
                  {k.revokedAt ? (
                    <span className="badge">Revoked</span>
                  ) : (
                    <span className="text-xs text-muted">
                      {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleString()}` : "Never used"}
                    </span>
                  )}
                </span>
                {!k.revokedAt && (
                  <button onClick={() => handleRevokeKey(k.id)} className="text-xs text-muted hover:text-red-600">
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-display text-base">Webhooks</h3>
        <form onSubmit={handleCreateWebhook} className="surface-card flex flex-wrap items-end gap-2">
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as WebhookEventType)}
            className="surface-input"
          >
            {WEBHOOK_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            required
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/…"
            className="surface-input flex-1"
          />
          <button type="submit" disabled={creatingWebhook} className="btn-primary">
            {creatingWebhook ? "…" : "Add webhook"}
          </button>
        </form>
        {webhookError && <p className="text-sm text-red-600">{webhookError}</p>}
        {revealedSecret && (
          <div className="surface-row border-amber-500/40 bg-amber-500/10 text-sm">
            <p className="font-medium">
              Signing secret — won&apos;t be shown again. Each delivery includes an{" "}
              <code className="font-mono">X-Signature</code> header (HMAC-SHA256 of the body using
              this secret) so the receiving endpoint can verify it really came from here:
            </p>
            <code className="mt-1 block overflow-x-auto rounded bg-black/[0.04] p-2 text-xs dark:bg-white/[0.06]">
              {revealedSecret}
            </code>
          </div>
        )}

        {webhooks.length === 0 ? (
          <p className="text-sm text-muted">No webhooks yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {webhooks.map((w) => (
              <li key={w.id} className="surface-row flex items-center justify-between text-sm">
                <span>
                  <span className="badge mr-2">{w.eventType}</span>
                  <span className="break-all">{w.url}</span>
                </span>
                <button onClick={() => handleDeleteWebhook(w.id)} className="shrink-0 text-xs text-muted hover:text-red-600">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
