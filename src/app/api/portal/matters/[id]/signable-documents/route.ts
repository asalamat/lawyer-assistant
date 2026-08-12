import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientSessionUser } from "@/lib/clientAuth";
import { getMatter } from "@/lib/matters";
import { listSignableDocuments, SIGNABLE_KIND_LABELS } from "@/lib/signableDocuments";

// Only documents actually open for signature — a client has no reason to
// see drafts still being prepared, or ones already declined/voided.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = (await cookies()).get("client_session")?.value;
  const clientUser = await getClientSessionUser(token);
  if (!clientUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const matter = await getMatter(id);
  if (!matter || matter.clientId !== clientUser.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pending = (await listSignableDocuments(id))
    .filter((doc) => doc.status === "sent")
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      kindLabel: SIGNABLE_KIND_LABELS[doc.kind] ?? doc.kind,
    }));
  return NextResponse.json(pending);
}
