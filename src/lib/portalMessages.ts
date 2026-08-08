import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { PortalMessage, PortalMessageSenderType } from "./types";

export async function listPortalMessages(matterId: string): Promise<PortalMessage[]> {
  return db
    .prepare("SELECT * FROM portal_messages WHERE matterId = ? ORDER BY createdAt ASC")
    .all(matterId)
    .map((row) => toPlain<PortalMessage>(row));
}

export async function addPortalMessage(
  matterId: string,
  senderType: PortalMessageSenderType,
  senderUserId: string | null,
  content: string,
): Promise<PortalMessage> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message can't be empty");

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO portal_messages (id, matterId, senderType, senderUserId, content, createdAt, readAt) VALUES (?, ?, ?, ?, ?, ?, NULL)",
  ).run(id, matterId, senderType, senderUserId, trimmed, createdAt);

  await recordAuditEvent(
    "portal_message_sent",
    matterId,
    `${senderType === "staff" ? "Staff" : "Client"} sent a portal message`,
  );

  return { id, matterId, senderType, senderUserId, content: trimmed, createdAt, readAt: null };
}

// Marks every message from the OTHER side as read — called when a side
// loads the thread, not on a per-message basis. No unread-count badge
// surfaced elsewhere yet; this just records when a message was actually
// seen, in case that's needed later.
export async function markPortalMessagesRead(
  matterId: string,
  viewerType: PortalMessageSenderType,
): Promise<void> {
  const otherSide: PortalMessageSenderType = viewerType === "staff" ? "client" : "staff";
  db.prepare(
    "UPDATE portal_messages SET readAt = ? WHERE matterId = ? AND senderType = ? AND readAt IS NULL",
  ).run(new Date().toISOString(), matterId, otherSide);
}
