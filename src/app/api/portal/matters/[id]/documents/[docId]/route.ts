import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { getClientSessionUser } from "@/lib/clientAuth";
import { checkExportGuard } from "@/lib/exportGuard";
import { getDocument, getMatter } from "@/lib/matters";
import { readPlaintextFile } from "@/lib/textExtraction";

// Higher thresholds than a staff backup download — a client working
// through several of their own shared documents in one sitting is normal;
// dozens in an hour is the pattern worth a human glance.
const PORTAL_DOWNLOAD_GUARD = { action: "portal_document_download", alertThreshold: 20, hardLimit: 100 };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const token = (await cookies()).get("client_session")?.value;
  const clientUser = await getClientSessionUser(token);
  if (!clientUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await checkExportGuard(PORTAL_DOWNLOAD_GUARD, clientUser.id, clientUser.email, id);
  if (!guard.allowed) {
    return NextResponse.json(
      { error: "Too many downloads this hour. Try again later." },
      { status: 429, headers: { "Retry-After": String(guard.retryAfterSeconds) } },
    );
  }

  const matter = await getMatter(id);
  if (!matter || matter.clientId !== clientUser.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const document = await getDocument(id, docId);
  if (!document || !document.sharedWithClient) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = await readPlaintextFile(document.storagePath);
  await recordAuditEvent(
    "client_portal_document_downloaded",
    id,
    `Client portal downloaded "${document.fileName}"`,
  );

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${document.fileName.replace(/"/g, "")}"`,
    },
  });
}
