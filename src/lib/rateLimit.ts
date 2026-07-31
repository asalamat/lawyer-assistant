// Global (not per-IP) rate limiting for the login endpoint. This app has
// exactly one legitimate account, so a global counter is just as effective
// against brute force as a per-IP one — and doesn't depend on reliably
// extracting a client IP from behind whatever's in front of `next start`.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

let failureCount = 0;
let windowStartedAt = 0;
let lockedUntil = 0;

export function checkLoginRateLimit(): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (now < lockedUntil) {
    return { allowed: false, retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLogin(): void {
  const now = Date.now();
  if (now - windowStartedAt > WINDOW_MS) {
    windowStartedAt = now;
    failureCount = 0;
  }
  failureCount += 1;
  if (failureCount >= MAX_ATTEMPTS) {
    lockedUntil = now + LOCKOUT_MS;
  }
}

export function recordSuccessfulLogin(): void {
  failureCount = 0;
  lockedUntil = 0;
}
