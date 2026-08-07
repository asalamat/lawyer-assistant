import { listDocuments } from "@/lib/matters";
import { listSignableDocuments, listSignatures } from "@/lib/signableDocuments";
import ConsentPanel, { type ConsentRow } from "@/components/ConsentPanel";

export default async function MatterConsentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const documents = await listSignableDocuments(id);

  const rows: ConsentRow[] = await Promise.all(
    documents.map(async (document) => {
      if (document.status !== "signed") {
        return { ...document, signerName: null, signatureImage: null };
      }
      const [signature] = await listSignatures(document.id);
      return {
        ...document,
        signerName: signature?.signerName ?? null,
        signatureImage: signature?.signatureImage ?? null,
      };
    }),
  );

  const matterDocuments = (await listDocuments(id)).map((document) => ({
    id: document.id,
    fileName: document.fileName,
  }));

  return (
    <ConsentPanel matterId={id} initialDocuments={rows} matterDocuments={matterDocuments} />
  );
}
