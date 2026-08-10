/**
 * Formats a date-only string (e.g. "2027-03-03") for display without any
 * timezone shift. `new Date("2027-03-03")` parses as UTC midnight, and a
 * plain `.toLocaleDateString()` then renders it in the local timezone,
 * silently shifting the displayed date back a day in negative-UTC-offset
 * zones — a real risk for anything showing a legal deadline.
 *
 * Locale is pinned explicitly (not `undefined`) for two reasons: the
 * server's ambient default locale is environment-dependent and can render
 * unhelpfully as bare ISO digits, and a numeric month/day format (3/3/2027)
 * is genuinely ambiguous — spelling the month out removes any M/D-vs-D/M
 * misreading of a legal deadline.
 */
export function formatDateOnly(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Same locale-pinning rationale as formatDateOnly(), but for a full
 * timestamp (date + time) rather than a date-only string — for any
 * server-rendered component that displays a raw `.toLocaleString()` of a
 * createdAt/updatedAt timestamp using initial server-provided data. An
 * unpinned `.toLocaleString()` renders using the server process's ambient
 * locale during SSR and the browser's locale during hydration; whenever
 * those differ, React throws a hydration mismatch and has to re-render the
 * whole subtree client-side, which is what surfaced this in the first
 * place (a backups list rendered from `initialBackups`).
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
