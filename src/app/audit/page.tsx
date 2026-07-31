import Link from "next/link";
import { listAuditLog } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  matter_created: "Matter created",
  document_uploaded: "Document uploaded",
  chat_question_asked: "Chat question asked",
  digest_generated: "Matter digest generated",
  chat_feedback_recorded: "Chat feedback recorded",
  deadlines_extracted: "Deadlines extracted",
  draft_generated: "Draft generated",
  evidence_matrix_generated: "Evidence matrix generated",
  matter_status_changed: "Matter status changed",
  duplicate_document_uploaded: "Duplicate document uploaded",
};

export default async function AuditPage() {
  const entries = await listAuditLog();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No activity recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1 rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <span className="text-xs text-zinc-500">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400">{entry.detail}</p>
              {entry.matterId && (
                <Link href={`/matters/${entry.matterId}`} className="text-xs underline">
                  View matter
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
