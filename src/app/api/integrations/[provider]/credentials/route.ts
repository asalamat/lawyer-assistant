import { NextResponse } from "next/server";
import { setOAuthCredentials } from "@/lib/emailIntegration";
import { EMAIL_PROVIDERS, type EmailProvider } from "@/lib/types";

// Catches an obviously-wrong value (a pasted email address, a placeholder,
// a client secret typed into the wrong field) before it's saved at all,
// rather than accepting anything non-empty and only failing later at the
// provider's own authorize endpoint with a cryptic error — exactly what
// happened live: a Google "Client ID" that was actually the account's own
// email address saved successfully, looked "configured" in the UI, and
// only failed with "Error 401: invalid_client" once a real sign-in was
// attempted. Loose on purpose beyond the hard, well-documented format
// invariants below — not trying to fully validate a real credential,
// just reject values that can't possibly be one.
function validationError(provider: EmailProvider, clientId: string, clientSecret: string): string | null {
  if (provider === "google" && !clientId.endsWith(".apps.googleusercontent.com")) {
    return 'A Google OAuth Client ID always ends in ".apps.googleusercontent.com" — this looks like something else (an email address, an API key, or a placeholder). Get the real one from Google Cloud Console > APIs & Services > Credentials.';
  }
  if (provider === "microsoft" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    return "A Microsoft Application (client) ID is always a GUID (e.g. 12345678-1234-1234-1234-123456789abc) — get the real one from the Azure Portal > App registrations > your app > Overview.";
  }
  if (clientSecret.length < 16) {
    return "That client secret looks too short to be real — double-check you copied the secret's Value, not its ID, and that it wasn't truncated.";
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!EMAIL_PROVIDERS.includes(provider as EmailProvider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  const typedProvider = provider as EmailProvider;

  const body = await request.json();
  const clientId = body?.clientId;
  const clientSecret = body?.clientSecret;
  if (typeof clientId !== "string" || !clientId.trim() || typeof clientSecret !== "string" || !clientSecret.trim()) {
    return NextResponse.json(
      { error: "clientId and clientSecret are required" },
      { status: 400 },
    );
  }

  const trimmedId = clientId.trim();
  const trimmedSecret = clientSecret.trim();
  const validationIssue = validationError(typedProvider, trimmedId, trimmedSecret);
  if (validationIssue) {
    return NextResponse.json({ error: validationIssue }, { status: 400 });
  }

  await setOAuthCredentials(typedProvider, trimmedId, trimmedSecret);
  return NextResponse.json({ success: true });
}
