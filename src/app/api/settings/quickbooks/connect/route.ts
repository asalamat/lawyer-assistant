import { NextResponse } from "next/server";
import { buildQuickBooksAuthorizeUrl, createQuickBooksOAuthState } from "@/lib/quickbooks";
import { getQuickBooksAppCredentials } from "@/lib/settings";

export async function GET(request: Request) {
  const app = await getQuickBooksAppCredentials();
  if (!app) {
    return NextResponse.json(
      { error: "No QuickBooks app registered yet — set it up once in Settings > QuickBooks." },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/settings/quickbooks/callback`;
  const state = createQuickBooksOAuthState();
  const authorizeUrl = buildQuickBooksAuthorizeUrl(app.clientId, redirectUri, state);
  return NextResponse.redirect(authorizeUrl);
}
