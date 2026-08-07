import { findUnverifiedCitations, listPrivilegeReviews, listIndependentReviews } from "@/lib/matters";
import GeneratedDocPanel from "@/components/GeneratedDocPanel";

export default async function MatterPrivilegeReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reviews = await listPrivilegeReviews(id);
  const independentReviews = await listIndependentReviews(id);
  const initialUnverifiedCitations = reviews[0]
    ? await findUnverifiedCitations(id, reviews[0].content)
    : [];

  return (
    <GeneratedDocPanel
      title="Privilege & redaction review"
      apiPath={`/api/matters/${id}/privilege-review`}
      initialDoc={reviews[0] ?? null}
      emptyMessage="No privilege/redaction review generated yet. Upload documents, then generate one."
      matterId={id}
      sourceType="privilege_review"
      initialReviews={independentReviews.filter((r) => r.sourceType === "privilege_review")}
      initialUnverifiedCitations={initialUnverifiedCitations}
    />
  );
}
