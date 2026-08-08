import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { MatterTask } from "./types";

export async function listMatterTasks(matterId: string): Promise<MatterTask[]> {
  return db
    .prepare("SELECT * FROM tasks WHERE matterId = ? ORDER BY completed ASC, dueDate IS NULL, dueDate ASC, createdAt ASC")
    .all(matterId)
    .map((row) => toPlain<MatterTask>(row));
}

export async function getTask(id: string): Promise<MatterTask | null> {
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  return row ? toPlain<MatterTask>(row) : null;
}

// Rolls up every incomplete task assigned to a specific user across every
// matter — the same "surface it on the Dashboard without a separate view"
// shape as upcoming deadlines already use.
export async function listTasksForUser(userId: string): Promise<(MatterTask & { matterTitle: string })[]> {
  return db
    .prepare(
      `SELECT tasks.*, matters.title as matterTitle
       FROM tasks JOIN matters ON matters.id = tasks.matterId
       WHERE tasks.assignedToUserId = ? AND tasks.completed = 0
       ORDER BY tasks.dueDate IS NULL, tasks.dueDate ASC, tasks.createdAt ASC`,
    )
    .all(userId)
    .map((row) => toPlain<MatterTask & { matterTitle: string }>(row));
}

export async function createTask(input: {
  matterId: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  assignedToUserId?: string | null;
  createdByUserId: string | null;
}): Promise<MatterTask> {
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required");

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO tasks (id, matterId, title, description, dueDate, assignedToUserId, completed, completedAt, createdByUserId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
  ).run(
    id,
    input.matterId,
    title,
    input.description ?? null,
    input.dueDate ?? null,
    input.assignedToUserId ?? null,
    input.createdByUserId,
    createdAt,
  );

  await recordAuditEvent("task_created", input.matterId, `Added task "${title}"`);

  return {
    id,
    matterId: input.matterId,
    title,
    description: input.description ?? null,
    dueDate: input.dueDate ?? null,
    assignedToUserId: input.assignedToUserId ?? null,
    completed: 0,
    completedAt: null,
    createdByUserId: input.createdByUserId,
    createdAt,
  };
}

export async function updateTask(
  id: string,
  updates: {
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    assignedToUserId?: string | null;
  },
): Promise<MatterTask | null> {
  const existing = await getTask(id);
  if (!existing) return null;

  // Explicit per-field fallbacks, not a blind spread — the exact bug fixed
  // in updateLead() last round (a caller-supplied `undefined` for an unset
  // field would otherwise overwrite the existing value with undefined).
  const next: MatterTask = {
    ...existing,
    title: updates.title !== undefined ? updates.title.trim() : existing.title,
    description: updates.description !== undefined ? updates.description : existing.description,
    dueDate: updates.dueDate !== undefined ? updates.dueDate : existing.dueDate,
    assignedToUserId:
      updates.assignedToUserId !== undefined ? updates.assignedToUserId : existing.assignedToUserId,
  };
  if (!next.title) throw new Error("Task title is required");

  db.prepare(
    "UPDATE tasks SET title = ?, description = ?, dueDate = ?, assignedToUserId = ? WHERE id = ?",
  ).run(next.title, next.description, next.dueDate, next.assignedToUserId, id);

  return next;
}

export async function toggleTaskComplete(id: string, completed: boolean): Promise<MatterTask | null> {
  const existing = await getTask(id);
  if (!existing) return null;

  const completedAt = completed ? new Date().toISOString() : null;
  db.prepare("UPDATE tasks SET completed = ?, completedAt = ? WHERE id = ?").run(
    completed ? 1 : 0,
    completedAt,
    id,
  );

  if (completed) {
    await recordAuditEvent("task_completed", existing.matterId, `Completed task "${existing.title}"`);
  }

  return { ...existing, completed: completed ? 1 : 0, completedAt };
}

export async function deleteTask(id: string): Promise<void> {
  const existing = await getTask(id);
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  if (existing) {
    await recordAuditEvent("task_deleted", existing.matterId, `Deleted task "${existing.title}"`);
  }
}
