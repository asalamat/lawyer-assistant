import { annotateDuplicates, getMatter, listDocuments } from "@/lib/matters";
import { listAttachedReferenceDocuments, listReferenceDocuments } from "@/lib/referenceLibrary";
import { isExtractableDocument } from "@/lib/textExtraction";
import DeleteMatterButton from "@/components/DeleteMatterButton";
import MatterComplianceControls from "@/components/MatterComplianceControls";
import ReferenceDocumentsAttachPanel from "@/components/ReferenceDocumentsAttachPanel";
import UploadDropzone from "@/components/UploadDropzone";

export default async function MatterOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matter = await getMatter(id);
  const documents = annotateDuplicates(await listDocuments(id));
  const attachedReferenceDocs = await listAttachedReferenceDocuments(id);
  const referenceLibrary = await listReferenceDocuments();

  return (
    <div className="flex flex-col gap-6">
      <UploadDropzone matterId={id} />

      <div>
        <h2 className="mb-2 font-display text-lg">Documents</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-muted">No documents uploaded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li key={doc.id} className="surface-row flex items-center justify-between text-sm">
                <span>
                  {doc.fileName}
                  {doc.duplicateOfFileName && (
                    <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                      duplicate of {doc.duplicateOfFileName}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 text-muted">
                  {isExtractableDocument(doc.fileName) ? (
                    <span className="badge">chat-readable</span>
                  ) : (
                    <span className="badge">not used in chat</span>
                  )}
                  {(doc.sizeBytes / 1024).toFixed(1)} KB
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ReferenceDocumentsAttachPanel
        matterId={id}
        initialAttached={attachedReferenceDocs}
        library={referenceLibrary}
      />

      {matter && <MatterComplianceControls matter={matter} />}

      {matter && (
        <div>
          <h2 className="mb-2 font-display text-lg">Danger zone</h2>
          <div className="surface-row">
            <DeleteMatterButton matter={matter} />
          </div>
        </div>
      )}
    </div>
  );
}
