import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { FeatureRequest, FeatureRequestStatus } from "./types";

export async function listFeatureRequests(): Promise<FeatureRequest[]> {
  return db
    .prepare("SELECT * FROM feature_requests ORDER BY createdAt DESC")
    .all()
    .map((row) => toPlain<FeatureRequest>(row));
}

export async function createFeatureRequest(input: {
  userId: string;
  userName: string;
  title: string;
  description?: string | null;
}): Promise<FeatureRequest> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO feature_requests (id, userId, userName, title, description, status, createdAt)
     VALUES (?, ?, ?, ?, ?, 'new', ?)`,
  ).run(id, input.userId, input.userName, input.title, input.description ?? null, createdAt);

  await recordAuditEvent("feature_request_submitted", null, `"${input.userName}" submitted a wish item: "${input.title}"`);

  return {
    id,
    userId: input.userId,
    userName: input.userName,
    title: input.title,
    description: input.description ?? null,
    status: "new",
    createdAt,
  };
}

export async function updateFeatureRequestStatus(
  id: string,
  status: FeatureRequestStatus,
): Promise<FeatureRequest | null> {
  const row = db.prepare("SELECT * FROM feature_requests WHERE id = ?").get(id);
  if (!row) return null;
  const existing = toPlain<FeatureRequest>(row);

  db.prepare("UPDATE feature_requests SET status = ? WHERE id = ?").run(status, id);
  await recordAuditEvent(
    "feature_request_status_changed",
    null,
    `Wish item "${existing.title}" marked ${status}`,
  );

  return { ...existing, status };
}

export async function deleteFeatureRequest(id: string): Promise<void> {
  const row = db.prepare("SELECT title FROM feature_requests WHERE id = ?").get(id) as
    | { title: string }
    | undefined;
  db.prepare("DELETE FROM feature_requests WHERE id = ?").run(id);
  if (row) {
    await recordAuditEvent("feature_request_deleted", null, `Deleted wish item "${row.title}"`);
  }
}
