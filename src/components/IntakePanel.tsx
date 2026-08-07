"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function IntakePanel({ matterId }: { matterId: string }) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/matters/${matterId}/intake`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to send questionnaire");
      setLink(`${window.location.origin}${body.link}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <h2 className="font-display text-lg">Client intake</h2>
      <p className="text-sm text-muted">
        Send the client a no-login link to a fixed intake questionnaire. The link works for one
        submission and expires after two weeks.
      </p>
      <button onClick={handleSend} disabled={sending} className="btn-primary self-start">
        {sending ? "Preparing…" : "Send intake questionnaire"}
      </button>

      {link && (
        <div className="surface-row flex flex-col gap-2 text-sm">
          <p className="text-xs text-muted">
            Email this link to the client — it isn&apos;t shown again once you leave this page.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-xs">{link}</code>
            <button onClick={handleCopy} className="btn-secondary shrink-0">
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
