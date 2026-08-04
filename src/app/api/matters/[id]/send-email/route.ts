import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { getMatter, listDocuments, recordMatterEmailSent } from "@/lib/matters";
import { readPlaintextFile } from "@/lib/textExtraction";

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
  if (Array.isArray(documentIds) && documentIds.length > 0) {
    const matterDocuments = await listDocuments(id);
    const selected = matterDocuments.filter((doc) => documentIds.includes(doc.id));
    if (selected.length !== documentIds.length) {
      return NextResponse.json(
        { error: "One or more selected attachments don't belong to this matter" },
        { status: 400 },
      );
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
    await recordMatterEmailSent(id, to, subject);
    return NextResponse.json({ ok: true, to });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
