import { NextResponse } from "next/server";
import { completeDriveOAuthCallback, consumeDriveOAuthState, type DriveProvider } from "@/lib/cloudDriveBackup";

const DRIVE_PROVIDERS: DriveProvider[] = ["google-drive", "onedrive"];

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const backupSettingsUrl = new URL("/settings/backup", request.url);

  if (!DRIVE_PROVIDERS.includes(provider as DriveProvider)) {
    backupSettingsUrl.searchParams.set("cloudBackupError", "Unknown provider");
    return NextResponse.redirect(backupSettingsUrl);
  }
  const typedProvider = provider as DriveProvider;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  if (providerError) {
    backupSettingsUrl.searchParams.set("cloudBackupError", providerError);
    return NextResponse.redirect(backupSettingsUrl);
  }
  if (!code || !state) {
    backupSettingsUrl.searchParams.set("cloudBackupError", "Invalid or expired OAuth state");
    return NextResponse.redirect(backupSettingsUrl);
  }

  const pending = consumeDriveOAuthState(state);
  if (!pending || pending.provider !== typedProvider) {
    backupSettingsUrl.searchParams.set("cloudBackupError", "Invalid or expired OAuth state");
    return NextResponse.redirect(backupSettingsUrl);
  }

  try {
    const redirectUri = `${url.origin}/api/settings/cloud-backup/oauth/${typedProvider}/callback`;
    await completeDriveOAuthCallback(typedProvider, code, redirectUri, pending.verifier);
    backupSettingsUrl.searchParams.set("cloudBackupConnected", typedProvider);
  } catch (err) {
    backupSettingsUrl.searchParams.set(
      "cloudBackupError",
      err instanceof Error ? err.message : "Connection failed",
    );
  }
  return NextResponse.redirect(backupSettingsUrl);
}
