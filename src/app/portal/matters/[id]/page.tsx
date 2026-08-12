import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClientSessionUser } from "@/lib/clientAuth";
import { getMatter, listDocuments } from "@/lib/matters";
import { listPortalMessages } from "@/lib/portalMessages";
import { listSignableDocuments, SIGNABLE_KIND_LABELS } from "@/lib/signableDocuments";
import PortalLogoutButton from "@/components/PortalLogoutButton";
import PortalMessagesPanel from "@/components/PortalMessagesPanel";
import PortalSignableDocumentsPanel from "@/components/PortalSignableDocumentsPanel";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function PortalMatterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = (await cookies()).get("client_session")?.value;
  const user = await getClientSessionUser(token);
  if (!user) redirect("/portal/login");
  if (user.mustChangePassword) redirect("/portal/change-password");

  const matter = await getMatter(id);
  if (!matter || matter.clientId !== user.clientId) notFound();

  const documents = (await listDocuments(id)).filter((doc) => doc.sharedWithClient);
  const messages = await listPortalMessages(id);
  const pendingSignatures = (await listSignableDocuments(id))
    .filter((doc) => doc.status === "sent")
    .map((doc) => ({ id: doc.id, title: doc.title, kindLabel: SIGNABLE_KIND_LABELS[doc.kind] ?? doc.kind }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/portal" className="text-sm text-accent hover:underline">
            ← Your matters
          </Link>
          <h1 className="font-display text-3xl italic">{matter.title}</h1>
        </div>
        <PortalLogoutButton />
      </div>

      <PortalSignableDocumentsPanel matterId={id} initialPending={pendingSignatures} />

      <div>
        <h2 className="mb-2 font-display text-lg">Shared documents</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing has been shared with you yet. Your lawyer will share documents here as they
            become available.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li key={doc.id} className="surface-row flex items-center justify-between text-sm">
                <span>{doc.fileName}</span>
                <span className="flex items-center gap-3 text-muted">
                  {formatBytes(doc.sizeBytes)}
                  <a
                    href={`/api/portal/matters/${id}/documents/${doc.id}`}
                    className="text-xs text-accent underline decoration-accent/40"
                  >
                    Download
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PortalMessagesPanel matterId={id} initialMessages={messages} />
    </main>
  );
}
