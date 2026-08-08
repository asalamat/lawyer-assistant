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

function zeroFillCounts(months: string[], rows: { month: string; count: number }[]): MonthCount[] {
  const byMonth = new Map(rows.map((r) => [r.month, r.count]));
  return months.map((month) => ({ month, count: byMonth.get(month) ?? 0 }));
}

function zeroFillTotals(months: string[], rows: { month: string; total: number }[]): MonthTotal[] {
  const byMonth = new Map(rows.map((r) => [r.month, r.total]));
  return months.map((month) => ({ month, total: byMonth.get(month) ?? 0 }));
}

export async function getFirmAnalytics(): Promise<FirmAnalytics> {
  const months = last12Months();
  const since = `${months[0]}-01`;

  const openedRows = db
    .prepare(
      `SELECT strftime('%Y-%m', createdAt) as month, COUNT(*) as count
       FROM matters WHERE createdAt >= ? GROUP BY month`,
    )
    .all(since) as { month: string; count: number }[];

  const closedRows = db
    .prepare(
      `SELECT strftime('%Y-%m', createdAt) as month, COUNT(*) as count
       FROM audit_log WHERE action = 'matter_status_changed' AND detail LIKE '%closed%' AND createdAt >= ?
       GROUP BY month`,
    )
    .all(since) as { month: string; count: number }[];

  const wipRow = db
    .prepare(
      `SELECT COALESCE(SUM(hours * rate), 0) as wip FROM time_entries WHERE invoiceId IS NULL AND rate IS NOT NULL`,
    )
    .get() as { wip: number };

  const billedRows = db
    .prepare(
      `SELECT strftime('%Y-%m', createdAt) as month, COALESCE(SUM(total), 0) as total
       FROM invoices WHERE createdAt >= ? GROUP BY month`,
    )
    .all(since) as { month: string; total: number }[];

  const collectedRows = db
    .prepare(
      `SELECT strftime('%Y-%m', paidAt) as month, COALESCE(SUM(total), 0) as total
       FROM invoices WHERE status = 'paid' AND paidAt >= ? GROUP BY month`,
    )
    .all(since) as { month: string; total: number }[];

  const topMatterTypes = db
    .prepare(
      `SELECT matterType, COUNT(*) as count FROM matters GROUP BY matterType ORDER BY count DESC LIMIT 8`,
    )
    .all() as { matterType: string; count: number }[];

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const hoursByUser = db
    .prepare(
      `SELECT te.userId as userId, u.name as userName, COALESCE(SUM(te.hours), 0) as hours
       FROM time_entries te JOIN users u ON u.id = te.userId
       WHERE te.userId IS NOT NULL AND te.workedOn >= ?
       GROUP BY te.userId ORDER BY hours DESC`,
    )
    .all(ninetyDaysAgo.slice(0, 10)) as { userId: string; userName: string; hours: number }[];

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
