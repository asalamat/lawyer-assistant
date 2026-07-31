import Link from "next/link";
import { notFound } from "next/navigation";
import { listAuditLogForMatter } from "@/lib/auditLog";
import {
  annotateDuplicates,
  getMatter,
  listDeadlines,
  listDigests,
  listDocuments,
  listDrafts,
  listEvidenceMatrices,
} from "@/lib/matters";
import { isExtractableDocument } from "@/lib/textExtraction";
import AuditEntryItem from "@/components/AuditEntryItem";
import DeadlinesPanel from "@/components/DeadlinesPanel";
import DraftsPanel from "@/components/DraftsPanel";
import GeneratedDocPanel from "@/components/GeneratedDocPanel";
import MatterStatusToggle from "@/components/MatterStatusToggle";
import UploadDropzone from "@/components/UploadDropzone";

export default async function MatterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) notFound();

  const documents = annotateDuplicates(await listDocuments(id));
  const digests = await listDigests(id);
  const deadlines = await listDeadlines(id);
  const drafts = await listDrafts(id);
  const evidenceMatrices = await listEvidenceMatrices(id);
  const timeline = await listAuditLogForMatter(id);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl italic">{matter.title}</h1>
            <span className="badge font-mono">{matter.fileNumber}</span>
          </div>
          <p className="text-sm text-muted">
            {matter.clientName} &middot; {matter.matterType}
          </p>
          <div className="mt-1">
            <MatterStatusToggle matter={matter} />
          </div>
        </div>
        <Link href={`/matters/${matter.id}/chat`} className="btn-primary">
          Chat about this matter
        </Link>
      </div>

      <UploadDropzone matterId={matter.id} />

      <GeneratedDocPanel
        title="Matter digest"
        apiPath={`/api/matters/${matter.id}/digest`}
        initialDoc={digests[0] ?? null}
        emptyMessage="No digest generated yet. Upload documents, then generate a summary."
      />

      <DeadlinesPanel matterId={matter.id} initialDeadlines={deadlines} />

      <GeneratedDocPanel
        title="Evidence matrix"
        apiPath={`/api/matters/${matter.id}/evidence-matrix`}
        initialDoc={evidenceMatrices[0] ?? null}
        emptyMessage="No evidence matrix generated yet. Upload documents, then generate one."
      />

      <DraftsPanel matterId={matter.id} initialDrafts={drafts} />

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

      <div>
        <h2 className="mb-2 font-display text-lg">Activity timeline</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted">No activity recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {timeline.map((entry) => (
              <AuditEntryItem key={entry.id} entry={entry} showMatterLink={false} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
