import { listDrafts } from "@/lib/matters";
import DraftsPanel from "@/components/DraftsPanel";

export default async function MatterDraftsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const drafts = await listDrafts(id);

  return <DraftsPanel matterId={id} initialDrafts={drafts} />;
}
