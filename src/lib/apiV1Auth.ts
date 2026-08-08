import { verifyApiKey } from "./apiKeys";

// Shared by every /api/v1/* route — this whole prefix is public at
// proxy.ts's middleware level (same reasoning as the cron-secret endpoints:
// a machine credential has no session, and the staff-session/matter-access
// logic in the shared middleware doesn't apply to it), so each route checks
// its own Authorization header.
export async function requireApiKey(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  return verifyApiKey(key);
}
