import { listDocuments } from "@/lib/matters";
import EvidenceConnectionsPanel from "@/components/EvidenceConnectionsPanel";

export default async function MatterEvidenceConnectionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const documents = await listDocuments(id);

  return <EvidenceConnectionsPanel matterId={id} hasDocuments={documents.length > 0} />;
}
