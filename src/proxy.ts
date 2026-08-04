import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

// The legislation-watches check-all route is meant for an unattended OS
// cron job (no browser session exists there) — it does its own bearer-token
// check against a separate cron secret instead (see settings.ts
// getOrCreateCronSecret and the route itself).
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/legislation-watches/check-all"];

// Settings pages/API routes configure shared, firm-wide resources (API
// keys, SMTP, integrations, system updates) — restricted to admins.
// /settings/security is the exception: every user needs it to change their
// own password.
const ADMIN_ONLY_API_PREFIXES = ["/api/settings", "/api/users", "/api/integrations", "/api/system/update"];

function isAdminOnlyPage(pathname: string): boolean {
  if (!pathname.startsWith("/settings")) return false;
  if (pathname === "/settings") return false;
  if (pathname === "/settings/security" || pathname.startsWith("/settings/security/")) return false;
  return true;
}

function isAdminOnlyApi(pathname: string): boolean {
  if (pathname === "/api/settings/location") return false; // Appearance page, open to all users
  return ADMIN_ONLY_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  const user = await getSessionUser(token);

  if (!user) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user.role !== "admin") {
    if (pathname.startsWith("/api") && isAdminOnlyApi(pathname)) {
      return NextResponse.json({ error: "Admins only" }, { status: 403 });
    }
    if (!pathname.startsWith("/api") && isAdminOnlyPage(pathname)) {
      return NextResponse.redirect(new URL("/settings/security", request.url));
    }
  }

  if (
    user.mustChangePassword &&
    pathname !== "/settings/security" &&
    !pathname.startsWith("/api/auth")
  ) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Password change required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/settings/security", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
