import { randomUUID } from "crypto";
import db, { toPlain } from "./db";
import type { StickyNote, StickyNoteColor } from "./types";

// Private to the user who wrote it — every query here is scoped by userId,
// not just filtered for display, so there is no code path that returns or
// mutates another user's note even if an id is guessed.

export async function listStickyNotes(userId: string, pagePath: string): Promise<StickyNote[]> {
  return db
    .prepare(
      "SELECT id, pagePath, content, color, x, y, createdAt, updatedAt FROM sticky_notes WHERE userId = ? AND pagePath = ? ORDER BY createdAt ASC",
    )
    .all(userId, pagePath)
    .map((row) => toPlain<StickyNote>(row));
}

export async function addStickyNote(
  userId: string,
  pagePath: string,
  color: StickyNoteColor,
  position: { x: number; y: number } | null = null,
): Promise<StickyNote> {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO sticky_notes (id, userId, pagePath, content, color, x, y, createdAt, updatedAt) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)",
  ).run(id, userId, pagePath, color, position?.x ?? null, position?.y ?? null, now, now);
  return { id, pagePath, content: "", color, x: position?.x ?? null, y: position?.y ?? null, createdAt: now, updatedAt: now };
}

export async function updateStickyNote(
  userId: string,
  id: string,
  updates: { content?: string; color?: StickyNoteColor; x?: number; y?: number },
): Promise<StickyNote | null> {
  const existing = db.prepare("SELECT * FROM sticky_notes WHERE id = ? AND userId = ?").get(id, userId) as
    | (StickyNote & { userId: string })
    | undefined;
  if (!existing) return null;

  const content = updates.content ?? existing.content;
  const color = updates.color ?? existing.color;
  const x = updates.x ?? existing.x;
  const y = updates.y ?? existing.y;
  const updatedAt = new Date().toISOString();
  db.prepare("UPDATE sticky_notes SET content = ?, color = ?, x = ?, y = ?, updatedAt = ? WHERE id = ?").run(
    content,
    color,
    x,
    y,
    updatedAt,
    id,
  );
  return { id, pagePath: existing.pagePath, content, color, x, y, createdAt: existing.createdAt, updatedAt };
}

export async function deleteStickyNote(userId: string, id: string): Promise<void> {
  db.prepare("DELETE FROM sticky_notes WHERE id = ? AND userId = ?").run(id, userId);
}
