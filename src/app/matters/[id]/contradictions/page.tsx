import { findUnverifiedCitations, listContradictionAnalyses, listIndependentReviews } from "@/lib/matters";
import GeneratedDocPanel from "@/components/GeneratedDocPanel";

export default async function MatterContradictionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const analyses = await listContradictionAnalyses(id);
  const independentReviews = await listIndependentReviews(id);
  const initialUnverifiedCitations = analyses[0]
    ? await findUnverifiedCitations(id, analyses[0].content)
    : [];

  return (
    <GeneratedDocPanel
      title="Contradictions"
      apiPath={`/api/matters/${id}/contradictions`}
      initialDoc={analyses[0] ?? null}
      emptyMessage="No contradiction analysis generated yet. Upload documents, then generate one."
      matterId={id}
      sourceType="contradiction_analysis"
      initialReviews={independentReviews.filter((r) => r.sourceType === "contradiction_analysis")}
      initialUnverifiedCitations={initialUnverifiedCitations}
    />
  );
}
