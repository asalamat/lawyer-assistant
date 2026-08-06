import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { getMessageBody } from "@/lib/emailRead";
import { addDocument, checkForNewDeadlines, checkMatterClassification, getMatter } from "@/lib/matters";
import { EMAIL_PROVIDERS, type EmailProvider } from "@/lib/types";

function safeFileNamePart(subject: string): string {
  const cleaned = subject.replace(/[/\\?%*:|"<>]/g, "-").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "No subject";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const provider = body?.provider;
  const messageId = body?.messageId;
  const folderId = typeof body?.folderId === "string" ? body.folderId : undefined;

  if (!EMAIL_PROVIDERS.includes(provider as EmailProvider)) {
    return NextResponse.json({ error: "Unknown or missing provider" }, { status: 400 });
  }
  if (typeof messageId !== "string" || messageId.length === 0) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  let email;
  try {
    email = await getMessageBody(provider as EmailProvider, messageId, folderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch the email";
    const clientError =
      message.includes("is connected") || message.includes("not supported");
    return NextResponse.json({ error: message }, { status: clientError ? 400 : 502 });
  }

  const content = `From: ${email.from}\nSubject: ${email.subject}\n\n${email.body}`;
  const fileName = `Email - ${safeFileNamePart(email.subject)}.txt`;
  const file = new File([new Blob([content])], fileName, { type: "text/plain" });

  const document = await addDocument(id, file);
  await recordAuditEvent(
    "email_imported_to_matter",
    id,
    `Imported email "${email.subject}" from ${provider} as "${document.fileName}"`,
  );

  let newDeadlines = 0;
  try {
    newDeadlines = (await checkForNewDeadlines(id)).newCount;
  } catch {
    newDeadlines = 0;
  }
  let classificationSuggestion = null;
  try {
    classificationSuggestion = await checkMatterClassification(id);
  } catch {
    classificationSuggestion = null;
  }

  return NextResponse.json({ ...document, newDeadlines, classificationSuggestion }, { status: 201 });
}
