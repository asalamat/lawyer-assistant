import { getLegislationMetadata } from "./canlii";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { LegislationWatch } from "./types";

// Only these fields are meaningful for change detection — CanLII's API
// doesn't expose the actual statute text (see LegislationWatch doc comment
// in types.ts), so title/citation/url churn is ignored as noise.
function snapshotOf(metadata: {
  repealed?: boolean;
  startDate?: string;
  endDate?: string;
  content?: unknown;
}): string {
  return JSON.stringify({
    repealed: metadata.repealed ?? null,
    startDate: metadata.startDate ?? null,
    endDate: metadata.endDate ?? null,
    content: metadata.content ?? null,
  });
}

export async function listLegislationWatches(): Promise<LegislationWatch[]> {
  return db
    .prepare("SELECT * FROM legislation_watches ORDER BY createdAt DESC")
    .all()
    .map((row) => toPlain<LegislationWatch>(row));
}

export async function addLegislationWatch(input: {
  databaseId: string;
  legislationId: string;
  label: string;
}): Promise<LegislationWatch> {
  const watch: LegislationWatch = {
    id: crypto.randomUUID(),
    databaseId: input.databaseId,
    legislationId: input.legislationId,
    label: input.label,
    lastSnapshot: null,
    lastCheckedAt: null,
    lastChangedAt: null,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO legislation_watches (id, databaseId, legislationId, label, lastSnapshot, lastCheckedAt, lastChangedAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    watch.id,
    watch.databaseId,
    watch.legislationId,
    watch.label,
    watch.lastSnapshot,
    watch.lastCheckedAt,
    watch.lastChangedAt,
    watch.createdAt,
  );
  await recordAuditEvent(
    "legislation_watch_added",
    null,
    `Started watching "${watch.label}" (${watch.databaseId}/${watch.legislationId})`,
  );
  return watch;
}

export async function deleteLegislationWatch(id: string): Promise<void> {
  const row = db
    .prepare("SELECT label FROM legislation_watches WHERE id = ?")
    .get(id) as unknown as { label: string } | undefined;
  db.prepare("DELETE FROM legislation_watches WHERE id = ?").run(id);
  if (row) {
    await recordAuditEvent("legislation_watch_removed", null, `Stopped watching "${row.label}"`);
  }
}

export interface CheckResult {
  watch: LegislationWatch;
  changed: boolean;
  error: string | null;
}

export async function checkLegislationWatch(id: string): Promise<CheckResult> {
  const row = db.prepare("SELECT * FROM legislation_watches WHERE id = ?").get(id);
  if (!row) throw new Error("Watch not found");
  const watch = toPlain<LegislationWatch>(row);

  try {
    const metadata = await getLegislationMetadata(watch.databaseId, watch.legislationId);
    const snapshot = snapshotOf(metadata);
    const changed = watch.lastSnapshot !== null && watch.lastSnapshot !== snapshot;
    const now = new Date().toISOString();

    db.prepare(
      "UPDATE legislation_watches SET lastSnapshot = ?, lastCheckedAt = ?, lastChangedAt = ? WHERE id = ?",
    ).run(snapshot, now, changed ? now : watch.lastChangedAt, id);

    if (changed) {
      await recordAuditEvent(
        "legislation_watch_changed",
        null,
        `"${watch.label}" changed (repeal status, dates, or section structure differ from the last check)`,
      );
    }

    const updated = toPlain<LegislationWatch>(
      db.prepare("SELECT * FROM legislation_watches WHERE id = ?").get(id),
    );
    return { watch: updated, changed, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Check failed";
    db.prepare("UPDATE legislation_watches SET lastCheckedAt = ? WHERE id = ?").run(
      new Date().toISOString(),
      id,
    );
    const updated = toPlain<LegislationWatch>(
      db.prepare("SELECT * FROM legislation_watches WHERE id = ?").get(id),
    );
    return { watch: updated, changed: false, error: message };
  }
}

export async function checkAllLegislationWatches(): Promise<CheckResult[]> {
  const watches = await listLegislationWatches();
  const results: CheckResult[] = [];
  for (const watch of watches) {
    results.push(await checkLegislationWatch(watch.id));
  }
  return results;
}
