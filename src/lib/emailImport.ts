import { recordAuditEvent } from "./auditLog";
import { getMessageBody } from "./emailRead";
import { addDocument } from "./matters";
import type { Document, EmailProvider } from "./types";

function safeFileNamePart(subject: string): string {
  const cleaned = subject.replace(/[/\\?%*:|"<>]/g, "-").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "No subject";
}

// Shared by the single-email and bulk import routes so both build the
// document the same way — bulk import additionally skips the per-email
// deadline/classification check its caller would otherwise run, doing it
// once for the whole batch instead (see the bulk route).
export async function importEmailAsDocument(
  matterId: string,
  provider: EmailProvider,
  messageId: string,
  folderId?: string,
): Promise<Document> {
  const email = await getMessageBody(provider, messageId, folderId);
  const content = `From: ${email.from}\nSubject: ${email.subject}\n\n${email.body}`;
  const fileName = `Email - ${safeFileNamePart(email.subject)}.txt`;
  const file = new File([new Blob([content])], fileName, { type: "text/plain" });

  const document = await addDocument(matterId, file);
  await recordAuditEvent(
    "email_imported_to_matter",
    matterId,
    `Imported email "${email.subject}" from ${provider} as "${document.fileName}"`,
  );
  return document;
}
