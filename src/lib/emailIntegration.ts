import { randomBytes } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import { readSecureJson, writeSecureJson } from "./secureStore";
import type { EmailAccount, EmailAuthMethod, EmailProvider } from "./types";

const OAUTH_CREDENTIALS_FILE = "oauth.json";

interface ProviderConfig {
  displayName: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  /** Extra params merged into the /connect authorize redirect. */
  extraAuthParams?: Record<string, string>;
}

// Hotmail/Outlook.com (personal) and Office 365 (work/school) both go through
// the same Microsoft identity platform "common" endpoint — one app
// registration covers all three of the user's requested Microsoft flavors.
export const PROVIDER_CONFIG: Record<EmailProvider, ProviderConfig> = {
  google: {
    displayName: "Google (Gmail)",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    // calendar.events is requested upfront alongside mail-read, not
    // incrementally when calendar sync is later turned on — Google's
    // consent flow doesn't support silently widening an already-granted
    // scope without another full consent screen, so an account connected
    // before this scope was added has to be reconnected once.
    scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events openid email",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  microsoft: {
    displayName: "Microsoft (Outlook / Hotmail / Office 365)",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/v1.0/me",
    scope: "offline_access Mail.Read Calendars.ReadWrite User.Read",
  },
  // Yahoo's own developer docs state mail scopes are "not available for
  // self-served setup in the developer console" — third-party mail read
  // access requires a separate commercial approval Yahoo grants case by
  // case (senders.yahooinc.com/developer/developer-access). Requesting
  // "mail-r" from a normal self-registered app is rejected by Yahoo's
  // authorize endpoint with a generic error page, not a usable one. Scope
  // is limited to identity only so connecting the account itself succeeds;
  // mail reading is deliberately unsupported (see src/lib/emailRead.ts).
  yahoo: {
    displayName: "Yahoo (identity only — mail reading not supported)",
    authUrl: "https://api.login.yahoo.com/oauth2/request_auth",
    tokenUrl: "https://api.login.yahoo.com/oauth2/get_token",
    userInfoUrl: "https://api.login.yahoo.com/openid/v1/userinfo",
    scope: "openid email",
  },
};

interface OAuthCredentials {
  clientId?: string;
  clientSecret?: string;
}
type OAuthCredentialsFile = Partial<Record<EmailProvider, OAuthCredentials>>;

export async function getOAuthCredentials(
  provider: EmailProvider,
): Promise<OAuthCredentials | null> {
  const all = await readSecureJson<OAuthCredentialsFile>(OAUTH_CREDENTIALS_FILE, {});
  const creds = all[provider];
  return creds?.clientId && creds?.clientSecret ? creds : null;
}

export async function setOAuthCredentials(
  provider: EmailProvider,
  clientId: string,
  clientSecret: string,
): Promise<void> {
  const all = await readSecureJson<OAuthCredentialsFile>(OAUTH_CREDENTIALS_FILE, {});
  all[provider] = { clientId, clientSecret };
  await writeSecureJson(OAUTH_CREDENTIALS_FILE, all);
}

export async function getOAuthCredentialStatus(): Promise<
  Record<EmailProvider, boolean>
> {
  const all = await readSecureJson<OAuthCredentialsFile>(OAUTH_CREDENTIALS_FILE, {});
  return {
    google: Boolean(all.google?.clientId && all.google?.clientSecret),
    microsoft: Boolean(all.microsoft?.clientId && all.microsoft?.clientSecret),
    yahoo: Boolean(all.yahoo?.clientId && all.yahoo?.clientSecret),
  };
}

// In-memory CSRF state for the OAuth authorize/callback round trip. Fine for
// this app's single-process local-server model; would need a shared store
// (signed cookie or DB row) if this ever ran behind multiple server processes.
const pendingStates = new Map<string, EmailProvider>();

export function createOAuthState(provider: EmailProvider): string {
  const state = randomBytes(16).toString("hex");
  pendingStates.set(state, provider);
  return state;
}

export function consumeOAuthState(state: string): EmailProvider | null {
  const provider = pendingStates.get(state);
  if (provider) pendingStates.delete(state);
  return provider ?? null;
}

interface StoredEmailAccount extends EmailAccount {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
}

export async function listEmailAccounts(): Promise<EmailAccount[]> {
  return db
    .prepare("SELECT id, provider, emailAddress, connectedAt, calendarSyncEnabled, authMethod FROM email_accounts")
    .all()
    .map((row) => toPlain<EmailAccount>(row));
}

