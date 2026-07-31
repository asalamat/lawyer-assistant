import { randomBytes } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import { readSecureJson, writeSecureJson } from "./secureStore";
import type { EmailAccount, EmailProvider } from "./types";

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
    scope: "https://www.googleapis.com/auth/gmail.readonly openid email",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  microsoft: {
    displayName: "Microsoft (Outlook / Hotmail / Office 365)",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/v1.0/me",
    scope: "offline_access Mail.Read User.Read",
  },
  yahoo: {
    displayName: "Yahoo Mail",
    authUrl: "https://api.login.yahoo.com/oauth2/request_auth",
    tokenUrl: "https://api.login.yahoo.com/oauth2/get_token",
    userInfoUrl: "https://api.login.yahoo.com/openid/v1/userinfo",
    scope: "mail-r openid email",
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
    .prepare("SELECT id, provider, emailAddress, connectedAt FROM email_accounts")
    .all()
    .map((row) => toPlain<EmailAccount>(row));
}

export async function saveEmailAccount(params: {
  provider: EmailProvider;
  emailAddress: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
}): Promise<EmailAccount> {
  const account: StoredEmailAccount = {
    id: crypto.randomUUID(),
    provider: params.provider,
    emailAddress: params.emailAddress,
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    tokenExpiresAt: params.tokenExpiresAt,
    connectedAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO email_accounts (id, provider, emailAddress, accessToken, refreshToken, tokenExpiresAt, connectedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET
       emailAddress = excluded.emailAddress,
       accessToken = excluded.accessToken,
       refreshToken = excluded.refreshToken,
       tokenExpiresAt = excluded.tokenExpiresAt,
       connectedAt = excluded.connectedAt`,
  ).run(
    account.id,
    account.provider,
    account.emailAddress,
    account.accessToken,
    account.refreshToken,
    account.tokenExpiresAt,
    account.connectedAt,
  );
  await recordAuditEvent(
    "email_account_connected",
    null,
    `Connected ${params.provider} account (${params.emailAddress})`,
  );
  return { id: account.id, provider: account.provider, emailAddress: account.emailAddress, connectedAt: account.connectedAt };
}

export async function disconnectEmailAccount(provider: EmailProvider): Promise<void> {
  db.prepare("DELETE FROM email_accounts WHERE provider = ?").run(provider);
  await recordAuditEvent("email_account_disconnected", null, `Disconnected ${provider} account`);
}
