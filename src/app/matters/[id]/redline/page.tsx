import { findUnverifiedCitations, listRedlineAnalyses, listIndependentReviews } from "@/lib/matters";
import GeneratedDocPanel from "@/components/GeneratedDocPanel";

export default async function MatterRedlinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [analyses, independentReviews] = await Promise.all([
    listRedlineAnalyses(id),
    listIndependentReviews(id),
  ]);
  const initialUnverifiedCitations = analyses[0]
    ? await findUnverifiedCitations(id, analyses[0].content)
    : [];

  return (
    <GeneratedDocPanel
      title="Redline"
      apiPath={`/api/matters/${id}/redline`}
      initialDoc={analyses[0] ?? null}
      emptyMessage="No redline generated yet. Upload the contract, add entries to Settings > Clause library, then generate one."
      matterId={id}
      sourceType="redline_analysis"
      initialReviews={independentReviews.filter((r) => r.sourceType === "redline_analysis")}
      initialUnverifiedCitations={initialUnverifiedCitations}
    />
  );
}
