import db from "./db";

export interface MonthCount {
  month: string; // "YYYY-MM"
  count: number;
}

export interface MonthTotal {
  month: string;
  total: number;
}

export interface ArAgingBucket {
  bucket: "0-30" | "31-60" | "61-90" | "90+";
  total: number;
  count: number;
}

export interface ArAgingInvoice {
  invoiceId: string;
  invoiceNumber: string;
  matterId: string;
  matterTitle: string;
  daysOutstanding: number;
  amount: number;
}

export interface MatterProfitability {
  matterId: string;
  matterTitle: string;
  billed: number;
  disbursements: number;
  net: number;
}

export interface FirmAnalytics {
  mattersOpenedByMonth: MonthCount[];
  mattersClosedByMonth: MonthCount[];
  wip: number;
  billedByMonth: MonthTotal[];
  collectedByMonth: MonthTotal[];
  topMatterTypes: { matterType: string; count: number }[];
  hoursByUser: { userId: string; userName: string; hours: number }[];
  arAging: ArAgingBucket[];
  arAgingOldest: ArAgingInvoice[];
  matterProfitability: MatterProfitability[];
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

  // AR aging — every currently-unpaid invoice, bucketed by days since it was
  // issued. Not filtered by the dateFrom/dateTo range the other metrics use:
  // an aging report is inherently "as of today" for whatever is unpaid right
  // now, regardless of when it was billed — restricting to a past date range
  // would hide exactly the oldest, most overdue invoices a firm most needs
  // to see. matterType still applies, since that's a real segmentation, not
  // a time window.
  const arClauses = ["invoices.status = 'unpaid'"];
  const arParams: string[] = [];
  if (matterType) {
    arClauses.push("matters.matterType = ?");
    arParams.push(matterType);
  }
  const unpaidInvoices = db
    .prepare(
      `SELECT invoices.id as invoiceId, invoices.invoiceNumber, invoices.total, invoices.createdAt,
              matters.id as matterId, matters.title as matterTitle
       FROM invoices JOIN matters ON matters.id = invoices.matterId
       WHERE ${arClauses.join(" AND ")}`,
    )
    .all(...arParams) as {
    invoiceId: string;
    invoiceNumber: string;
    total: number;
    createdAt: string;
    matterId: string;
    matterTitle: string;
  }[];

  const now = Date.now();
  const agingDetail: ArAgingInvoice[] = unpaidInvoices.map((inv) => ({
    invoiceId: inv.invoiceId,
    invoiceNumber: inv.invoiceNumber,
    matterId: inv.matterId,
    matterTitle: inv.matterTitle,
    daysOutstanding: Math.floor((now - new Date(inv.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
    amount: inv.total,
  }));

  const bucketDefs: { bucket: ArAgingBucket["bucket"]; min: number; max: number }[] = [
    { bucket: "0-30", min: 0, max: 30 },
    { bucket: "31-60", min: 31, max: 60 },
    { bucket: "61-90", min: 61, max: 90 },
    { bucket: "90+", min: 91, max: Infinity },
  ];
  const arAging: ArAgingBucket[] = bucketDefs.map(({ bucket, min, max }) => {
    const inBucket = agingDetail.filter((inv) => inv.daysOutstanding >= min && inv.daysOutstanding <= max);
    return { bucket, total: inBucket.reduce((sum, inv) => sum + inv.amount, 0), count: inBucket.length };
  });
  const arAgingOldest = [...agingDetail].sort((a, b) => b.daysOutstanding - a.daysOutstanding).slice(0, 10);

  // Matter profitability — billed revenue minus hard costs (disbursements)
  // per matter, both scoped to the same date/matterType filters as "billed"
  // above. Deliberately NOT "profit" in the full accounting sense: staff
  // time has no internal cost/wage rate tracked anywhere in this app, only
  // a client-billing rate, so labor cost can't be deducted — this is net
  // revenue after hard costs, not true profit. Labeled as such in the UI.
  const profitBilledRows = db
    .prepare(
      `SELECT matters.id as matterId, matters.title as matterTitle, COALESCE(SUM(invoices.total), 0) as billed
       FROM invoices JOIN matters ON matters.id = invoices.matterId
       WHERE ${billedClauses.join(" AND ")}
       GROUP BY matters.id`,
    )
    .all(...billedParams) as { matterId: string; matterTitle: string; billed: number }[];

  const disbursementClauses = ["disbursements.incurredOn >= ?"];
  const disbursementParams: string[] = [since];
  if (until) {
    disbursementClauses.push("disbursements.incurredOn <= ?");
    disbursementParams.push(until);
  }
  if (matterType) {
    disbursementClauses.push("matters.matterType = ?");
    disbursementParams.push(matterType);
  }
  const disbursementRows = db
    .prepare(
      `SELECT disbursements.matterId as matterId, COALESCE(SUM(disbursements.amount), 0) as total
       FROM disbursements JOIN matters ON matters.id = disbursements.matterId
       WHERE ${disbursementClauses.join(" AND ")}
       GROUP BY disbursements.matterId`,
    )
    .all(...disbursementParams) as { matterId: string; total: number }[];
  const disbursementsByMatter = new Map(disbursementRows.map((r) => [r.matterId, r.total]));

  const matterProfitability: MatterProfitability[] = profitBilledRows
    .map((row) => {
      const disbursements = disbursementsByMatter.get(row.matterId) ?? 0;
      return {
        matterId: row.matterId,
        matterTitle: row.matterTitle,
        billed: row.billed,
        disbursements,
        net: row.billed - disbursements,
      };
    })
    .sort((a, b) => b.net - a.net);

  return {
    mattersOpenedByMonth: zeroFillCounts(months, openedRows),
    mattersClosedByMonth: zeroFillCounts(months, closedRows),
    wip: wipRow.wip,
    billedByMonth: zeroFillTotals(months, billedRows),
    collectedByMonth: zeroFillTotals(months, collectedRows),
    topMatterTypes,
    hoursByUser,
    arAging,
    arAgingOldest,
    matterProfitability,
  };
}
