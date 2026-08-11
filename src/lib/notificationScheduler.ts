import { createNotificationIfNew } from "./calendar";
import db from "./db";

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
    await createNotificationIfNew({
      type: "deadline_reminder",
      title: `Due tomorrow: ${d.matterTitle}`,
      body: d.description,
      matterId: d.matterId,
      relatedType: "deadline",
      relatedId: d.id,
    });
  }

  const overdueToday = db
    .prepare(
      `SELECT d.id, d.description, d.matterId, m.title as matterTitle
       FROM matter_deadlines d JOIN matters m ON m.id = d.matterId
       WHERE d.dueDate = ?`,
    )
    .all(today) as { id: string; description: string; matterId: string; matterTitle: string }[];

  for (const d of overdueToday) {
    await createNotificationIfNew({
      type: "deadline_overdue",
      title: `Due today: ${d.matterTitle}`,
      body: d.description,
      matterId: d.matterId,
      relatedType: "deadline",
      relatedId: d.id,
    });
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
    await createNotificationIfNew({
      type: "event_reminder",
      title: e.matterTitle ? `${e.title} — ${e.matterTitle}` : e.title,
      body: `On ${e.startDate}`,
      matterId: e.matterId,
      relatedType: "calendar_event",
      relatedId: e.id,
    });
  }
}

function runTick(): void {
  checkDeadlineReminders().catch((err) => console.error("[notification-scheduler] deadline check failed:", err));
  checkEventReminders().catch((err) => console.error("[notification-scheduler] event check failed:", err));
}

export function startNotificationScheduler(): void {
  if (started) return;
  started = true;
  console.log("[notification-scheduler] started — checking hourly for due reminders");
  setInterval(runTick, CHECK_INTERVAL_MS);
  setTimeout(runTick, STARTUP_DELAY_MS);
}
