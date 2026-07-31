import { listAuditLog } from "@/lib/auditLog";
import AuditEntryItem from "@/components/AuditEntryItem";

export const dynamic = "force-dynamic";

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
            <AuditEntryItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </main>
  );
}
