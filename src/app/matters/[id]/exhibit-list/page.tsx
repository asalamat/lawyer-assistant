import { findUnverifiedCitations, listExhibitLists, listIndependentReviews } from "@/lib/matters";
import GeneratedDocPanel from "@/components/GeneratedDocPanel";

export default async function MatterExhibitListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lists = await listExhibitLists(id);
  const independentReviews = await listIndependentReviews(id);
  const initialUnverifiedCitations = lists[0]
    ? await findUnverifiedCitations(id, lists[0].content)
    : [];

  return (
    <GeneratedDocPanel
      title="Exhibit list"
      apiPath={`/api/matters/${id}/exhibit-list`}
      initialDoc={lists[0] ?? null}
      emptyMessage="No exhibit list generated yet. Upload documents, then generate one."
      matterId={id}
      sourceType="exhibit_list"
      initialReviews={independentReviews.filter((r) => r.sourceType === "exhibit_list")}
      initialUnverifiedCitations={initialUnverifiedCitations}
    />
  );
}
