import { NextRequest, NextResponse } from "next/server";
import { isValidSession } from "@/lib/auth";

// The legislation-watches check-all route is meant for an unattended OS
// cron job (no browser session exists there) — it does its own bearer-token
// check against a separate cron secret instead (see settings.ts
// getOrCreateCronSecret and the route itself).
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/legislation-watches/check-all"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  const authed = await isValidSession(token);
  if (authed) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
