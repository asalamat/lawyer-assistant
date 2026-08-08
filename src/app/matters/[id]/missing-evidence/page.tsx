import { findUnverifiedCitations, listIndependentReviews, listMissingEvidenceReports } from "@/lib/matters";
import GeneratedDocPanel from "@/components/GeneratedDocPanel";

export default async function MatterMissingEvidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [reports, independentReviews] = await Promise.all([
    listMissingEvidenceReports(id),
    listIndependentReviews(id),
  ]);
  const initialUnverifiedCitations = reports[0]
    ? await findUnverifiedCitations(id, reports[0].content)
    : [];

  return (
    <GeneratedDocPanel
      title="Missing evidence"
      apiPath={`/api/matters/${id}/missing-evidence`}
      initialDoc={reports[0] ?? null}
      emptyMessage="Generate a digest, disclosure checklist, evidence matrix, or Crown position analysis first, then generate this to roll up everything flagged as missing across them."
      matterId={id}
      sourceType="missing_evidence_report"
      initialReviews={independentReviews.filter((r) => r.sourceType === "missing_evidence_report")}
      initialUnverifiedCitations={initialUnverifiedCitations}
    />
  );
}
