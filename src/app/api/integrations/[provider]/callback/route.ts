import { NextResponse } from "next/server";
import { completeDriveOAuthCallback, consumeDriveOAuthState } from "@/lib/cloudDriveBackup";
import {
  consumeOAuthState,
  getOAuthCredentials,
  PROVIDER_CONFIG,
  saveEmailAccount,
} from "@/lib/emailIntegration";
import { EMAIL_PROVIDERS, type EmailProvider } from "@/lib/types";

function extractEmail(provider: EmailProvider, profile: Record<string, unknown>): string | null {
  if (provider === "microsoft") {
    return (profile.mail as string) || (profile.userPrincipalName as string) || null;
  }
  return (profile.email as string) || null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const settingsUrl = new URL("/settings", request.url);

  if (!EMAIL_PROVIDERS.includes(provider as EmailProvider)) {
    settingsUrl.searchParams.set("integrationError", "Unknown provider");
    return NextResponse.redirect(settingsUrl);
  }
  const typedProvider = provider as EmailProvider;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  if (providerError) {
    settingsUrl.searchParams.set("integrationError", providerError);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code || !state) {
    settingsUrl.searchParams.set("integrationError", "Invalid or expired OAuth state");
    return NextResponse.redirect(settingsUrl);
  }

  // This one redirect URI is shared by two independent OAuth round trips —
  // the email integration's and cloud backup's Google Drive/OneDrive
  // connection (see /api/settings/cloud-backup/connect) — so Azure AD/
  // Google Cloud only need a single registered redirect URI. `state` is
  // how this route tells which flow a given callback belongs to: each
  // flow's connect route stashes it in its own in-memory map, so trying
  // the drive map first (a no-op if this state isn't actually one of
  // its own) resolves it safely either way.
  const driveProvider = consumeDriveOAuthState(state);
  if (driveProvider) {
    const backupSettingsUrl = new URL("/settings/backup", request.url);
    try {
      const redirectUri = `${url.origin}/api/integrations/${typedProvider}/callback`;
      await completeDriveOAuthCallback(driveProvider, code, redirectUri);
      backupSettingsUrl.searchParams.set("cloudBackupConnected", driveProvider);
    } catch (err) {
      backupSettingsUrl.searchParams.set(
        "cloudBackupError",
        err instanceof Error ? err.message : "Connection failed",
      );
    }
    return NextResponse.redirect(backupSettingsUrl);
  }

  if (consumeOAuthState(state) !== typedProvider) {
    settingsUrl.searchParams.set("integrationError", "Invalid or expired OAuth state");
    return NextResponse.redirect(settingsUrl);
  }

  const credentials = await getOAuthCredentials(typedProvider);
  if (!credentials) {
    settingsUrl.searchParams.set("integrationError", "OAuth credentials not configured");
    return NextResponse.redirect(settingsUrl);
  }

  const config = PROVIDER_CONFIG[typedProvider];
  const redirectUri = `${url.origin}/api/integrations/${typedProvider}/callback`;

  try {
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.clientId!,
        client_secret: credentials.clientSecret!,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${await tokenResponse.text()}`);
    }
    const tokens = await tokenResponse.json();

    const profileResponse = await fetch(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileResponse.ok) {
      throw new Error(`Fetching profile failed: ${profileResponse.status}`);
    }
    const profile = await profileResponse.json();
    const emailAddress = extractEmail(typedProvider, profile);
    if (!emailAddress) throw new Error("Could not determine the connected account's email address");

    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await saveEmailAccount({
      provider: typedProvider,
      emailAddress,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiresAt,
      authMethod: "oauth",
    });

    settingsUrl.searchParams.set("connected", typedProvider);
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    settingsUrl.searchParams.set(
      "integrationError",
      err instanceof Error ? err.message : "Connection failed",
    );
    return NextResponse.redirect(settingsUrl);
  }
}
