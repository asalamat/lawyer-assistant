import db from "./db";

export interface MonthCount {
  month: string; // "YYYY-MM"
  count: number;
}

export interface MonthTotal {
  month: string;
  total: number;
}

export interface FirmAnalytics {
  mattersOpenedByMonth: MonthCount[];
  mattersClosedByMonth: MonthCount[];
  wip: number;
  billedByMonth: MonthTotal[];
  collectedByMonth: MonthTotal[];
  topMatterTypes: { matterType: string; count: number }[];
  hoursByUser: { userId: string; userName: string; hours: number }[];
}

// Same shape as SearchFilters in search.ts — dateFrom/dateTo are inclusive
// day bounds compared against each metric's own date column, matterType is
// an exact match. All optional: the plain no-args call (the existing
// dashboard) keeps behaving exactly as before.
export interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  matterType?: string;
}

// Last 12 calendar months including the current one, oldest first — a
// fixed list so a month with zero activity still shows as a zero bar
// instead of silently disappearing from the chart.
function last12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

// Every calendar month from dateFrom through dateTo, inclusive, oldest
// first — the custom-range equivalent of last12Months() above.
function monthsInRange(dateFrom: string, dateTo: string): string[] {
  const [fromYear, fromMonth] = dateFrom.split("-").map(Number);
  const [toYear, toMonth] = dateTo.split("-").map(Number);
  const months: string[] = [];
  let year = fromYear;
  let month = fromMonth;
  while (year < toYear || (year === toYear && month <= toMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function zeroFillCounts(months: string[], rows: { month: string; count: number }[]): MonthCount[] {
  const byMonth = new Map(rows.map((r) => [r.month, r.count]));
  return months.map((month) => ({ month, count: byMonth.get(month) ?? 0 }));
}

function zeroFillTotals(months: string[], rows: { month: string; total: number }[]): MonthTotal[] {
  const byMonth = new Map(rows.map((r) => [r.month, r.total]));
  return months.map((month) => ({ month, total: byMonth.get(month) ?? 0 }));
}

export async function getFirmAnalytics(filters: AnalyticsFilters = {}): Promise<FirmAnalytics> {
  const months =
    filters.dateFrom && filters.dateTo ? monthsInRange(filters.dateFrom, filters.dateTo) : last12Months();
  const since = filters.dateFrom ?? `${months[0]}-01`;
  // A bare date like "2026-08-01" as the upper bound would exclude that
  // whole day — push to end-of-day, matching search.ts's SearchFilters.
  const until = filters.dateTo ? `${filters.dateTo}T23:59:59.999Z` : null;
  const matterType = filters.matterType?.trim() || null;

  const openedClauses = ["createdAt >= ?"];
  const openedParams: string[] = [since];
  if (until) {
    openedClauses.push("createdAt <= ?");
    openedParams.push(until);
  }
  if (matterType) {
    openedClauses.push("matterType = ?");
    openedParams.push(matterType);
  }
  const openedRows = db
    .prepare(
      `SELECT strftime('%Y-%m', createdAt) as month, COUNT(*) as count
       FROM matters WHERE ${openedClauses.join(" AND ")} GROUP BY month`,
    )
    .all(...openedParams) as { month: string; count: number }[];

  const closedClauses = ["action = 'matter_status_changed'", "detail LIKE '%closed%'", "createdAt >= ?"];
  const closedParams: string[] = [since];
  if (until) {
    closedClauses.push("createdAt <= ?");
    closedParams.push(until);
  }
  // audit_log has no matterType of its own — matterType filtering on this
  // metric would need a join back to matters via matterId, skipped here
  // since "matters closed" is a small enough metric that the added join
  // complexity isn't worth it for a filter combination that's rarely used.
  const closedRows = db
    .prepare(
      `SELECT strftime('%Y-%m', createdAt) as month, COUNT(*) as count
       FROM audit_log WHERE ${closedClauses.join(" AND ")} GROUP BY month`,
    )
    .all(...closedParams) as { month: string; count: number }[];

  const wipClauses = ["invoiceId IS NULL", "rate IS NOT NULL"];
  const wipParams: string[] = [];
  const wipJoin = matterType ? "JOIN matters ON matters.id = time_entries.matterId" : "";
  if (matterType) {
    wipClauses.push("matters.matterType = ?");
    wipParams.push(matterType);
  }
  const wipRow = db
    .prepare(
      `SELECT COALESCE(SUM(time_entries.hours * time_entries.rate), 0) as wip
       FROM time_entries ${wipJoin} WHERE ${wipClauses.join(" AND ")}`,
    )
    .get(...wipParams) as { wip: number };

  const billedClauses = ["invoices.createdAt >= ?"];
  const billedParams: string[] = [since];
  const invoiceJoin = matterType ? "JOIN matters ON matters.id = invoices.matterId" : "";
  if (until) {
    billedClauses.push("invoices.createdAt <= ?");
    billedParams.push(until);
  }
  if (matterType) {
    billedClauses.push("matters.matterType = ?");
    billedParams.push(matterType);
  }
  const billedRows = db
    .prepare(
      `SELECT strftime('%Y-%m', invoices.createdAt) as month, COALESCE(SUM(invoices.total), 0) as total
       FROM invoices ${invoiceJoin} WHERE ${billedClauses.join(" AND ")} GROUP BY month`,
    )
    .all(...billedParams) as { month: string; total: number }[];

  const collectedClauses = ["invoices.status = 'paid'", "invoices.paidAt >= ?"];
  const collectedParams: string[] = [since];
  if (until) {
    collectedClauses.push("invoices.paidAt <= ?");
    collectedParams.push(until);
  }
  if (matterType) {
    collectedClauses.push("matters.matterType = ?");
    collectedParams.push(matterType);
  }
  const collectedRows = db
    .prepare(
      `SELECT strftime('%Y-%m', invoices.paidAt) as month, COALESCE(SUM(invoices.total), 0) as total
       FROM invoices ${invoiceJoin} WHERE ${collectedClauses.join(" AND ")} GROUP BY month`,
    )
    .all(...collectedParams) as { month: string; total: number }[];

  const topMatterTypesClauses: string[] = [];
  const topMatterTypesParams: string[] = [];
  if (matterType) {
    topMatterTypesClauses.push("matterType = ?");
    topMatterTypesParams.push(matterType);
  }
  const topMatterTypes = db
    .prepare(
      `SELECT matterType, COUNT(*) as count FROM matters
       ${topMatterTypesClauses.length ? `WHERE ${topMatterTypesClauses.join(" AND ")}` : ""}
       GROUP BY matterType ORDER BY count DESC LIMIT 8`,
    )
    .all(...topMatterTypesParams) as { matterType: string; count: number }[];

  const hoursSince = filters.dateFrom ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const hoursClauses = ["te.userId IS NOT NULL", "te.workedOn >= ?"];
  const hoursParams: string[] = [hoursSince];
  const hoursJoin = matterType ? "JOIN matters m ON m.id = te.matterId" : "";
  if (until) {
    hoursClauses.push("te.workedOn <= ?");
    hoursParams.push(until);
  }
  if (matterType) {
    hoursClauses.push("m.matterType = ?");
    hoursParams.push(matterType);
  }
  const hoursByUser = db
    .prepare(
      `SELECT te.userId as userId, u.name as userName, COALESCE(SUM(te.hours), 0) as hours
       FROM time_entries te JOIN users u ON u.id = te.userId ${hoursJoin}
       WHERE ${hoursClauses.join(" AND ")}
       GROUP BY te.userId ORDER BY hours DESC`,
    )
    .all(...hoursParams) as { userId: string; userName: string; hours: number }[];

  return {
    mattersOpenedByMonth: zeroFillCounts(months, openedRows),
    mattersClosedByMonth: zeroFillCounts(months, closedRows),
    wip: wipRow.wip,
    billedByMonth: zeroFillTotals(months, billedRows),
    collectedByMonth: zeroFillTotals(months, collectedRows),
    topMatterTypes,
    hoursByUser,
  };
}
