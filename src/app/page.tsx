import Link from "next/link";
import { listMatters } from "@/lib/matters";

export default async function Home() {
  const matters = await listMatters();
  const openCount = matters.filter((m) => m.status === "open").length;

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
        <Link href="/chat" className="underline">
          Ask a question
        </Link>
      </div>
    </main>
  );
}
