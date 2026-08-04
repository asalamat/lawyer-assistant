// Per-account rate limiting for the login endpoint. Keyed by email rather
// than a single global counter (which used to be fine with exactly one
// account) so one attacker guessing against a single mailbox can't lock
// every other user out of the app too.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

interface LimitState {
  failureCount: number;
  windowStartedAt: number;
  lockedUntil: number;
}

const stateByEmail = new Map<string, LimitState>();

function keyFor(email: string): string {
  return email.trim().toLowerCase();
}

export function checkLoginRateLimit(email: string): { allowed: boolean; retryAfterSeconds: number } {
  const state = stateByEmail.get(keyFor(email));
  const now = Date.now();
  if (state && now < state.lockedUntil) {
    return { allowed: false, retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLogin(email: string): void {
  const key = keyFor(email);
  const now = Date.now();
  const state = stateByEmail.get(key) ?? { failureCount: 0, windowStartedAt: now, lockedUntil: 0 };
  if (now - state.windowStartedAt > WINDOW_MS) {
    state.windowStartedAt = now;
    state.failureCount = 0;
  }
  state.failureCount += 1;
  if (state.failureCount >= MAX_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_MS;
  }
  stateByEmail.set(key, state);
}

export function recordSuccessfulLogin(email: string): void {
  stateByEmail.delete(keyFor(email));
}
