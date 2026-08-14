import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { getCurrentUser } from "@/lib/auth";
import { checkExportGuard } from "@/lib/exportGuard";
import { getDocument, getMatter } from "@/lib/matters";
import { readPlaintextFile } from "@/lib/textExtraction";

// Same shape as the client-portal document download, staff side — this app
// had no way for a lawyer to get a document's original bytes back out
// before the disclosure-package builder needed it (a lawyer has to be able
// to download a document to actually redact and produce it externally).
const STAFF_DOWNLOAD_GUARD = { action: "staff_document_download", alertThreshold: 30, hardLimit: 150 };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, docId } = await params;
  const guard = await checkExportGuard(STAFF_DOWNLOAD_GUARD, user.id, user.name, id);
  if (!guard.allowed) {
    return NextResponse.json(
      { error: "Too many downloads this hour. Try again later." },
      { status: 429, headers: { "Retry-After": String(guard.retryAfterSeconds) } },
    );
  }
  const matter = await getMatter(id);
  if (!matter) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const document = await getDocument(id, docId);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = await readPlaintextFile(document.storagePath);
  await recordAuditEvent("document_downloaded", id, `Downloaded "${document.fileName}"`);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${document.fileName.replace(/"/g, "")}"`,
    },
  });
}
