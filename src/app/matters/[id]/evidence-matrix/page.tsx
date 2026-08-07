import { findUnverifiedCitations, listEvidenceMatrices, listIndependentReviews } from "@/lib/matters";
import EvidenceGraphPanel from "@/components/EvidenceGraphPanel";
import GeneratedDocPanel from "@/components/GeneratedDocPanel";

export default async function MatterEvidenceMatrixPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const evidenceMatrices = await listEvidenceMatrices(id);
  const independentReviews = await listIndependentReviews(id);
  const initialUnverifiedCitations = evidenceMatrices[0]
    ? await findUnverifiedCitations(id, evidenceMatrices[0].content)
    : [];

  return (
    <div className="flex flex-col gap-4">
      <GeneratedDocPanel
        title="Evidence matrix"
        apiPath={`/api/matters/${id}/evidence-matrix`}
        initialDoc={evidenceMatrices[0] ?? null}
        emptyMessage="No evidence matrix generated yet. Upload documents, then generate one."
        matterId={id}
        sourceType="evidence_matrix"
        initialReviews={independentReviews.filter((r) => r.sourceType === "evidence_matrix")}
        initialUnverifiedCitations={initialUnverifiedCitations}
      />
      <EvidenceGraphPanel matterId={id} hasMatrix={evidenceMatrices.length > 0} />
    </div>
  );
}
