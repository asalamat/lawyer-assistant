import { readSecureJson, writeSecureJson } from "./secureStore";
import type { DriveProvider } from "./cloudDriveBackup";

// Deliberately its own encrypted file, separate from emailIntegration.ts's
// oauth.json — cloud-backup and email-reading are different features with
// different consent screens and different scopes; conflating their app
// registrations under one shared credential store (the previous design)
// made the Settings UI confusingly claim "this is the same app the email
// integration uses" when a firm may want backup connected without ever
// setting up email, or vice versa.
const DRIVE_OAUTH_FILE = "driveOauth.json";

export interface DriveAppCredentials {
  clientId: string;
  // OneDrive is registered as a public client (Azure AD "Mobile and desktop
  // applications" platform) — PKCE replaces the need for a secret entirely,
  // and Microsoft's own guidance is public clients shouldn't have one.
  // Google's "Desktop app" OAuth client type still issues a secret its token
  // endpoint expects, though Google's docs don't treat it as confidential
  // for installed apps — kept optional here so OneDrive's credential object
  // simply omits it.
  clientSecret?: string;
}

type DriveOAuthCredentialsFile = Partial<Record<DriveProvider, DriveAppCredentials>>;

export async function getDriveAppCredentials(provider: DriveProvider): Promise<DriveAppCredentials | null> {
  const all = await readSecureJson<DriveOAuthCredentialsFile>(DRIVE_OAUTH_FILE, {});
  const creds = all[provider];
  return creds?.clientId ? creds : null;
}

export async function setDriveAppCredentials(
  provider: DriveProvider,
  clientId: string,
  clientSecret?: string,
): Promise<void> {
  const all = await readSecureJson<DriveOAuthCredentialsFile>(DRIVE_OAUTH_FILE, {});
  all[provider] = clientSecret ? { clientId, clientSecret } : { clientId };
  await writeSecureJson(DRIVE_OAUTH_FILE, all);
}

export async function getDriveAppCredentialStatus(): Promise<Record<DriveProvider, boolean>> {
  const all = await readSecureJson<DriveOAuthCredentialsFile>(DRIVE_OAUTH_FILE, {});
  return {
    "google-drive": Boolean(all["google-drive"]?.clientId),
    onedrive: Boolean(all.onedrive?.clientId),
  };
}
