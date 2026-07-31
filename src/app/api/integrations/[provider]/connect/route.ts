import { NextResponse } from "next/server";
import { createOAuthState, getOAuthCredentials, PROVIDER_CONFIG } from "@/lib/emailIntegration";
import { EMAIL_PROVIDERS, type EmailProvider } from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!EMAIL_PROVIDERS.includes(provider as EmailProvider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  const typedProvider = provider as EmailProvider;

  const credentials = await getOAuthCredentials(typedProvider);
  if (!credentials) {
    return NextResponse.json(
      { error: "No OAuth Client ID/Secret configured for this provider yet. Add them in Settings first." },
      { status: 400 },
    );
  }

  const config = PROVIDER_CONFIG[typedProvider];
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/integrations/${typedProvider}/callback`;
  const state = createOAuthState(typedProvider);

  const authorizeUrl = new URL(config.authUrl);
  authorizeUrl.searchParams.set("client_id", credentials.clientId!);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", config.scope);
  authorizeUrl.searchParams.set("state", state);
  for (const [key, value] of Object.entries(config.extraAuthParams ?? {})) {
    authorizeUrl.searchParams.set(key, value);
  }

  return NextResponse.redirect(authorizeUrl.toString());
}
