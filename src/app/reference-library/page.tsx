import { listReferenceDocuments } from "@/lib/referenceLibrary";
import { getCurrentUser } from "@/lib/auth";
import ReferenceLibraryPanel from "@/components/ReferenceLibraryPanel";

export const dynamic = "force-dynamic";

export default async function ReferenceLibraryPage() {
  const documents = await listReferenceDocuments();
  const user = await getCurrentUser();
  const canApprove = user ? user.role !== "staff" : false;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl italic">Reference library</h1>
        <p className="mt-1 text-sm text-muted">
          Upload statutes, key case law, or other reference material once here, then attach the
          documents you need to individual matters (Overview tab) — keeps each matter&apos;s AI
          context focused on what&apos;s actually relevant to it. A lawyer or admin has to approve
          a newly uploaded document before it can be attached to any matter.
        </p>
      </div>
      <ReferenceLibraryPanel initialDocuments={documents} canApprove={canApprove} />
    </main>
  );
}
