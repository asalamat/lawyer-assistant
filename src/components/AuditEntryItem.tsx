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
    <li className="surface-row flex flex-col gap-1 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>
        <span className="text-xs text-muted">{new Date(entry.createdAt).toLocaleString()}</span>
      </div>
      <p className="text-muted">{entry.detail}</p>
      {entry.userName && <p className="text-xs text-muted">By {entry.userName}</p>}
      {showMatterLink && entry.matterId && (
        <Link href={`/matters/${entry.matterId}`} className="text-xs text-accent hover:underline">
          View matter
        </Link>
      )}
    </li>
  );
}
