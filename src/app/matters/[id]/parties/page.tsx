import PartiesPanel from "@/components/PartiesPanel";
import RelatedMattersPanel from "@/components/RelatedMattersPanel";
import { listParties } from "@/lib/parties";
import { listRelatedMatters } from "@/lib/relatedMatters";

export default async function MatterPartiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [parties, relatedMatters] = await Promise.all([
    listParties(id),
    listRelatedMatters(id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PartiesPanel matterId={id} initialParties={parties} />
      <RelatedMattersPanel matterId={id} initialLinks={relatedMatters} />
    </div>
  );
}
