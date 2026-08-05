import { listDrafts } from "@/lib/matters";
import DefenceGraphPanel from "@/components/DefenceGraphPanel";
import DraftsPanel from "@/components/DraftsPanel";

export default async function MatterDraftsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const drafts = await listDrafts(id);
  const hasMemo = drafts.some((d) => d.draftType === "Defence strategy memo");

  return (
    <div className="flex flex-col gap-4">
      <DraftsPanel matterId={id} initialDrafts={drafts} />
      <DefenceGraphPanel matterId={id} hasMemo={hasMemo} />
    </div>
  );
}
