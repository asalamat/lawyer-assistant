import { listAuditLogForMatter } from "@/lib/auditLog";
import AuditEntryItem from "@/components/AuditEntryItem";

export default async function MatterActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const timeline = await listAuditLogForMatter(id);

  return (
    <div>
      <h2 className="mb-2 font-display text-lg">Activity timeline</h2>
      {timeline.length === 0 ? (
        <p className="text-sm text-muted">No activity recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {timeline.map((entry) => (
            <AuditEntryItem key={entry.id} entry={entry} showMatterLink={false} />
          ))}
        </ul>
      )}
    </div>
  );
}
