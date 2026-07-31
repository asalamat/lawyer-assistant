import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMatter,
  listDeadlines,
  listDigests,
  listDocuments,
  listDrafts,
  listEvidenceMatrices,
} from "@/lib/matters";
import { isExtractableDocument } from "@/lib/textExtraction";
import DeadlinesPanel from "@/components/DeadlinesPanel";
import DraftsPanel from "@/components/DraftsPanel";
import GeneratedDocPanel from "@/components/GeneratedDocPanel";
import UploadDropzone from "@/components/UploadDropzone";

export default async function MatterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) notFound();

  const documents = await listDocuments(id);
  const digests = await listDigests(id);
  const deadlines = await listDeadlines(id);
  const drafts = await listDrafts(id);
  const evidenceMatrices = await listEvidenceMatrices(id);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{matter.title}</h1>
          <p className="text-sm text-zinc-500">
            {matter.clientName} &middot; {matter.matterType} &middot;{" "}
            {matter.status}
          </p>
        </div>
        <Link
          href={`/matters/${matter.id}/chat`}
          className="rounded bg-foreground px-4 py-2 text-sm text-background"
        >
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
        <h2 className="mb-2 font-medium">Documents</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-zinc-500">No documents uploaded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10"
              >
                <span>{doc.fileName}</span>
                <span className="flex items-center gap-3 text-zinc-500">
                  {isExtractableDocument(doc.fileName) ? (
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                      chat-readable
                    </span>
                  ) : (
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                      not used in chat
                    </span>
                  )}
                  {(doc.sizeBytes / 1024).toFixed(1)} KB
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
