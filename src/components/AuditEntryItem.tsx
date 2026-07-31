import Link from "next/link";
import { ACTION_LABELS } from "@/lib/auditLog";
import type { AuditEntry } from "@/lib/types";

export default function AuditEntryItem({
  entry,
  showMatterLink = true,
}: {
  entry: AuditEntry;
  showMatterLink?: boolean;
}) {
  return (
    <li className="flex flex-col gap-1 rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10">
      <div className="flex items-center justify-between">
        <span className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>
        <span className="text-xs text-zinc-500">{new Date(entry.createdAt).toLocaleString()}</span>
      </div>
      <p className="text-zinc-600 dark:text-zinc-400">{entry.detail}</p>
      {showMatterLink && entry.matterId && (
        <Link href={`/matters/${entry.matterId}`} className="text-xs underline">
          View matter
        </Link>
      )}
    </li>
  );
}
