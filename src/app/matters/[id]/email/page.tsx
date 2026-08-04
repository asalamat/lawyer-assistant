import { getMatter, listDocuments } from "@/lib/matters";
import { isEmailConfigured } from "@/lib/email";
import ComposeEmailPanel from "@/components/ComposeEmailPanel";
import ImportEmailPanel from "@/components/ImportEmailPanel";

export default async function MatterEmailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matter = await getMatter(id);
  const emailConfigured = await isEmailConfigured();
  const documents = await listDocuments(id);

  return (
    <div className="flex flex-col gap-4">
      <ComposeEmailPanel
        matterId={id}
        clientEmail={matter?.clientEmail ?? null}
        emailConfigured={emailConfigured}
        documents={documents.map((doc) => ({ id: doc.id, fileName: doc.fileName }))}
      />
      <ImportEmailPanel matterId={id} />
    </div>
  );
}
