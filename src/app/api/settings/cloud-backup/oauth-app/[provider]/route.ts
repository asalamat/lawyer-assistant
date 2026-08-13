import { NextResponse } from "next/server";
import { setDriveAppCredentials } from "@/lib/driveOAuthApp";
import { DRIVE_PROVIDER_CONFIG, type DriveProvider } from "@/lib/cloudDriveBackup";

const DRIVE_PROVIDERS: DriveProvider[] = ["google-drive", "onedrive"];

// Catches an obviously-wrong value before it's saved at all, rather than
// accepting anything non-empty and only failing later at the provider's own
// authorize endpoint with a cryptic error — same reasoning as the email
// integration's credential validation.
function validationError(provider: DriveProvider, clientId: string, clientSecret: string | undefined): string | null {
  if (provider === "google-drive" && !clientId.endsWith(".apps.googleusercontent.com")) {
    return 'A Google OAuth Client ID always ends in ".apps.googleusercontent.com" — this looks like something else. Get the real one from Google Cloud Console > APIs & Services > Credentials.';
  }
  if (provider === "onedrive" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    return "A Microsoft Application (client) ID is always a GUID (e.g. 12345678-1234-1234-1234-123456789abc) — get the real one from the Azure Portal > App registrations > your app > Overview.";
  }
  // OneDrive is registered as a public client — no secret at all, so only
  // Google's requires (and validates) one.
  if (provider === "google-drive" && (!clientSecret || clientSecret.length < 16)) {
    return "That client secret looks too short to be real — double-check you copied the secret's Value, not its ID, and that it wasn't truncated.";
  }
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!DRIVE_PROVIDERS.includes(provider as DriveProvider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  const typedProvider = provider as DriveProvider;

  const body = await request.json();
  const clientId = body?.clientId;
  const clientSecret = body?.clientSecret;
  if (typeof clientId !== "string" || !clientId.trim()) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  if (clientSecret !== undefined && typeof clientSecret !== "string") {
    return NextResponse.json({ error: "clientSecret must be a string" }, { status: 400 });
  }

  const trimmedId = clientId.trim();
  const trimmedSecret = typeof clientSecret === "string" ? clientSecret.trim() : undefined;
  const validationIssue = validationError(typedProvider, trimmedId, trimmedSecret);
  if (validationIssue) {
    return NextResponse.json({ error: validationIssue }, { status: 400 });
  }

  await setDriveAppCredentials(typedProvider, trimmedId, trimmedSecret || undefined);
  return NextResponse.json({ success: true, displayName: DRIVE_PROVIDER_CONFIG[typedProvider].displayName });
}
