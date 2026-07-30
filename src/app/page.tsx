import Link from "next/link";
import { listMatters } from "@/lib/matters";
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

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-sm text-zinc-500">Total matters</p>
          <p className="text-3xl font-semibold">{matters.length}</p>
        </div>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-sm text-zinc-500">Open matters</p>
          <p className="text-3xl font-semibold">{openCount}</p>
        </div>
      </div>
      <div className="flex gap-4 text-sm">
        <Link href="/matters" className="underline">
          View all matters
        </Link>
      </div>

      <div className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10">
        <h2 className="mb-3 font-medium">System info</h2>
        <dl className="grid grid-cols-2 gap-y-1.5 gap-x-4 sm:grid-cols-4">
          <dt className="text-zinc-500">Version</dt>
          <dd>
            {info.appVersion}
            {info.gitCommit && ` (${info.gitCommit.shortSha})`}
          </dd>
          <dt className="text-zinc-500">Node</dt>
          <dd>{info.nodeVersion}</dd>
          <dt className="text-zinc-500">Next.js</dt>
          <dd>{info.nextVersion}</dd>
          <dt className="text-zinc-500">Database</dt>
          <dd>SQLite, {formatBytes(info.db.sizeBytes)}</dd>
          <dt className="text-zinc-500">Matters</dt>
          <dd>{info.db.counts.matters}</dd>
          <dt className="text-zinc-500">Documents</dt>
          <dd>{info.db.counts.documents}</dd>
          <dt className="text-zinc-500">Chat messages</dt>
          <dd>{info.db.counts.chatMessages}</dd>
          <dt className="text-zinc-500">Digests</dt>
          <dd>{info.db.counts.matterDigests}</dd>
        </dl>
        {info.gitCommit && (
          <p className="mt-3 text-xs text-zinc-500">
            Last commit: {info.gitCommit.message} ({info.gitCommit.date})
          </p>
        )}
      </div>
    </main>
  );
}
