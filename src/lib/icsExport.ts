// Zero-setup alternative to OAuth calendar push (see calendarSync.ts) — a
// standard iCalendar file, the same mechanism behind a Zoom invite or an
// Eventbrite ticket. No Google/Microsoft account connection, no app
// registration, no sign-in: whatever calendar app is already on the
// user's device opens it directly. One-way and manual (one click per
// deadline), which is the deliberate trade for needing absolutely no setup.

function formatDateStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function isValidDueDate(isoDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) && !Number.isNaN(Date.parse(isoDate));
}

// All-day events use DATE (not DATE-TIME) values, and DTEND is exclusive
// per the iCalendar spec — a one-day event spanning just the due date
// needs DTEND set to the following day, not the due date itself, or most
// calendar apps render it as zero-length.
function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

// Escapes text per RFC 5545 (backslash, comma, semicolon, and literal
// newlines all need escaping inside a content line's value).
function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

export interface DeadlineForIcs {
  id: string;
  description: string;
  dueDate: string;
  matterTitle: string;
}

// Returns null (rather than throwing) for a malformed dueDate — one bad
// row in a firm-wide feed shouldn't take down every other deadline's
// event. Caught live: a stored dueDate of the literal string "null"
// (see the extraction-side fix in matters.ts) crashed the whole feed with
// "RangeError: Invalid time value" until this validation was added.
function buildVevent(params: DeadlineForIcs, dtstamp: string): string[] | null {
  const { id, description, dueDate, matterTitle } = params;
  if (!isValidDueDate(dueDate)) return null;
  const dtstart = dueDate.replace(/-/g, "");
  const dtend = addDays(dueDate, 1);
  const summary = escapeIcsText(`${matterTitle}: ${description}`);
  return [
    "BEGIN:VEVENT",
    `UID:deadline-${id}@lawyer-assistant`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${summary}`,
    "END:VEVENT",
  ];
}

// CRLF line endings are required by RFC 5545 — several calendar apps
// (notably older Outlook builds) fail to parse a file using bare \n.
export function buildDeadlineIcs(params: DeadlineForIcs): string {
  const vevent = buildVevent(params, formatDateStamp(new Date()));
  if (!vevent) throw new Error(`Deadline ${params.id} has an invalid due date`);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lawyer Assistant//Deadline Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vevent,
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

// One VCALENDAR with one VEVENT per deadline — this is what a calendar app
// re-fetches on its own refresh interval when subscribed to the feed URL,
// so it always reflects whatever deadlines currently exist, with no size
// limit other than what's actually in the database.
export function buildDeadlineFeedIcs(deadlines: DeadlineForIcs[]): string {
  const dtstamp = formatDateStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lawyer Assistant//Deadline Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Lawyer Assistant Deadlines",
    "REFRESH-INTERVAL;VALUE=DURATION:PT4H",
    "X-PUBLISHED-TTL:PT4H",
    ...deadlines.flatMap((d) => buildVevent(d, dtstamp) ?? []),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
