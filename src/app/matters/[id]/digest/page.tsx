import { listDigests, listIndependentReviews } from "@/lib/matters";
import GeneratedDocPanel from "@/components/GeneratedDocPanel";

export default async function MatterDigestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const digests = await listDigests(id);
  const independentReviews = await listIndependentReviews(id);

  return (
    <GeneratedDocPanel
      title="Matter digest"
      apiPath={`/api/matters/${id}/digest`}
      initialDoc={digests[0] ?? null}
      emptyMessage="No digest generated yet. Upload documents, then generate a summary."
      matterId={id}
      sourceType="digest"
      initialReviews={independentReviews.filter((r) => r.sourceType === "digest")}
    />
  );
}
