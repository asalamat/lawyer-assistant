import { randomBytes } from "crypto";
import { readFile, stat } from "fs/promises";
import { recordAuditEvent } from "./auditLog";
import { getDriveAppCredentials } from "./driveOAuthApp";
import { generatePkcePair } from "./oauthPkce";
import {
  saveDriveBackupConnection,
  setDriveBackupFolderId,
  updateDriveBackupTokens,
  type DriveBackupConfig,
} from "./settings";

export type DriveProvider = "google-drive" | "onedrive";

const BACKUPS_FOLDER_NAME = "Lawyer Assistant Backups";

interface DriveProviderConfig {
  displayName: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  extraAuthParams?: Record<string, string>;
}

export const DRIVE_PROVIDER_CONFIG: Record<DriveProvider, DriveProviderConfig> = {
  "google-drive": {
    displayName: "Google Drive",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    // drive.file (not the broader "drive" scope) — this app can only ever
    // see files/folders it created itself, never the rest of the user's
    // Drive.
    scope: "https://www.googleapis.com/auth/drive.file openid email",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  onedrive: {
    displayName: "OneDrive",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/v1.0/me",
    scope: "offline_access Files.ReadWrite User.Read",
  },
};

interface PendingOAuth {
  provider: DriveProvider;
  verifier: string;
}

const pendingStates = new Map<string, PendingOAuth>();

// Returns both the opaque `state` (round-tripped through the provider so the
// callback knows which attempt this is) and the PKCE `challenge` to embed in
// the authorize URL — the matching `verifier` stays server-side in
// `pendingStates`, retrieved by `consumeDriveOAuthState` during the callback.
export function createDriveOAuthState(provider: DriveProvider): { state: string; challenge: string } {
  const { verifier, challenge } = generatePkcePair();
  const state = randomBytes(16).toString("hex");
  pendingStates.set(state, { provider, verifier });
  return { state, challenge };
}

export function consumeDriveOAuthState(state: string): PendingOAuth | null {
  const pending = pendingStates.get(state);
  if (pending) pendingStates.delete(state);
  return pending ?? null;
}

export async function getDriveOAuthClientCredentials(provider: DriveProvider) {
  return getDriveAppCredentials(provider);
}

export function buildDriveAuthorizeUrl(
  provider: DriveProvider,
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge: string,
): string {
  const config = DRIVE_PROVIDER_CONFIG[provider];
  const url = new URL(config.authUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  for (const [key, value] of Object.entries(config.extraAuthParams ?? {})) url.searchParams.set(key, value);
  return url.toString();
}

interface TokenResult {
  accessToken: string;
  refreshToken: string | undefined;
  expiresAt: string | null;
}

async function exchangeToken(provider: DriveProvider, body: URLSearchParams): Promise<TokenResult> {
  const config = DRIVE_PROVIDER_CONFIG[provider];
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const tokens = await res.json();
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
  };
}

export async function exchangeDriveCode(
  provider: DriveProvider,
  clientId: string,
  clientSecret: string | undefined,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<TokenResult> {
  const params: Record<string, string> = {
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  };
  if (clientSecret) params.client_secret = clientSecret;
  return exchangeToken(provider, new URLSearchParams(params));
}

async function refreshDriveToken(
  provider: DriveProvider,
  clientId: string,
  clientSecret: string | undefined,
  refreshToken: string,
): Promise<TokenResult> {
  const params: Record<string, string> = {
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  };
  if (clientSecret) params.client_secret = clientSecret;
  return exchangeToken(provider, new URLSearchParams(params));
}

export async function fetchDriveAccountEmail(provider: DriveProvider, accessToken: string): Promise<string | null> {
  const config = DRIVE_PROVIDER_CONFIG[provider];
  const res = await fetch(config.userInfoUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const profile = await res.json();
  if (provider === "onedrive") return profile.mail || profile.userPrincipalName || null;
  return profile.email || null;
}

// Called from the dedicated /api/settings/cloud-backup/oauth/[provider]/
// callback route — its own redirect URI, not shared with the email
// integration, so a pending backup connection can never be lost by
// disambiguation logic living in a route file that also serves email.
export async function completeDriveOAuthCallback(
  provider: DriveProvider,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<void> {
  const credentials = await getDriveOAuthClientCredentials(provider);
  if (!credentials) throw new Error("OAuth credentials not configured");

  const tokens = await exchangeDriveCode(
    provider,
    credentials.clientId,
    credentials.clientSecret,
    code,
    redirectUri,
    codeVerifier,
  );
  if (!tokens.refreshToken) {
    throw new Error(
      "No refresh token returned — if this account was connected before, disconnect it first and reconnect (the provider only issues a refresh token on first consent).",
    );
  }
  const accountEmail = await fetchDriveAccountEmail(provider, tokens.accessToken);
  if (!accountEmail) throw new Error("Could not determine the connected account's email address");

  await saveDriveBackupConnection({
    provider,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: tokens.expiresAt,
    accountEmail,
  });
  await recordAuditEvent(
    "cloud_backup_connected",
    null,
    `Connected ${provider === "google-drive" ? "Google Drive" : "OneDrive"} (${accountEmail}) for cloud backups`,
  );
}

async function refreshAndPersistDriveToken(provider: DriveProvider, config: DriveBackupConfig): Promise<string> {
  const credentials = await getDriveOAuthClientCredentials(provider);
  if (!credentials) {
    throw new Error(
      `No OAuth app configured for ${DRIVE_PROVIDER_CONFIG[provider].displayName} yet — set it up in Settings > Backup.`,
    );
  }
  const refreshed = await refreshDriveToken(provider, credentials.clientId, credentials.clientSecret, config.refreshToken);
  await updateDriveBackupTokens(provider, refreshed.accessToken, refreshed.refreshToken, refreshed.expiresAt);
  return refreshed.accessToken;
}

// Thrown by the low-level request helpers below on a 401 so withTokenRetry
// knows to refresh and retry once, rather than every call site having to
// duplicate that branching.
class DriveUnauthorizedError extends Error {}

async function withTokenRetry<T>(
  provider: DriveProvider,
  config: DriveBackupConfig,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  try {
    return await fn(config.accessToken);
  } catch (err) {
    if (!(err instanceof DriveUnauthorizedError)) throw err;
    const freshToken = await refreshAndPersistDriveToken(provider, config);
    return await fn(freshToken);
  }
}

async function assertOk(res: Response, label: string): Promise<void> {
  if (res.status === 401) throw new DriveUnauthorizedError(label);
  if (!res.ok) throw new Error(`${label}: ${res.status} ${await res.text()}`);
}

// --- Google Drive -----------------------------------------------------

async function getOrCreateGoogleDriveFolder(accessToken: string, knownFolderId?: string): Promise<string> {
  if (knownFolderId) {
    const check = await fetch(
      `https://www.googleapis.com/drive/v3/files/${knownFolderId}?fields=id,trashed`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (check.status === 401) throw new DriveUnauthorizedError("Checking backups folder");
    if (check.ok) {
      const data = await check.json();
      if (!data.trashed) return knownFolderId;
    }
  }

  const query = encodeURIComponent(
    `name='${BACKUPS_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await assertOk(listRes, "Looking up backups folder");
  const found = await listRes.json();
  if (found.files?.[0]?.id) {
    await setDriveBackupFolderId(found.files[0].id);
    return found.files[0].id;
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: BACKUPS_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  await assertOk(createRes, "Creating backups folder");
  const created = await createRes.json();
  await setDriveBackupFolderId(created.id);
  return created.id;
}

export async function uploadToGoogleDrive(config: DriveBackupConfig, filePath: string, fileName: string): Promise<void> {
  const size = (await stat(filePath)).size;
  const body = await readFile(filePath);

  await withTokenRetry("google-drive", config, async (accessToken) => {
    const folderId = await getOrCreateGoogleDriveFolder(accessToken, config.folderId);

    const startRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "application/gzip",
        "X-Upload-Content-Length": String(size),
      },
      body: JSON.stringify({ name: fileName, parents: [folderId] }),
    });
    await assertOk(startRes, "Starting Google Drive upload");
    const uploadUrl = startRes.headers.get("Location");
    if (!uploadUrl) throw new Error("Google Drive did not return an upload session URL");

    // Whole file in one PUT — Google's resumable-session docs explicitly
    // support this for a single request, not just chunked; chunking is
    // only needed for resuming an interrupted transfer, which this app
    // doesn't attempt (a failed run is simply retried on the next
    // scheduled backup or a manual "Upload to cloud" click).
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Length": String(size) },
      body,
    });
    await assertOk(putRes, "Uploading to Google Drive");
  });
}

export async function pruneGoogleDriveBackups(config: DriveBackupConfig, keep: number): Promise<void> {
  await withTokenRetry("google-drive", config, async (accessToken) => {
    const folderId = await getOrCreateGoogleDriveFolder(accessToken, config.folderId);
    const query = encodeURIComponent(`'${folderId}' in parents and trashed=false and name contains '.tar.gz'`);
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,createdTime)&orderBy=createdTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    await assertOk(listRes, "Listing Google Drive backups");
    const { files } = await listRes.json();
    for (const file of (files ?? []).slice(keep)) {
      const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (delRes.status === 401) throw new DriveUnauthorizedError("Pruning Google Drive backups");
      // A 404 here (already deleted by a concurrent run) isn't worth failing over.
    }
  });
}

export async function testGoogleDriveConnection(config: DriveBackupConfig): Promise<void> {
  await withTokenRetry("google-drive", config, async (accessToken) => {
    const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    await assertOk(res, "Google Drive connection test");
  });
}

// --- OneDrive (Microsoft Graph) ----------------------------------------

const ONEDRIVE_FOLDER_PATH = "LawyerAssistantBackups";
// Must be a multiple of 320 KiB per Graph's upload-session requirements;
// comfortably under the hard 60 MiB-per-request ceiling.
const ONEDRIVE_CHUNK_SIZE = 320 * 1024 * 25; // ~7.8 MiB

export async function uploadToOneDrive(config: DriveBackupConfig, filePath: string, fileName: string): Promise<void> {
  const size = (await stat(filePath)).size;
  const body = await readFile(filePath);

  await withTokenRetry("onedrive", config, async (accessToken) => {
    const sessionRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${ONEDRIVE_FOLDER_PATH}/${encodeURIComponent(fileName)}:/createUploadSession`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }),
      },
    );
    await assertOk(sessionRes, "Starting OneDrive upload");
    const { uploadUrl } = await sessionRes.json();

    // Chunked PUTs, no Authorization header on these — Graph's docs warn a
    // bearer token on the upload-session PUT can itself trigger a 401.
    for (let offset = 0; offset < size; offset += ONEDRIVE_CHUNK_SIZE) {
      const end = Math.min(offset + ONEDRIVE_CHUNK_SIZE, size);
      const chunk = body.subarray(offset, end);
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${offset}-${end - 1}/${size}`,
        },
        body: chunk,
      });
      if (!putRes.ok && putRes.status !== 200 && putRes.status !== 201 && putRes.status !== 202) {
        throw new Error(`Uploading to OneDrive: ${putRes.status} ${await putRes.text()}`);
      }
    }
  });
}

export async function pruneOneDriveBackups(config: DriveBackupConfig, keep: number): Promise<void> {
  await withTokenRetry("onedrive", config, async (accessToken) => {
    const listRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${ONEDRIVE_FOLDER_PATH}:/children?$select=id,name,createdDateTime&$orderby=createdDateTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (listRes.status === 404) return; // no backups uploaded yet — folder doesn't exist
    await assertOk(listRes, "Listing OneDrive backups");
    const { value } = await listRes.json();
    const backups = (value ?? []).filter((item: { name: string }) => item.name.endsWith(".tar.gz"));
    for (const item of backups.slice(keep)) {
      const delRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${item.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (delRes.status === 401) throw new DriveUnauthorizedError("Pruning OneDrive backups");
    }
  });
}

export async function testOneDriveConnection(config: DriveBackupConfig): Promise<void> {
  await withTokenRetry("onedrive", config, async (accessToken) => {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/drive", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    await assertOk(res, "OneDrive connection test");
  });
}
