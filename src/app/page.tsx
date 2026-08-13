import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatDateOnly } from "@/lib/formatDate";
import { filterAccessibleMatterIds } from "@/lib/matterAccess";
import { listMatters, listUpcomingDeadlines } from "@/lib/matters";
import { getAiProviderOrder, getIndependentReviewProvider } from "@/lib/settings";
import { listTasksForUser } from "@/lib/tasks";

export const dynamic = "force-dynamic";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  moonshot: "Moonshot AI (Kimi)",
};

export default async function Home() {
  const user = await getCurrentUser();
  const allMatters = await listMatters();
  const accessibleIds = user
    ? filterAccessibleMatterIds(user.id, user.role, allMatters.map((m) => m.id))
    : new Set(allMatters.map((m) => m.id));
  const matters = allMatters.filter((m) => accessibleIds.has(m.id));
  const openCount = matters.filter((m) => m.status === "open").length;
  const upcomingDeadlines = (await listUpcomingDeadlines()).filter((d) => accessibleIds.has(d.matterId));
  const myTasks = user
    ? (await listTasksForUser(user.id)).filter((t) => accessibleIds.has(t.matterId))
    : [];

  // Admin-only: only an admin can act on this (Settings > AI model is
  // admin-gated), so showing it to everyone else would just point at a
  // page they can't reach.
  let sameProviderWarning: string | null = null;
  if (user?.role === "admin") {
    const [primaryOrder, independentReviewProvider] = await Promise.all([
      getAiProviderOrder(),
      getIndependentReviewProvider(),
    ]);
    if (primaryOrder[0] === independentReviewProvider) {
      sameProviderWarning = PROVIDER_LABELS[independentReviewProvider] ?? independentReviewProvider;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-3xl italic">Dashboard</h1>
      {sameProviderWarning && (
        <div className="surface-card border-amber-500/40 bg-amber-500/10 text-sm text-amber-800 dark:text-amber-300">
          <strong>Independent review isn&apos;t independent right now.</strong> Your primary AI
          provider and independent review provider are both {sameProviderWarning} — a review from
          the same model family can share the same blind spots it&apos;s meant to catch.{" "}
          <Link href="/settings/ai" className="underline">
            Fix in Settings &gt; AI model
          </Link>
          .
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="surface-card">
          <p className="text-sm text-muted">Total matters</p>
          <p className="font-display text-3xl">{matters.length}</p>
        </div>
        <div className="surface-card">
          <p className="text-sm text-muted">Open matters</p>
          <p className="font-display text-3xl">{openCount}</p>
        </div>
      </div>
      <div className="flex gap-4 text-sm">
        <Link href="/matters" className="text-accent hover:underline">
          View all matters →
        </Link>
      </div>

      <div className="surface-card text-sm">
        <h2 className="mb-3 font-display text-lg">Upcoming deadlines</h2>
        {upcomingDeadlines.length === 0 ? (
          <p className="text-muted">
            No deadlines extracted yet — open a matter and extract deadlines from its
            documents.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcomingDeadlines.map((deadline) => (
              <li key={deadline.id} className="flex items-center justify-between">
                <Link href={`/matters/${deadline.matterId}`} className="hover:text-accent">
                  {deadline.matterTitle}: {deadline.description}
                </Link>
                <span className="shrink-0 font-medium text-accent">
                  {formatDateOnly(deadline.dueDate!)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="surface-card text-sm">
        <h2 className="mb-3 font-display text-lg">My tasks</h2>
        {myTasks.length === 0 ? (
          <p className="text-muted">No open tasks assigned to you.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {myTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between">
                <Link href={`/matters/${task.matterId}/tasks`} className="hover:text-accent">
                  {task.matterTitle}: {task.title}
                </Link>
                {task.dueDate && (
                  <span className="shrink-0 font-medium text-accent">
                    {formatDateOnly(task.dueDate)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
