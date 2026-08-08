import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { checkExportGuard } from "@/lib/exportGuard";
import { getMatter, listDocuments, recordMatterEmailSent } from "@/lib/matters";
import { readPlaintextFile } from "@/lib/textExtraction";

// Keyed on emails that actually carry attachments — a subject-only email
// isn't a bulk-export concern, one with a firm's documents attached is.
const EMAIL_ATTACHMENT_GUARD = { action: "email_with_attachments", alertThreshold: 10, hardLimit: 50 };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const body = await request.json();
  const { to, subject, message, documentIds } = body ?? {};

  if (typeof to !== "string" || !to.includes("@")) {
    return NextResponse.json({ error: "A valid recipient email is required" }, { status: 400 });
  }
  if (typeof subject !== "string" || !subject.trim()) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  let attachments;
  let selectedFileNames: string[] = [];
  if (Array.isArray(documentIds) && documentIds.length > 0) {
    const matterDocuments = await listDocuments(id);
    const selected = matterDocuments.filter((doc) => documentIds.includes(doc.id));
    if (selected.length !== documentIds.length) {
      return NextResponse.json(
        { error: "One or more selected attachments don't belong to this matter" },
        { status: 400 },
      );
    }
    selectedFileNames = selected.map((doc) => doc.fileName);

    const user = await getCurrentUser();
    if (user) {
      const guard = await checkExportGuard(EMAIL_ATTACHMENT_GUARD, user.id, user.name, id);
      if (!guard.allowed) {
        return NextResponse.json(
          { error: "Too many emails with attachments sent this hour. Try again later." },
          { status: 429, headers: { "Retry-After": String(guard.retryAfterSeconds) } },
        );
      }
    }

    attachments = await Promise.all(
      selected.map(async (doc) => ({
        filename: doc.fileName,
        content: await readPlaintextFile(doc.storagePath),
      })),
    );
  }

  try {
    await sendEmail({ to, subject, text: message, attachments });
    await recordMatterEmailSent(id, to, subject, selectedFileNames);
    return NextResponse.json({ ok: true, to });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
