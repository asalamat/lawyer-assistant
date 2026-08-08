// A per-IP rate limit for the embeddable public intake form
// (/leads/public) — the one truly anonymous, unauthenticated write path in
// this app. In-memory, per-process — resets on restart, same tradeoff the
// login rate limiter and export guard already make for this app's
// single-server deployment model. Deliberately its own small limiter
// rather than reusing exportGuard.ts: that one's audit message is worded
// for bulk exports/downloads, which wouldn't read sensibly here.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_SUBMISSIONS_PER_IP = 5;

interface WindowState {
  count: number;
  windowStartedAt: number;
}

const submissionsByIp = new Map<string, WindowState>();

export function checkPublicLeadRateLimit(ip: string): boolean {
  const now = Date.now();
  const state = submissionsByIp.get(ip);
  if (!state || now - state.windowStartedAt > WINDOW_MS) {
    submissionsByIp.set(ip, { count: 1, windowStartedAt: now });
    return true;
  }
  state.count += 1;
  return state.count <= MAX_SUBMISSIONS_PER_IP;
}
