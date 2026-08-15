import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import { listMattersForClient } from "./clients";
import db from "./db";
import { getLastSmsPollAt, getTwilioConfig, setLastSmsPollAt } from "./settings";
import { listInboundSince } from "./sms";

// This app has no public URL for Twilio to webhook an inbound reply to
// (same constraint as DocuSign — see docusignScheduler.ts), so inbound SMS
// is discovered by polling Twilio's message list instead.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const STARTUP_DELAY_MS = 60_000;

let started = false;

function lastTenDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

// Matches an inbound message's "from" number against every client's own
// phone number — comparing only the last 10 digits so +1/country-code/
// formatting differences between what Twilio reports and what's on file
// don't cause a real match to be missed.
function findClientIdByPhone(fromPhone: string): string | null {
  const digits = lastTenDigits(fromPhone);
  if (digits.length < 10) return null;
  const row = db
    .prepare("SELECT id, phone FROM clients WHERE phone IS NOT NULL")
    .all() as { id: string; phone: string }[];
  const match = row.find((c) => lastTenDigits(c.phone) === digits);
  return match?.id ?? null;
}

async function attachInboundMessage(fromPhone: string, body: string, twilioSid: string): Promise<void> {
  const clientId = findClientIdByPhone(fromPhone);
  if (!clientId) {
    console.warn(`[sms-scheduler] inbound message from ${fromPhone} matches no client on file — not attributed to any matter`);
    return;
  }

  const matters = await listMattersForClient(clientId);
  // Prefer the most recently created OPEN matter — an inbound text almost
  // always concerns whatever's currently active, not a closed/archived one.
  const matter = matters.find((m) => m.status === "open") ?? matters[0];
  if (!matter) return;

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO sms_messages (id, matterId, direction, phoneNumber, body, twilioSid, createdAt) VALUES (?, ?, 'inbound', ?, ?, ?, ?)",
  ).run(id, matter.id, fromPhone, body, twilioSid, createdAt);

  await recordAuditEvent("sms_received", matter.id, `Received a text message from ${fromPhone}`);
}

async function checkInboundMessages(): Promise<void> {
  const config = await getTwilioConfig();
  if (!config) return;

  const lastPollAt = await getLastSmsPollAt();
  if (!lastPollAt) {
    // First run ever — nothing to backfill against unknown history, just
    // start the clock from now so the next tick has a real window to check.
    await setLastSmsPollAt(new Date().toISOString());
    return;
  }

  const messages = await listInboundSince(lastPollAt);
  for (const message of messages) {
    try {
      await attachInboundMessage(message.from, message.body, message.sid);
    } catch (err) {
      console.error(`[sms-scheduler] failed to attach inbound message ${message.sid}:`, err);
    }
  }
  await setLastSmsPollAt(new Date().toISOString());
}

export function startSmsScheduler(): void {
  if (started) return;
  started = true;
  console.log("[sms-scheduler] started — checking for inbound text messages every 5 minutes");
  setInterval(() => {
    checkInboundMessages().catch((err) => console.error("[sms-scheduler] tick failed:", err));
  }, CHECK_INTERVAL_MS);
  setTimeout(() => {
    checkInboundMessages().catch((err) => console.error("[sms-scheduler] initial check failed:", err));
  }, STARTUP_DELAY_MS);
}
