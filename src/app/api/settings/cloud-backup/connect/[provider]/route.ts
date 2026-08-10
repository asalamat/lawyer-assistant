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
    const emailKey = DRIVE_PROVIDER_CONFIG[typedProvider].emailProviderKey;
    return NextResponse.json(
      {
        error: `No OAuth Client ID/Secret configured yet. Add one in Settings > Integrations (the ${emailKey === "google" ? "Google" : "Microsoft"} entry) — the same app registration used for email works here too, as long as it also has the Drive/Files scope enabled.`,
      },
      { status: 400 },
    );
  }

  // Reuses the SAME redirect URI already registered for the email
  // integration (see /api/integrations/[provider]/callback, which branches
  // on whether `state` matches an email or a drive-backup OAuth attempt) —
  // Azure AD/Google Cloud only need one redirect URI on file, not a second
  // one just for backups.
  const origin = new URL(request.url).origin;
  const emailProviderKey = DRIVE_PROVIDER_CONFIG[typedProvider].emailProviderKey;
  const redirectUri = `${origin}/api/integrations/${emailProviderKey}/callback`;
  const state = createDriveOAuthState(typedProvider);
  const authorizeUrl = buildDriveAuthorizeUrl(typedProvider, credentials.clientId!, redirectUri, state);
  return NextResponse.redirect(authorizeUrl);
}