export async function setCalendarSyncEnabled(provider: EmailProvider, enabled: boolean): Promise<void> {
  // An app-password connection has no Calendar API scope at all — only an
  // OAuth-connected account can ever have this turned on.
  if (enabled) {
    const row = db.prepare("SELECT authMethod FROM email_accounts WHERE provider = ?").get(provider) as
      | { authMethod: EmailAuthMethod }
      | undefined;
    if (!row) throw new Error(`No connected ${provider} account`);
    if (row.authMethod !== "oauth") {
      throw new Error(
        "Calendar sync needs the OAuth connection, not an app password — reconnect via OAuth to enable it.",
      );
    }
  }
  db.prepare("UPDATE email_accounts SET calendarSyncEnabled = ? WHERE provider = ?").run(
    enabled ? 1 : 0,
    provider,
  );
  await recordAuditEvent(
    "calendar_sync_toggled",
    null,
    `${enabled ? "Enabled" : "Disabled"} deadline calendar sync for ${provider}`,
  );
}

// Nothing in this codebase refreshed an expired OAuth access token before
// this — every existing email-read call just used whatever token was
// stored at connect time. That's fine for reading email shortly after
// connecting, but calendar pushes can happen anytime after a deadline is
// created, well past a typical ~1 hour token lifetime. Refreshes and
// persists a new access token when the stored one is expired (or about to
// be); returns the existing token unchanged otherwise, and best-effort
// falls back to the existing token if a refresh attempt itself fails (the
// caller's actual API call will then surface the real error).
export async function getFreshAccessToken(provider: EmailProvider): Promise<string | null> {
  const row = db
    .prepare("SELECT accessToken, refreshToken, tokenExpiresAt FROM email_accounts WHERE provider = ?")
    .get(provider) as { accessToken: string; refreshToken: string | null; tokenExpiresAt: string | null } | undefined;
  if (!row) return null;

  const expiresAtMs = row.tokenExpiresAt ? new Date(row.tokenExpiresAt).getTime() : null;
  const stillValid = expiresAtMs === null || expiresAtMs - Date.now() > 60_000;
  if (stillValid || !row.refreshToken) return row.accessToken;

  const credentials = await getOAuthCredentials(provider);
  if (!credentials) return row.accessToken;

  try {
    const config = PROVIDER_CONFIG[provider];
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.clientId!,
        client_secret: credentials.clientSecret!,
        refresh_token: row.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok) return row.accessToken;
    const tokens = await response.json();
    const newExpiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    db.prepare("UPDATE email_accounts SET accessToken = ?, tokenExpiresAt = ? WHERE provider = ?").run(
      tokens.access_token,
      newExpiresAt,
      provider,
    );
    return tokens.access_token;
  } catch {
    return row.accessToken;
  }
}

export async function saveEmailAccount(params: {
  provider: EmailProvider;
  emailAddress: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  authMethod: EmailAuthMethod;
}): Promise<EmailAccount> {
  const account: StoredEmailAccount = {
    id: crypto.randomUUID(),
    provider: params.provider,
    emailAddress: params.emailAddress,
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    tokenExpiresAt: params.tokenExpiresAt,
    connectedAt: new Date().toISOString(),
    authMethod: params.authMethod,
    // Not part of the INSERT/UPDATE below — a fresh connection defaults to
    // 0 via the column's own DEFAULT, and reconnecting an existing account
    // deliberately leaves whatever preference was already set untouched.
    calendarSyncEnabled: 0,
  };
  db.prepare(
    `INSERT INTO email_accounts (id, provider, emailAddress, accessToken, refreshToken, tokenExpiresAt, connectedAt, authMethod)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET
       emailAddress = excluded.emailAddress,
       accessToken = excluded.accessToken,
       refreshToken = excluded.refreshToken,
       tokenExpiresAt = excluded.tokenExpiresAt,
       connectedAt = excluded.connectedAt,
       authMethod = excluded.authMethod`,
  ).run(
    account.id,
    account.provider,
    account.emailAddress,
    account.accessToken,
    account.refreshToken,
    account.tokenExpiresAt,
    account.connectedAt,
    account.authMethod,
  );
  await recordAuditEvent(
    "email_account_connected",
    null,
    `Connected ${params.provider} account (${params.emailAddress}) via ${params.authMethod === "oauth" ? "OAuth" : "app password"}`,
  );
  // Re-read rather than trust the in-memory `account` object — a
  // reconnect leaves calendarSyncEnabled untouched by the upsert above,
  // so the real persisted value (not the placeholder used to satisfy the
  // insert) is whatever was already there.
  const stored = db
    .prepare(
      "SELECT id, provider, emailAddress, connectedAt, calendarSyncEnabled, authMethod FROM email_accounts WHERE provider = ?",
    )
    .get(params.provider);
  return toPlain<EmailAccount>(stored);
}

export async function disconnectEmailAccount(provider: EmailProvider): Promise<void> {
  db.prepare("DELETE FROM email_accounts WHERE provider = ?").run(provider);
  await recordAuditEvent("email_account_disconnected", null, `Disconnected ${provider} account`);
}
