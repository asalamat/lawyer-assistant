import { listEvidenceMatrices, listIndependentReviews } from "@/lib/matters";
import GeneratedDocPanel from "@/components/GeneratedDocPanel";

export default async function MatterEvidenceMatrixPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const evidenceMatrices = await listEvidenceMatrices(id);
  const independentReviews = await listIndependentReviews(id);

  return (
    <GeneratedDocPanel
      title="Evidence matrix"
      apiPath={`/api/matters/${id}/evidence-matrix`}
      initialDoc={evidenceMatrices[0] ?? null}
      emptyMessage="No evidence matrix generated yet. Upload documents, then generate one."
      matterId={id}
      sourceType="evidence_matrix"
      initialReviews={independentReviews.filter((r) => r.sourceType === "evidence_matrix")}
    />
  );
}
