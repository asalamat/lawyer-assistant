import { findUnverifiedCitations, listCrownPositionAnalyses, listIndependentReviews } from "@/lib/matters";
import GeneratedDocPanel from "@/components/GeneratedDocPanel";

export default async function MatterCrownPositionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [analyses, independentReviews] = await Promise.all([
    listCrownPositionAnalyses(id),
    listIndependentReviews(id),
  ]);
  const initialUnverifiedCitations = analyses[0]
    ? await findUnverifiedCitations(id, analyses[0].content)
    : [];

  return (
    <GeneratedDocPanel
      title="Crown-position analysis"
      apiPath={`/api/matters/${id}/crown-position`}
      initialDoc={analyses[0] ?? null}
      emptyMessage="No Crown-position analysis generated yet. Upload documents, then generate one."
      matterId={id}
      sourceType="crown_position_analysis"
      initialReviews={independentReviews.filter((r) => r.sourceType === "crown_position_analysis")}
      initialUnverifiedCitations={initialUnverifiedCitations}
    />
  );
}
