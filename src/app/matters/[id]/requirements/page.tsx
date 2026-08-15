import { listMatterRequirements } from "@/lib/matterRequirements";
import RequirementsChecklistPanel from "@/components/RequirementsChecklistPanel";

export default async function MatterRequirementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await listMatterRequirements(id);
  return <RequirementsChecklistPanel matterId={id} initialItems={items} />;
}
