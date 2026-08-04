import { getCurrentUser } from "@/lib/auth";
import { listAuditLog } from "@/lib/auditLog";
import AuditEntryItem from "@/components/AuditEntryItem";
import AuditIntegrityCheck from "@/components/AuditIntegrityCheck";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const entries = await listAuditLog();
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl italic">Audit log</h1>
        {user?.role === "admin" && <AuditIntegrityCheck />}
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">No activity recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <AuditEntryItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </main>
  );
}
