"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EMAIL_PROVIDERS, type EmailAccount, type EmailProvider } from "@/lib/types";

const PROVIDER_LABELS: Record<EmailProvider, string> = {
  google: "Google (Gmail)",
  microsoft: "Microsoft (Outlook / Hotmail / Office 365)",
  yahoo: "Yahoo",
};

interface IntegrationsState {
  accounts: EmailAccount[];
  credentialStatus: Record<EmailProvider, boolean>;
}

// Shared by every provider's "connect without OAuth" path — a per-app
// password generated from the account's own security settings, used over
// plain IMAP. No developer app registration needed, but mail-only: an
// app-password connection carries no Calendar API scope, so it can't do
// calendar sync (see the authMethod branch in ProviderRow below).
function AppPasswordConnectForm({
  provider,
  helpText,
  onChange,
}: {
  provider: EmailProvider;
  helpText: React.ReactNode;
  onChange: () => void;
}) {
  const [emailAddress, setEmailAddress] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/${provider}/imap-connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAddress, appPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to connect");
      setEmailAddress("");
      setAppPassword("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted">{helpText}</p>
      <form onSubmit={handleConnect} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          placeholder="you@example.com"
          className="surface-input flex-1"
        />
        <input
          type="password"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
          placeholder="App password"
          className="surface-input flex-1"
        />
        <button
          type="submit"
          disabled={connecting || !emailAddress.trim() || !appPassword.trim()}
          className="btn-primary px-3 py-2"
        >
          {connecting ? "Connecting…" : "Connect"}
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ProviderRow({
  provider,
  account,
  hasCredentials,
  onChange,
}: {
  provider: EmailProvider;
  account: EmailAccount | undefined;
  hasCredentials: boolean;
  onChange: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [togglingCalendarSync, setTogglingCalendarSync] = useState(false);
  const [calendarSyncError, setCalendarSyncError] = useState<string | null>(null);

  async function handleToggleCalendarSync(enabled: boolean) {
    setTogglingCalendarSync(true);
    setCalendarSyncError(null);
    try {
      const res = await fetch(`/api/integrations/${provider}/calendar-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update calendar sync");
      onChange();
    } catch (err) {
      setCalendarSyncError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTogglingCalendarSync(false);
    }
  }

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/integrations/${provider}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save credentials");
      setClientId("");
      setClientSecret("");
      setSaved(true);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch(`/api/integrations/${provider}/disconnect`, { method: "POST" });
      onChange();
    } finally {
      setDisconnecting(false);
    }
  }

  const appPasswordHelp =
    provider === "google" ? (
      <>
        Or skip the OAuth app entirely: enable 2-Step Verification on the Google account, generate
        an app password at{" "}
        <a
          href="https://myaccount.google.com/apppasswords"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline"
        >
          myaccount.google.com/apppasswords
        </a>
        , and connect with that instead. Mail only — this path can&apos;t do calendar sync.
      </>
    ) : (
      <>
        Or skip the OAuth app entirely: enable two-step verification on the Microsoft account and
        generate an app password at{" "}
        <a
          href="https://account.live.com/proofs/AppPassword"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline"
        >
          account.live.com/proofs/AppPassword
        </a>
        , then connect with that instead. Only works for a personal Outlook.com/Hotmail account —
        a work or school Microsoft 365 account has no app-password option and needs OAuth above.
        Mail only either way — this path can&apos;t do calendar sync.
      </>
    );

  return (
    <div className="surface-card">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{PROVIDER_LABELS[provider]}</h3>
        {account ? (
          <span className="badge-accent">Connected: {account.emailAddress}</span>
        ) : (
          <span className="badge">Not connected</span>
        )}
      </div>

      {account ? (
        <div className="mt-3 flex flex-col gap-2">
          {account.authMethod === "oauth" ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(account.calendarSyncEnabled)}
                  disabled={togglingCalendarSync}
                  onChange={(e) => handleToggleCalendarSync(e.target.checked)}
                />
                Sync deadlines to calendar
              </label>
              <p className="text-xs text-muted">
                New deadlines computed from a rule push automatically; any deadline can also be
                pushed manually from its matter&apos;s Deadlines tab. One-way only — edits made
                directly in {PROVIDER_LABELS[provider]} never flow back here.
              </p>
              {calendarSyncError && <p className="text-xs text-red-600">{calendarSyncError}</p>}
            </>
          ) : (
            <p className="text-xs text-muted">
              Connected via app password — mail reading works, but calendar sync isn&apos;t
              available on this path (an app password carries no Calendar API access). Disconnect
              and reconnect via OAuth below if you need calendar sync.
            </p>
          )}
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="self-start text-sm text-red-600 underline disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted">
              Requires an OAuth app registered with this provider (Client ID + Secret), with
              redirect URI <code>{`{this app's URL}/api/integrations/${provider}/callback`}</code>.
              Needed for calendar sync.
            </p>
            <form onSubmit={handleSaveCredentials} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Client ID"
                className="surface-input flex-1"
              />
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Client Secret"
                className="surface-input flex-1"
              />
              <button
                type="submit"
                disabled={saving || !clientId.trim() || !clientSecret.trim()}
                className="btn-primary px-3 py-2"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </form>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {saved && <p className="text-xs text-green-600">Credentials saved.</p>}
            {hasCredentials && (
              <a href={`/api/integrations/${provider}/connect`} className="btn-primary self-start">
                Connect {PROVIDER_LABELS[provider]}
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <AppPasswordConnectForm provider={provider} helpText={appPasswordHelp} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

// Yahoo has no viable OAuth mail-read path for a self-registered app (Yahoo's
// own docs: mail scopes require a separate commercial approval, not
// available via self-serve app creation) — the app-password form is its
// only connect option, not an alternative to one.
function YahooProviderRow({
  account,
  onChange,
}: {
  account: EmailAccount | undefined;
  onChange: () => void;
}) {
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/integrations/yahoo/disconnect", { method: "POST" });
      onChange();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="surface-card">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{PROVIDER_LABELS.yahoo}</h3>
        {account ? (
          <span className="badge-accent">Connected: {account.emailAddress}</span>
        ) : (
          <span className="badge">Not connected</span>
        )}
      </div>

      {account ? (
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="mt-3 text-sm text-red-600 underline disabled:opacity-50"
        >
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </button>
      ) : (
        <div className="mt-3">
          <AppPasswordConnectForm
            provider="yahoo"
            helpText={
              <>
                Yahoo doesn&apos;t grant mail-read OAuth access to self-registered apps, so this
                uses an app password over IMAP instead. Enable Two-Step Verification on your
                Yahoo account, then generate an app password at{" "}
                <a
                  href="https://login.yahoo.com/account/security"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  Account Security &gt; Generate app password
                </a>
                , and use it here (not your normal Yahoo password).
              </>
            }
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPanel() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<IntegrationsState | null>(null);

  async function refresh() {
    const res = await fetch("/api/integrations");
    setState(await res.json());
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/integrations")
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setState(body);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const connected = searchParams.get("connected");
  const integrationError = searchParams.get("integrationError");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Connect a mailbox so matter-related email and attachments can be ingested. Each provider
        can be connected either via OAuth (its own login + consent screen, needed for calendar
        sync) or, for Google and Microsoft, with a simpler app password instead — see Help for
        setup notes.
      </p>
      {connected && (
        <p className="text-sm text-green-600">
          Connected {PROVIDER_LABELS[connected as EmailProvider] ?? connected}.
        </p>
      )}
      {integrationError && <p className="text-sm text-red-600">{integrationError}</p>}
      {!state ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        EMAIL_PROVIDERS.map((provider) =>
          provider === "yahoo" ? (
            <YahooProviderRow
              key={provider}
              account={state.accounts.find((a) => a.provider === provider)}
              onChange={refresh}
            />
          ) : (
            <ProviderRow
              key={provider}
              provider={provider}
              account={state.accounts.find((a) => a.provider === provider)}
              hasCredentials={state.credentialStatus[provider]}
              onChange={refresh}
            />
          ),
        )
      )}
    </div>
  );
}
