import { redirect } from "next/navigation";
import { getFirmAnalytics } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { HorizontalBarChart, VerticalBarChart } from "@/components/SimpleBarChart";

export const dynamic = "force-dynamic";

function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

function shortMonth(month: string): string {
  const [, m] = month.split("-");
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1] ?? month;
}

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user || user.role === "staff") redirect("/");

  const analytics = await getFirmAnalytics();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <h1 className="font-display text-3xl italic">Analytics</h1>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="surface-card">
          <h2 className="mb-3 font-display text-lg">Matters opened (12mo)</h2>
          <VerticalBarChart
            data={analytics.mattersOpenedByMonth.map((m) => ({ label: shortMonth(m.month), value: m.count }))}
          />
        </div>
        <div className="surface-card">
          <h2 className="mb-3 font-display text-lg">Matters closed (12mo)</h2>
          <VerticalBarChart
            data={analytics.mattersClosedByMonth.map((m) => ({ label: shortMonth(m.month), value: m.count }))}
          />
        </div>
      </div>

      <div className="surface-card">
        <h2 className="mb-1 font-display text-lg">Work in progress</h2>
        <p className="text-sm text-muted">Unbilled time value across every open matter.</p>
        <p className="font-display text-3xl">{formatMoney(analytics.wip)}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="surface-card">
          <h2 className="mb-3 font-display text-lg">Billed (12mo)</h2>
          <VerticalBarChart
            data={analytics.billedByMonth.map((m) => ({ label: shortMonth(m.month), value: m.total }))}
            formatValue={formatMoney}
          />
        </div>
        <div className="surface-card">
          <h2 className="mb-3 font-display text-lg">Collected (12mo)</h2>
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
        <h2 className="mb-1 font-display text-lg">Hours logged per person (90 days)</h2>
        <p className="mb-3 text-sm text-muted">
          Only counts time entries logged since attorney attribution was added — older entries
          aren&apos;t included.
        </p>
        {analytics.hoursByUser.length === 0 ? (
          <p className="text-sm text-muted">No attributed time entries in the last 90 days yet.</p>
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
