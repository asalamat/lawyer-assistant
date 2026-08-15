import { NextResponse } from "next/server";
import { completeQuickBooksOAuthCallback, consumeQuickBooksOAuthState } from "@/lib/quickbooks";

export async function GET(request: Request) {
  const settingsUrl = new URL("/settings/quickbooks", request.url);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const realmId = url.searchParams.get("realmId");
  const providerError = url.searchParams.get("error");

  if (providerError) {
    settingsUrl.searchParams.set("qbError", providerError);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code || !state || !realmId) {
    settingsUrl.searchParams.set("qbError", "Invalid or expired OAuth state");
    return NextResponse.redirect(settingsUrl);
  }
  if (!consumeQuickBooksOAuthState(state)) {
    settingsUrl.searchParams.set("qbError", "Invalid or expired OAuth state");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const redirectUri = `${url.origin}/api/settings/quickbooks/callback`;
    await completeQuickBooksOAuthCallback(code, redirectUri, realmId);
    settingsUrl.searchParams.set("qbConnected", "1");
  } catch (err) {
    settingsUrl.searchParams.set("qbError", err instanceof Error ? err.message : "Connection failed");
  }
  return NextResponse.redirect(settingsUrl);
}
