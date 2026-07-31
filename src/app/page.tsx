import Link from "next/link";
import { formatDateOnly } from "@/lib/formatDate";
import { listMatters, listUpcomingDeadlines } from "@/lib/matters";
import { getSystemInfo } from "@/lib/systemInfo";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function Home() {
  const matters = await listMatters();
  const openCount = matters.filter((m) => m.status === "open").length;
  const info = await getSystemInfo();
  const upcomingDeadlines = await listUpcomingDeadlines();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-3xl italic">Dashboard</h1>
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
        <h2 className="mb-3 font-display text-lg">System info</h2>
        <dl className="grid grid-cols-2 gap-y-1.5 gap-x-4 sm:grid-cols-4">
          <dt className="text-muted">Version</dt>
          <dd>
            {info.appVersion}
            {info.gitCommit && ` (${info.gitCommit.shortSha})`}
          </dd>
          <dt className="text-muted">Node</dt>
          <dd>{info.nodeVersion}</dd>
          <dt className="text-muted">Next.js</dt>
          <dd>{info.nextVersion}</dd>
          <dt className="text-muted">Database</dt>
          <dd>SQLite, {formatBytes(info.db.sizeBytes)}</dd>
          <dt className="text-muted">Matters</dt>
          <dd>{info.db.counts.matters}</dd>
          <dt className="text-muted">Documents</dt>
          <dd>{info.db.counts.documents}</dd>
          <dt className="text-muted">Chat messages</dt>
          <dd>{info.db.counts.chatMessages}</dd>
          <dt className="text-muted">Digests</dt>
          <dd>{info.db.counts.matterDigests}</dd>
        </dl>
        {info.gitCommit && (
          <p className="mt-3 text-xs text-muted">
            Last commit: {info.gitCommit.message} ({info.gitCommit.date})
          </p>
        )}
      </div>
    </main>
  );
}
