import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import { createNotificationIfNew } from "./calendar";
import db from "./db";
import { downloadCombinedDocument, getDocuSignEnvelopeStatus } from "./docusign";
import { addDocument } from "./matters";
import { getDocuSignConfig } from "./settings";

// This app has no public URL for DocuSign to call back to (see docusign.ts)
// — polling is the only option, not a webhook. Every 5 minutes is frequent
// enough that a signed document shows up promptly without hammering
// DocuSign's API for every pending envelope on every tick.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const STARTUP_DELAY_MS = 60_000;

let started = false;

interface PendingRow {
  id: string;
  matterId: string;
  title: string;
  docusignEnvelopeId: string;
}

async function recordCompletedEnvelope(
  row: PendingRow,
  envelopeStatus: { completedAt: string | null; signerName: string | null; signerEmail: string | null },
): Promise<void> {
  const bytes = await downloadCombinedDocument(row.docusignEnvelopeId);
  const fileName = `${row.title} - signed.pdf`;
  // Buffer's underlying ArrayBufferLike isn't assignable to File's BlobPart
  // (ArrayBuffer specifically) — slice() copies into a real ArrayBuffer.
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const file = new File([arrayBuffer], fileName, { type: "application/pdf" });
  const document = await addDocument(row.matterId, file);

  const signedAt = envelopeStatus.completedAt ?? new Date().toISOString();
  const signerName = envelopeStatus.signerName ?? "Signed via DocuSign";
  db.prepare(
    `INSERT INTO signatures (id, signableDocumentId, signerName, signerEmail, signatureText, signatureImage, documentHash, ipAddress, userAgent, signedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), row.id, signerName, envelopeStatus.signerEmail, signerName, null, document.contentHash, null, null, signedAt);

  db.prepare("UPDATE signable_documents SET status = 'signed', signedAt = ? WHERE id = ?").run(signedAt, row.id);

  await recordAuditEvent(
    "signable_document_signed",
    row.matterId,
    `${signerName} signed "${row.title}" via DocuSign`,
  );
  await createNotificationIfNew({
    type: "document_signed",
    title: `Signed via DocuSign: ${row.title}`,
    body: `${signerName} completed signing.`,
    matterId: row.matterId,
    relatedType: "signable_document",
    relatedId: row.id,
  });
}

async function checkPendingEnvelopes(): Promise<void> {
  const config = await getDocuSignConfig();
  if (!config?.enabled) return;

  const rows = db
    .prepare(
      "SELECT id, matterId, title, docusignEnvelopeId FROM signable_documents WHERE status = 'sent' AND docusignEnvelopeId IS NOT NULL",
    )
    .all() as unknown as PendingRow[];

  for (const row of rows) {
    try {
      const envelopeStatus = await getDocuSignEnvelopeStatus(row.docusignEnvelopeId);
      if (envelopeStatus.status === "completed") {
        await recordCompletedEnvelope(row, envelopeStatus);
      } else if (envelopeStatus.status === "declined") {
        db.prepare("UPDATE signable_documents SET status = 'declined', declinedAt = ? WHERE id = ?").run(
          new Date().toISOString(),
          row.id,
        );
        await recordAuditEvent(
          "signable_document_declined",
          row.matterId,
          `DocuSign: "${row.title}" was declined${envelopeStatus.declinedReason ? ` (${envelopeStatus.declinedReason})` : ""}`,
        );
      } else if (envelopeStatus.status === "voided") {
        db.prepare("UPDATE signable_documents SET status = 'voided' WHERE id = ?").run(row.id);
      }
      // Any other status (sent/delivered) — still waiting, nothing to do yet.
    } catch (err) {
      console.error(`[docusign-scheduler] failed to check envelope ${row.docusignEnvelopeId}:`, err);
    }
  }
}

export function startDocuSignScheduler(): void {
  if (started) return;
  started = true;
  console.log("[docusign-scheduler] started — checking pending envelopes every 5 minutes");
  setInterval(() => {
    checkPendingEnvelopes().catch((err) => console.error("[docusign-scheduler] tick failed:", err));
  }, CHECK_INTERVAL_MS);
  setTimeout(() => {
    checkPendingEnvelopes().catch((err) => console.error("[docusign-scheduler] initial check failed:", err));
  }, STARTUP_DELAY_MS);
}
