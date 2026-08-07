import { getLanguageName } from "@/lib/languageDetection";
import { annotateAttachments, annotateDuplicates, annotateNearDuplicates, getMatter, listDocuments } from "@/lib/matters";
import { listTeam } from "@/lib/matterTeam";
import { listAttachedReferenceDocuments, listReferenceDocuments } from "@/lib/referenceLibrary";
import { isExtractableDocument } from "@/lib/textExtraction";
import DeleteMatterButton from "@/components/DeleteMatterButton";
import MatterComplianceControls from "@/components/MatterComplianceControls";
import MatterTeamPanel from "@/components/MatterTeamPanel";
import ReferenceDocumentsAttachPanel from "@/components/ReferenceDocumentsAttachPanel";
import RetryExtractionButton from "@/components/RetryExtractionButton";
import SimilarDocumentsButton from "@/components/SimilarDocumentsButton";
import UploadDropzone from "@/components/UploadDropzone";

export default async function MatterOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matter = await getMatter(id);
  const documents = await annotateNearDuplicates(
    id,
    annotateAttachments(annotateDuplicates(await listDocuments(id))),
  );
  const attachedReferenceDocs = await listAttachedReferenceDocuments(id);
  const team = await listTeam(id);
  // Only approved reference documents can be attached to a matter — a
  // pending upload isn't available here yet, even to the person who
  // uploaded it, until a lawyer/admin has signed off (see /reference-library).
  const referenceLibrary = (await listReferenceDocuments()).filter((doc) => doc.approved);

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
                  {doc.nearDuplicateOfFileName && (
                    <span
                      className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400"
                      title={`${Math.round((doc.nearDuplicateScore ?? 0) * 100)}% similar`}
                    >
                      near-duplicate of {doc.nearDuplicateOfFileName}
                    </span>
                  )}
                  {doc.parentFileName && (
                    <span className="badge ml-2" title={`Attachment on ${doc.parentFileName}`}>
                      attachment of {doc.parentFileName}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 text-muted">
                  {doc.malwareScanStatus === "infected" ? (
                    <span
                      className="rounded-full bg-red-600/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-400"
                      title={doc.malwareScanDetail ?? undefined}
                    >
                      quarantined — malware detected
                    </span>
                  ) : isExtractableDocument(doc.fileName) ? (
                    doc.extractionStatus === "failed" ? (
                      <>
                        <span
                          className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-400"
                          title={doc.extractionError ?? undefined}
                        >
                          extraction failed
                        </span>
                        <RetryExtractionButton matterId={id} documentId={doc.id} />
                      </>
                    ) : (
                      <>
                        <span className="badge">chat-readable</span>
                        {doc.detectedLanguage && doc.detectedLanguage !== "eng" && doc.detectedLanguage !== "und" && (
                          <span className="badge" title="Detected language">
                            {getLanguageName(doc.detectedLanguage)}
                          </span>
                        )}
                        {doc.qualityScore !== null && doc.qualityScore < 70 && (
                          <span
                            className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400"
                            title={
                              doc.ocrConfidence !== null
                                ? `OCR confidence ${Math.round(doc.ocrConfidence)}% — worth a manual check`
                                : "Short extracted text — worth a manual check"
                            }
                          >
                            quality {doc.qualityScore}%
                          </span>
                        )}
                        <SimilarDocumentsButton matterId={id} documentId={doc.id} />
                      </>
                    )
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

      <MatterTeamPanel matterId={id} initialTeam={team} />

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
