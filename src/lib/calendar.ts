import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { AppNotification, CalendarEvent, CalendarItem, NotificationType } from "./types";

// --- Calendar events (ad-hoc, non-deadline entries) --------------------

export async function listCalendarEvents(matterId?: string): Promise<CalendarEvent[]> {
  const rows = matterId
    ? db.prepare("SELECT * FROM calendar_events WHERE matterId = ? ORDER BY startDate ASC").all(matterId)
    : db.prepare("SELECT * FROM calendar_events ORDER BY startDate ASC").all();
  return rows.map((row) => toPlain<CalendarEvent>(row));
}

export async function createCalendarEvent(params: {
  matterId: string | null;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  reminderDaysBefore: number | null;
  createdBy: string | null;
}): Promise<CalendarEvent> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO calendar_events (id, matterId, title, description, startDate, endDate, reminderDaysBefore, createdBy, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.matterId,
    params.title,
    params.description,
    params.startDate,
    params.endDate,
    params.reminderDaysBefore,
    params.createdBy,
    createdAt,
  );
  await recordAuditEvent(
    "calendar_event_created",
    params.matterId,
    `Added calendar event "${params.title}" on ${params.startDate}`,
  );
  return {
    id,
    matterId: params.matterId,
    title: params.title,
    description: params.description,
    startDate: params.startDate,
    endDate: params.endDate,
    reminderDaysBefore: params.reminderDaysBefore,
    createdBy: params.createdBy,
    createdAt,
  };
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const event = db.prepare("SELECT title, matterId FROM calendar_events WHERE id = ?").get(id) as
    | { title: string; matterId: string | null }
    | undefined;
  db.prepare("DELETE FROM calendar_events WHERE id = ?").run(id);
  if (event) {
    await recordAuditEvent("calendar_event_deleted", event.matterId, `Deleted calendar event "${event.title}"`);
  }
}

// --- Combined calendar view (deadlines + events, one shape) ------------

// Deadlines and events are two different tables with different shapes —
// this is the one place that normalizes both into what the calendar grid
// actually renders, so CalendarGrid never needs to know the two sources
// exist. matterId undefined = firm-wide (every matter's deadlines plus
// every event); provided = just that matter's.
export async function listCalendarItems(matterId?: string): Promise<CalendarItem[]> {
  const deadlineRows = (
    matterId
      ? db
          .prepare(
            `SELECT d.id, d.description, d.dueDate, d.matterId, m.title as matterTitle
             FROM matter_deadlines d JOIN matters m ON m.id = d.matterId
             WHERE d.dueDate IS NOT NULL AND d.matterId = ?`,
          )
          .all(matterId)
      : db
          .prepare(
            `SELECT d.id, d.description, d.dueDate, d.matterId, m.title as matterTitle
             FROM matter_deadlines d JOIN matters m ON m.id = d.matterId
             WHERE d.dueDate IS NOT NULL`,
          )
          .all()
  ) as { id: string; description: string; dueDate: string; matterId: string; matterTitle: string }[];

  const eventRows = (
    matterId
      ? db
          .prepare(
            `SELECT e.id, e.title, e.startDate, e.endDate, e.matterId, m.title as matterTitle
             FROM calendar_events e LEFT JOIN matters m ON m.id = e.matterId
             WHERE e.matterId = ?`,
          )
          .all(matterId)
      : db
          .prepare(
            `SELECT e.id, e.title, e.startDate, e.endDate, e.matterId, m.title as matterTitle
             FROM calendar_events e LEFT JOIN matters m ON m.id = e.matterId`,
          )
          .all()
  ) as { id: string; title: string; startDate: string; endDate: string | null; matterId: string | null; matterTitle: string | null }[];

  const items: CalendarItem[] = [
    ...deadlineRows.map((d) => ({
      id: d.id,
      kind: "deadline" as const,
      title: d.description,
      date: d.dueDate,
      endDate: null,
      matterId: d.matterId,
      matterTitle: d.matterTitle,
    })),
    ...eventRows.map((e) => ({
      id: e.id,
      kind: "event" as const,
      title: e.title,
      date: e.startDate,
      endDate: e.endDate,
      matterId: e.matterId,
      matterTitle: e.matterTitle,
    })),
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

// --- Notifications -------------------------------------------------------

export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  return db
    .prepare("SELECT * FROM notifications ORDER BY createdAt DESC LIMIT ?")
    .all(limit)
    .map((row) => toPlain<AppNotification>(row));
}

export async function countUnreadNotifications(): Promise<number> {
  const row = db.prepare("SELECT COUNT(*) as c FROM notifications WHERE readAt IS NULL").get() as { c: number };
  return row.c;
}

export async function markNotificationRead(id: string): Promise<void> {
  db.prepare("UPDATE notifications SET readAt = ? WHERE id = ? AND readAt IS NULL").run(new Date().toISOString(), id);
}

export async function markAllNotificationsRead(): Promise<void> {
  db.prepare("UPDATE notifications SET readAt = ? WHERE readAt IS NULL").run(new Date().toISOString());
}

// INSERT OR IGNORE against the UNIQUE(relatedType, relatedId, type)
// constraint is the dedup mechanism — calling this twice for the same
// item is always safe and only ever creates one notification. Returns
// whether a new row was actually created, so the reminder scheduler can
// decide whether to also send an email for it.
export async function createNotificationIfNew(params: {
  type: NotificationType;
  title: string;
  body: string;
  matterId: string | null;
  relatedType: "deadline" | "calendar_event";
  relatedId: string;
}): Promise<boolean> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO notifications (id, type, title, body, matterId, relatedType, relatedId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, params.type, params.title, params.body, params.matterId, params.relatedType, params.relatedId, createdAt);
  return result.changes > 0;
}
