import { NextResponse } from "next/server";
import {
  buildDriveAuthorizeUrl,
  createDriveOAuthState,
  DRIVE_PROVIDER_CONFIG,
  getDriveOAuthClientCredentials,
  type DriveProvider,
} from "@/lib/cloudDriveBackup";

const DRIVE_PROVIDERS: DriveProvider[] = ["google-drive", "onedrive"];

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!DRIVE_PROVIDERS.includes(provider as DriveProvider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  const typedProvider = provider as DriveProvider;

  const credentials = await getDriveOAuthClientCredentials(typedProvider);
  if (!credentials) {
    return NextResponse.json(
      {
        error: `No ${DRIVE_PROVIDER_CONFIG[typedProvider].displayName} app registered yet — set it up once in Settings > Backup.`,
      },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/settings/cloud-backup/oauth/${typedProvider}/callback`;
  const { state, challenge } = createDriveOAuthState(typedProvider);
  const authorizeUrl = buildDriveAuthorizeUrl(typedProvider, credentials.clientId, redirectUri, state, challenge);
  return NextResponse.redirect(authorizeUrl);
}
