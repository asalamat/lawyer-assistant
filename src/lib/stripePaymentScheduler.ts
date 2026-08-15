import { finalizeStripeSession, listPendingStripeSessionIds } from "./payments";
import { isStripeConfigured } from "./stripe";

// Catches the case where a client completed payment but never returned to
// the success URL (closed the tab, connection dropped) — the success-page
// redirect is the fast path, this is the backstop. Same "no public URL for
// a webhook" reasoning as docusignScheduler.ts/smsScheduler.ts.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const STARTUP_DELAY_MS = 60_000;

let started = false;

async function checkPendingSessions(): Promise<void> {
  if (!(await isStripeConfigured())) return;

  const ids = await listPendingStripeSessionIds();
  for (const id of ids) {
    try {
      await finalizeStripeSession(id);
    } catch (err) {
      console.error(`[stripe-payment-scheduler] failed to check session ${id}:`, err);
    }
  }
}

export function startStripePaymentScheduler(): void {
  if (started) return;
  started = true;
  console.log("[stripe-payment-scheduler] started — checking pending online payments every 5 minutes");
  setInterval(() => {
    checkPendingSessions().catch((err) => console.error("[stripe-payment-scheduler] tick failed:", err));
  }, CHECK_INTERVAL_MS);
  setTimeout(() => {
    checkPendingSessions().catch((err) => console.error("[stripe-payment-scheduler] initial check failed:", err));
  }, STARTUP_DELAY_MS);
}
