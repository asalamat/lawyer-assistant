import Link from "next/link";
import type { Matter } from "@/lib/types";

export default function MatterCard({ matter }: { matter: Matter }) {
  return (
    <Link
      href={`/matters/${matter.id}`}
      className="block rounded-lg border border-black/10 p-4 transition-colors hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/[.05]"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{matter.title}</h3>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
          {matter.status}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {matter.clientName} &middot; {matter.matterType}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Opened {new Date(matter.createdAt).toLocaleDateString()}
      </p>
    </Link>
  );
}
