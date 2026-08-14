import { listUsers } from "./auth";
import { createNotificationIfNew } from "./calendar";
import db from "./db";
import { isEmailConfigured, sendEmail } from "./email";
import { sendPushToAllSubscribers } from "./push";

// Checked hourly, not every minute like backupScheduler — reminders are
// day-granularity (due dates, event dates), so there's no benefit to
// finer-grained polling, just wasted work.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const STARTUP_DELAY_MS = 45_000;

// Deadlines don't carry a configurable lead time the way calendar_events
// do (there's no UI for it, and AI-extracted/rule-computed deadlines have
// no natural place to set one) — a flat 1-day-before reminder for all of
// them is simpler and good enough; calendar_events use whatever
// reminderDaysBefore was set when the event was created.
const DEADLINE_REMINDER_DAYS_BEFORE = 1;

let started = false;

function addDaysToIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// Notifications are firm-wide, not per-user (see calendar.ts), so a reminder
// email goes to every active staff account and a push goes to every
// subscribed browser, rather than one specific owner.
async function sendReminderEmail(subject: string, body: string): Promise<void> {
  if (!(await isEmailConfigured())) return;
  const recipients = (await listUsers())
    .filter((u) => u.active)
    .map((u) => u.email);
  if (recipients.length === 0) return;
  await sendEmail({ to: recipients.join(", "), subject, text: body });
}

async function dispatchReminderAlert(title: string, body: string, url = "/calendar"): Promise<void> {
  await Promise.all([
    sendReminderEmail(title, body),
    sendPushToAllSubscribers({ title, body, url }),
  ]);
}

async function checkDeadlineReminders(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const reminderTargetDate = addDaysToIso(today, DEADLINE_REMINDER_DAYS_BEFORE);

  const dueTomorrow = db
    .prepare(
      `SELECT d.id, d.description, d.matterId, m.title as matterTitle
       FROM matter_deadlines d JOIN matters m ON m.id = d.matterId
       WHERE d.dueDate = ?`,
    )
    .all(reminderTargetDate) as { id: string; description: string; matterId: string; matterTitle: string }[];

  for (const d of dueTomorrow) {
    const title = `Due tomorrow: ${d.matterTitle}`;
    const isNew = await createNotificationIfNew({
      type: "deadline_reminder",
      title,
      body: d.description,
      matterId: d.matterId,
      relatedType: "deadline",
      relatedId: d.id,
    });
    if (isNew) await dispatchReminderAlert(title, d.description);
  }

  const overdueToday = db
    .prepare(
      `SELECT d.id, d.description, d.matterId, m.title as matterTitle
       FROM matter_deadlines d JOIN matters m ON m.id = d.matterId
       WHERE d.dueDate = ?`,
    )
    .all(today) as { id: string; description: string; matterId: string; matterTitle: string }[];

  for (const d of overdueToday) {
    const title = `Due today: ${d.matterTitle}`;
    const isNew = await createNotificationIfNew({
      type: "deadline_overdue",
      title,
      body: d.description,
      matterId: d.matterId,
      relatedType: "deadline",
      relatedId: d.id,
    });
    if (isNew) await dispatchReminderAlert(title, d.description);
  }
}

async function checkEventReminders(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const events = db
    .prepare(
      `SELECT e.id, e.title, e.startDate, e.reminderDaysBefore, e.matterId, m.title as matterTitle
       FROM calendar_events e LEFT JOIN matters m ON m.id = e.matterId
       WHERE e.reminderDaysBefore IS NOT NULL AND e.startDate >= ?`,
    )
    .all(today) as {
    id: string;
    title: string;
    startDate: string;
    reminderDaysBefore: number;
    matterId: string | null;
    matterTitle: string | null;
  }[];

  for (const e of events) {
    const reminderDate = addDaysToIso(e.startDate, -e.reminderDaysBefore);
    if (reminderDate > today) continue; // not due yet
    const title = e.matterTitle ? `${e.title} — ${e.matterTitle}` : e.title;
    const body = `On ${e.startDate}`;
    const isNew = await createNotificationIfNew({
      type: "event_reminder",
      title,
      body,
      matterId: e.matterId,
      relatedType: "calendar_event",
      relatedId: e.id,
    });
    if (isNew) await dispatchReminderAlert(title, body);
  }
}

// Keyed on the matter's latest trust_transaction id, not the matter id
// itself — the notifications table's UNIQUE(relatedType, relatedId, type)
// constraint means a static key (e.g. matterId) would only ever fire once,
// ever, even after the retainer is topped up and later drops low again.
// The latest transaction id changes with every deposit/withdrawal, so this
// naturally re-arms after each new transaction while staying silent for a
// balance that's been low with no new activity — same "notify once per new
// occurrence" semantics as deadline_overdue, just occurrence = transaction
// instead of occurrence = calendar day.
async function checkRetainerBalances(): Promise<void> {
  const matters = db
    .prepare(
      `SELECT id, title, retainerThreshold FROM matters
       WHERE retainerThreshold IS NOT NULL AND status = 'open'`,
    )
    .all() as { id: string; title: string; retainerThreshold: number }[];

  for (const matter of matters) {
    const balanceRow = db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) as balance
         FROM trust_transactions WHERE matterId = ?`,
      )
      .get(matter.id) as { balance: number };
    if (balanceRow.balance >= matter.retainerThreshold) continue;

    const latest = db
      .prepare("SELECT id FROM trust_transactions WHERE matterId = ? ORDER BY createdAt DESC LIMIT 1")
      .get(matter.id) as { id: string } | undefined;

    const title = `Retainer low: ${matter.title}`;
    const body = `Trust balance is $${balanceRow.balance.toFixed(2)}, below the $${matter.retainerThreshold.toFixed(2)} threshold.`;
    const isNew = await createNotificationIfNew({
      type: "retainer_low",
      title,
      body,
      matterId: matter.id,
      relatedType: latest ? "trust_transaction" : "matter",
      relatedId: latest ? latest.id : matter.id,
    });
    if (isNew) await dispatchReminderAlert(title, body, `/matters/${matter.id}/trust`);
  }
}

function runTick(): void {
  checkDeadlineReminders().catch((err) => console.error("[notification-scheduler] deadline check failed:", err));
  checkEventReminders().catch((err) => console.error("[notification-scheduler] event check failed:", err));
  checkRetainerBalances().catch((err) => console.error("[notification-scheduler] retainer check failed:", err));
}

export function startNotificationScheduler(): void {
  if (started) return;
  started = true;
  console.log("[notification-scheduler] started — checking hourly for due reminders");
  setInterval(runTick, CHECK_INTERVAL_MS);
  setTimeout(runTick, STARTUP_DELAY_MS);
}
