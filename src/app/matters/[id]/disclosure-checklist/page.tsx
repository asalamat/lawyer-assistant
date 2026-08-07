import { listDisclosureChecklists, listIndependentReviews } from "@/lib/matters";
import GeneratedDocPanel from "@/components/GeneratedDocPanel";

export default async function MatterDisclosureChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const checklists = await listDisclosureChecklists(id);
  const independentReviews = await listIndependentReviews(id);

  return (
    <GeneratedDocPanel
      title="Disclosure checklist"
      apiPath={`/api/matters/${id}/disclosure-checklist`}
      initialDoc={checklists[0] ?? null}
      emptyMessage="No disclosure checklist generated yet. Upload documents, then generate one."
      matterId={id}
      sourceType="disclosure_checklist"
      initialReviews={independentReviews.filter((r) => r.sourceType === "disclosure_checklist")}
    />
  );
}
