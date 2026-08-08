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

  async function handleToggleCalendarSync(enabled: boolean) {
    setTogglingCalendarSync(true);
    try {
      await fetch(`/api/integrations/${provider}/calendar-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      onChange();
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
            New deadlines computed from a rule push automatically; any deadline can also be pushed
            manually from its matter&apos;s Deadlines tab. One-way only — edits made directly in{" "}
            {PROVIDER_LABELS[provider]} never flow back here.
          </p>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="self-start text-sm text-red-600 underline disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-muted">
            Requires an OAuth app registered with this provider (Client ID + Secret), with
            redirect URI <code>{`{this app's URL}/api/integrations/${provider}/callback`}</code>.
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
      )}
    </div>
  );
}

// Yahoo has no viable OAuth mail-read path for a self-registered app (Yahoo's
// own docs: mail scopes require a separate commercial approval, not
// available via self-serve app creation). App passwords over IMAP are still
// supported and are the only realistic way to read Yahoo mail here.
function YahooProviderRow({
  account,
  onChange,
}: {
  account: EmailAccount | undefined;
  onChange: () => void;
}) {
  const [emailAddress, setEmailAddress] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/yahoo/imap-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAddress, appPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to connect Yahoo Mail");
      setEmailAddress("");
      setAppPassword("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setConnecting(false);
    }
  }

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

      <p className="mt-2 text-xs text-muted">
        Yahoo doesn&apos;t grant mail-read OAuth access to self-registered apps, so this uses an{" "}
        <strong>app password</strong> over IMAP instead. Enable Two-Step Verification on your
        Yahoo account, then generate an app password under Account Security &gt; Generate app
        password, and use it here (not your normal Yahoo password).
      </p>

      {account ? (
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="mt-3 text-sm text-red-600 underline disabled:opacity-50"
        >
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </button>
      ) : (
        <form onSubmit={handleConnect} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={emailAddress}
            onChange={(e) => setEmailAddress(e.target.value)}
            placeholder="you@yahoo.com"
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
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
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
        Connect a mailbox so matter-related email and attachments can be ingested.
        Each provider needs its own OAuth app — see Help for setup notes.
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
