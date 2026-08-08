import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import { getFreshAccessToken } from "./emailIntegration";
import { getMatter } from "./matters";
import type { EmailAccount, EmailProvider, MatterDeadline } from "./types";

// One-way push only — our own later edits to a deadline update the event
// we already created (matched by calendarEventId), but an edit made
// directly in Google/Outlook never flows back here. Deliberately not
// wired into AI re-extraction (replaceDeadlines in matters.ts always
// deletes and re-inserts the extracted subset with fresh ids, which would
// either lose track of an already-pushed event or, if re-pushed blindly,
// create a duplicate on every re-extract) — auto-push only happens for
// rule-computed deadlines (a deliberate one-time action), everything else
// goes through the manual "Push to calendar" button so the user controls
// when it happens.

// Only Google and Microsoft have a calendar API this app talks to — Yahoo
// mail reading itself isn't supported (see emailIntegration.ts), so there
// was never a Yahoo calendar path to build.
const CALENDAR_PROVIDERS: EmailProvider[] = ["google", "microsoft"];

export async function getCalendarSyncAccount(): Promise<EmailAccount | null> {
  const row = db
    .prepare(
      `SELECT id, provider, emailAddress, connectedAt, calendarSyncEnabled FROM email_accounts
       WHERE calendarSyncEnabled = 1 AND provider IN (${CALENDAR_PROVIDERS.map(() => "?").join(",")})
       LIMIT 1`,
    )
    .get(...CALENDAR_PROVIDERS) as EmailAccount | undefined;
  return row ? toPlain<EmailAccount>(row) : null;
}

// The provider's raw error body (often a multi-line JSON blob) is only
// useful for debugging, not something to show a lawyer clicking "Push to
// calendar" — log it server-side and surface a short, actionable message
// instead. 401/403 almost always means the stored token was issued before
// calendar scope was granted, or has been revoked — reconnecting is the fix.
async function calendarApiErrorMessage(providerLabel: string, response: Response): Promise<string> {
  const detail = await response.text();
  console.error(`${providerLabel} API error (${response.status}):`, detail);
  if (response.status === 401 || response.status === 403) {
    return `${providerLabel} rejected the stored credentials — reconnect the account in Settings > Integrations and make sure calendar sync is re-enabled.`;
  }
  return `${providerLabel} couldn't be reached (error ${response.status}). Try again shortly.`;
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function upsertGoogleEvent(
  accessToken: string,
  existingEventId: string | null,
  summary: string,
  dueDate: string,
): Promise<string> {
  const body = JSON.stringify({
    summary,
    start: { date: dueDate },
    end: { date: addDays(dueDate, 1) },
  });
  const url = existingEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`
    : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const response = await fetch(url, {
    method: existingEventId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body,
  });
  if (!response.ok) throw new Error(await calendarApiErrorMessage("Google Calendar", response));
  const event = await response.json();
  return event.id;
}

async function upsertMicrosoftEvent(
  accessToken: string,
  existingEventId: string | null,
  subject: string,
  dueDate: string,
): Promise<string> {
  const body = JSON.stringify({
    subject,
    isAllDay: true,
    start: { dateTime: `${dueDate}T00:00:00`, timeZone: "UTC" },
    end: { dateTime: `${addDays(dueDate, 1)}T00:00:00`, timeZone: "UTC" },
  });
  const url = existingEventId
    ? `https://graph.microsoft.com/v1.0/me/events/${existingEventId}`
    : "https://graph.microsoft.com/v1.0/me/events";
  const response = await fetch(url, {
    method: existingEventId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body,
  });
  if (!response.ok) throw new Error(await calendarApiErrorMessage("Microsoft Calendar", response));
  const event = await response.json();
  return event.id;
}

export async function pushDeadlineToCalendar(matterId: string, deadlineId: string): Promise<MatterDeadline> {
  const row = db
    .prepare("SELECT * FROM matter_deadlines WHERE id = ? AND matterId = ?")
    .get(deadlineId, matterId);
  const deadline = row ? toPlain<MatterDeadline>(row) : null;
  if (!deadline) throw new Error("Deadline not found");
  if (!deadline.dueDate) throw new Error("This deadline has no due date to push");

  const account = await getCalendarSyncAccount();
  if (!account) throw new Error("No connected account has calendar sync enabled (Settings > Integrations)");

  const accessToken = await getFreshAccessToken(account.provider);
  if (!accessToken) throw new Error(`No access token available for ${account.provider}`);

  const matter = await getMatter(matterId);
  const summary = `${matter?.title ?? "Matter"}: ${deadline.description}`;
  const existingEventId = deadline.calendarProvider === account.provider ? deadline.calendarEventId : null;

  const eventId =
    account.provider === "google"
      ? await upsertGoogleEvent(accessToken, existingEventId, summary, deadline.dueDate)
      : await upsertMicrosoftEvent(accessToken, existingEventId, summary, deadline.dueDate);

  db.prepare("UPDATE matter_deadlines SET calendarEventId = ?, calendarProvider = ? WHERE id = ?").run(
    eventId,
    account.provider,
    deadlineId,
  );

  await recordAuditEvent(
    "deadline_pushed_to_calendar",
    matterId,
    `Pushed deadline "${deadline.description}" to ${account.provider} calendar`,
  );

  return { ...deadline, calendarEventId: eventId, calendarProvider: account.provider };
}

// Called from deadline-creation code paths that want auto-push — swallows
// any failure (network, expired token with no refresh available, sync not
// enabled) since a calendar push failing should never block the deadline
// itself from being created.
export async function tryAutoPushDeadline(matterId: string, deadlineId: string): Promise<void> {
  try {
    const account = await getCalendarSyncAccount();
    if (!account) return;
    await pushDeadlineToCalendar(matterId, deadlineId);
  } catch {
    // Best-effort — the manual "Push to calendar" button covers retrying.
  }
}
