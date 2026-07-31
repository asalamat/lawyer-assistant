import Link from "next/link";
import type { Matter } from "@/lib/types";

export default function MatterCard({ matter }: { matter: Matter }) {
  return (
    <Link
      href={`/matters/${matter.id}`}
      className="surface-card block transition-colors hover:border-accent/40"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">{matter.title}</h3>
        <span className={matter.status === "open" ? "badge-accent" : "badge"}>
          {matter.status}
        </span>
      </div>
      <p className="mt-1 text-xs font-mono text-muted">{matter.fileNumber}</p>
      <p className="mt-1 text-sm text-muted">
        {matter.clientName} &middot; {matter.matterType}
      </p>
      <p className="mt-1 text-xs text-muted">
        Opened {new Date(matter.createdAt).toLocaleDateString()}
      </p>
    </Link>
  );
}
