"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EmailAccount, EmailProvider } from "@/lib/types";

interface MessageSummary {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  receivedAt: string;
}

export default function ImportEmailPanel({ matterId }: { matterId: string }) {
  const [accounts, setAccounts] = useState<EmailAccount[] | null>(null);
  const [provider, setProvider] = useState<EmailProvider | "">("");
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/integrations")
      .then((res) => res.json())
      .then((data) => {
        const list: EmailAccount[] = data.accounts ?? [];
        setAccounts(list);
        if (list.length > 0) setProvider(list[0].provider);
      })
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    if (!provider) return;
    let cancelled = false;

    async function loadMessages(selected: EmailProvider) {
      setLoadingMessages(true);
      setListError(null);
      setMessages([]);
      setResult(null);
      try {
        const res = await fetch(`/api/email-accounts/${selected}/messages`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load messages");
        if (!cancelled) setMessages(data);
      } catch (err) {
        if (!cancelled) {
          setListError(err instanceof Error ? err.message : "Failed to load messages");
        }
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    void loadMessages(provider);
    return () => {
      cancelled = true;
    };
  }, [provider]);

  async function handleImport(messageId: string) {
    setImportingId(messageId);
    setResult(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/import-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, messageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to import email");
      setResult({ ok: true, message: `Imported "${data.fileName}" as a document.` });
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Failed to import email" });
    } finally {
      setImportingId(null);
    }
  }

  if (accounts === null) {
    return (
      <div className="surface-card text-sm">
        <p className="text-muted">Loading connected email accounts…</p>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="surface-card text-sm">
        <h2 className="font-display text-lg">Import an email</h2>
        <p className="text-muted mt-2">
          No email account is connected yet.{" "}
          <Link href="/settings/integrations" className="text-accent hover:underline">
            Connect an account in Settings
          </Link>{" "}
          to import messages into this matter.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <h2 className="font-display text-lg">Import an email</h2>

      <label className="text-sm text-muted">
        Account
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as EmailProvider)}
          className="surface-input mt-1"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.provider}>
              {account.emailAddress} ({account.provider})
            </option>
          ))}
        </select>
      </label>

      {result && (
        <div className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>
          <p>{result.message}</p>
          {result.ok && (
            <p className="text-muted mt-1">
              Imported as a document.{" "}
              <Link href={`/matters/${matterId}/digest`} className="text-accent hover:underline">
                Regenerate the matter&apos;s digest
              </Link>{" "}
              to include it.
            </p>
          )}
        </div>
      )}

      {loadingMessages && <p className="text-sm text-muted">Loading recent messages…</p>}
      {listError && <p className="text-sm text-red-600">{listError}</p>}

      {!loadingMessages && !listError && messages.length === 0 && (
        <p className="text-sm text-muted">No recent messages found.</p>
      )}

      <ul className="flex flex-col gap-2">
        {messages.map((message) => (
          <li key={message.id} className="surface-row flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{message.subject || "(no subject)"}</p>
              <p className="truncate text-xs text-muted">{message.from}</p>
              {message.snippet && (
                <p className="mt-1 line-clamp-2 text-xs text-muted">{message.snippet}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleImport(message.id)}
              disabled={importingId !== null}
              className="btn-secondary shrink-0 text-xs"
            >
              {importingId === message.id ? "Importing…" : "Import to this matter"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
