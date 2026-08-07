import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessMatter } from "@/lib/matterAccess";

// Sub-routes of /api/matters/ (and only /api/matters/, not /matters/ pages)
// that aren't a matterId — a real matterId can never collide with these
// since matter ids are UUIDs.
const NON_ID_API_MATTERS_SEGMENTS = new Set(["search", "conflicts"]);

function extractMatterId(pathname: string): string | null {
  const apiMatch = pathname.match(/^\/api\/matters\/([^/]+)/);
  if (apiMatch) {
    return NON_ID_API_MATTERS_SEGMENTS.has(apiMatch[1]) ? null : apiMatch[1];
  }
  const pageMatch = pathname.match(/^\/matters\/([^/]+)/);
  return pageMatch ? pageMatch[1] : null;
}

// The legislation-watches check-all and backup/scheduled routes are meant
// for an unattended OS cron job (no browser session exists there) — each
// does its own bearer-token check against the cron secret instead (see
// settings.ts getOrCreateCronSecret and the routes themselves).
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/mfa",
  "/api/legislation-watches/check-all",
  "/api/backup/scheduled",
];

// Client-facing, no-login, token-gated routes (see src/lib/clientAccess.ts).
// Each one is scoped to a single expiring resource token, not a session —
// deliberately not a client portal. Auth for these lives in the route
// handler itself (validating the token), not here.
const PUBLIC_PATH_PREFIXES = ["/sign/", "/api/sign/", "/intake/", "/api/intake/"];

// Settings pages/API routes configure shared, firm-wide resources (API
// keys, SMTP, integrations, system updates, backups) — restricted to
// admins. /settings/security is the exception: every user needs it to
// change their own password.
const ADMIN_ONLY_API_PREFIXES = [
  "/api/settings",
  "/api/users",
  "/api/integrations",
  "/api/system/update",
  "/api/backup",
  "/api/monitoring",
];

// Pages under /settings that are personal preferences, not firm-wide
// resources — open to every user, not just admins.
const NON_ADMIN_SETTINGS_PAGES = ["/settings", "/settings/security", "/settings/translation"];

// Top-level (non-/settings) pages that are still admin-only — operational/
// infrastructure detail (storage paths, row counts, backup state), same
// sensitivity tier as Settings even though the URL lives outside it.
const ADMIN_ONLY_TOP_LEVEL_PAGES = ["/monitoring"];

function isAdminOnlyPage(pathname: string): boolean {
  if (ADMIN_ONLY_TOP_LEVEL_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) {
    return true;
  }
  if (!pathname.startsWith("/settings")) return false;
  return !NON_ADMIN_SETTINGS_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );
}

function isAdminOnlyApi(pathname: string): boolean {
  // Appearance and Translation settings are personal preferences, not
  // firm-wide resources like API keys — open to all users.
  if (pathname === "/api/settings/location" || pathname === "/api/settings/translation") {
    return false;
  }
  return ADMIN_ONLY_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
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

  const matterId = extractMatterId(pathname);
  if (matterId && !canAccessMatter(user.id, user.role, matterId)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "This matter is restricted to its assigned team" },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/matters", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
