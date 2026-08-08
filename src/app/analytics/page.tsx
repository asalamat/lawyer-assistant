import { redirect } from "next/navigation";
import { getFirmAnalytics, type AnalyticsFilters } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { listSavedReports } from "@/lib/savedReports";
import SavedReportsPanel from "@/components/SavedReportsPanel";
import { HorizontalBarChart, VerticalBarChart } from "@/components/SimpleBarChart";

export const dynamic = "force-dynamic";

function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

function shortMonth(month: string): string {
  const [, m] = month.split("-");
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1] ?? month;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string; matterType?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role === "staff") redirect("/");

  const { dateFrom, dateTo, matterType } = await searchParams;
  const filters: AnalyticsFilters = {
    dateFrom: dateFrom?.trim() || undefined,
    dateTo: dateTo?.trim() || undefined,
    matterType: matterType?.trim() || undefined,
  };
  const hasFilters = Boolean(filters.dateFrom || filters.dateTo || filters.matterType);
  const currentQuery = hasFilters ? JSON.stringify(filters) : "";

  const [analytics, savedReports] = await Promise.all([
    getFirmAnalytics(filters),
    listSavedReports(user.id),
  ]);

  const periodLabel = filters.dateFrom || filters.dateTo ? "custom range" : "12mo";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl italic">Analytics</h1>

        <details className="mt-3" open={hasFilters}>
          <summary className="cursor-pointer text-sm text-muted">
            Filters{hasFilters ? " (active)" : ""}
          </summary>
          <form className="surface-card mt-2 grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">From</span>
              <input type="date" name="dateFrom" defaultValue={dateFrom ?? ""} className="surface-input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">To</span>
              <input type="date" name="dateTo" defaultValue={dateTo ?? ""} className="surface-input" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Matter type</span>
              <input
                name="matterType"
                defaultValue={matterType ?? ""}
                className="surface-input"
                placeholder="e.g. Criminal"
              />
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="btn-secondary">
                Apply filters
              </button>
              {hasFilters && (
                <a href="/analytics" className="text-sm text-muted hover:text-foreground">
                  Clear
                </a>
              )}
            </div>
          </form>
        </details>

        <div className="mt-3">
          <SavedReportsPanel initialReports={savedReports} currentQuery={currentQuery} />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="surface-card">
          <h2 className="mb-3 font-display text-lg">Matters opened ({periodLabel})</h2>
          <VerticalBarChart
            data={analytics.mattersOpenedByMonth.map((m) => ({ label: shortMonth(m.month), value: m.count }))}
          />
        </div>
        <div className="surface-card">
          <h2 className="mb-3 font-display text-lg">Matters closed ({periodLabel})</h2>
          <VerticalBarChart
            data={analytics.mattersClosedByMonth.map((m) => ({ label: shortMonth(m.month), value: m.count }))}
          />
        </div>
      </div>

      <div className="surface-card">
        <h2 className="mb-1 font-display text-lg">Work in progress</h2>
        <p className="text-sm text-muted">
          Unbilled time value across every open matter{matterType ? ` (${matterType})` : ""}.
        </p>
        <p className="font-display text-3xl">{formatMoney(analytics.wip)}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="surface-card">
          <h2 className="mb-3 font-display text-lg">Billed ({periodLabel})</h2>
          <VerticalBarChart
            data={analytics.billedByMonth.map((m) => ({ label: shortMonth(m.month), value: m.total }))}
            formatValue={formatMoney}
          />
        </div>
        <div className="surface-card">
          <h2 className="mb-3 font-display text-lg">Collected ({periodLabel})</h2>
          <VerticalBarChart
            data={analytics.collectedByMonth.map((m) => ({ label: shortMonth(m.month), value: m.total }))}
            formatValue={formatMoney}
          />
        </div>
      </div>

      <div className="surface-card">
        <h2 className="mb-3 font-display text-lg">Top matter types</h2>
        {analytics.topMatterTypes.length === 0 ? (
          <p className="text-sm text-muted">No matters yet.</p>
        ) : (
          <HorizontalBarChart
            data={analytics.topMatterTypes.map((t) => ({ label: t.matterType, value: t.count }))}
          />
        )}
      </div>

      <div className="surface-card">
        <h2 className="mb-1 font-display text-lg">Hours logged per person</h2>
        <p className="mb-3 text-sm text-muted">
          Only counts time entries logged since attorney attribution was added — older entries
          aren&apos;t included. {filters.dateFrom ? "" : "Last 90 days by default."}
        </p>
        {analytics.hoursByUser.length === 0 ? (
          <p className="text-sm text-muted">No attributed time entries in this period yet.</p>
        ) : (
          <HorizontalBarChart
            data={analytics.hoursByUser.map((h) => ({ label: h.userName, value: h.hours }))}
            formatValue={(v) => `${v.toFixed(1)}h`}
          />
        )}
      </div>
    </main>
  );
}
