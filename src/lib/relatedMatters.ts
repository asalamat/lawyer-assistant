import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { Matter, RelatedMatterLink } from "./types";

export interface MatterSearchResult {
  id: string;
  fileNumber: string;
  title: string;
  status: Matter["status"];
}

const SEARCH_RESULT_LIMIT = 20;

function getMatterSummary(matterId: string): MatterSearchResult | null {
  const row = db
    .prepare("SELECT id, fileNumber, title, status FROM matters WHERE id = ?")
    .get(matterId);
  return row ? toPlain<MatterSearchResult>(row) : null;
}

// A link is stored as a single directed row, but reads on either matter must
// see it — so both directions are queried and merged. The dedupe by the other
// matter's id guards against a pair that somehow ended up linked in both
// directions (nothing inserts both today, but the primary key permits it).
export async function listRelatedMatters(matterId: string): Promise<RelatedMatterLink[]> {
  const outgoing = db
    .prepare(
      `SELECT m.id as matterId, m.fileNumber as fileNumber, m.title as title, m.status as status,
              r.note as note, r.createdAt as createdAt
       FROM related_matters r
       JOIN matters m ON m.id = r.relatedMatterId
       WHERE r.matterId = ?`,
    )
    .all(matterId)
    .map((row) => toPlain<RelatedMatterLink>(row));

  const incoming = db
    .prepare(
      `SELECT m.id as matterId, m.fileNumber as fileNumber, m.title as title, m.status as status,
              r.note as note, r.createdAt as createdAt
       FROM related_matters r
       JOIN matters m ON m.id = r.matterId
       WHERE r.relatedMatterId = ?`,
    )
    .all(matterId)
    .map((row) => toPlain<RelatedMatterLink>(row));

  const byMatterId = new Map<string, RelatedMatterLink>();
  for (const link of [...outgoing, ...incoming]) {
    const existing = byMatterId.get(link.matterId);
    if (!existing || link.createdAt < existing.createdAt) {
      byMatterId.set(link.matterId, link);
    }
  }

  return [...byMatterId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function findExistingLink(
  matterId: string,
  relatedMatterId: string,
): { matterId: string; relatedMatterId: string } | null {
  const row = db
    .prepare(
      `SELECT matterId, relatedMatterId FROM related_matters
       WHERE (matterId = ? AND relatedMatterId = ?) OR (matterId = ? AND relatedMatterId = ?)`,
    )
    .get(matterId, relatedMatterId, relatedMatterId, matterId);
  return row ? toPlain<{ matterId: string; relatedMatterId: string }>(row) : null;
}

export async function addRelatedMatter(
  matterId: string,
  relatedMatterId: string,
  note: string | null,
  createdByUserId: string | null,
): Promise<RelatedMatterLink> {
  if (matterId === relatedMatterId) {
    throw new Error("A matter can't be linked to itself");
  }
  const related = getMatterSummary(relatedMatterId);
  if (!related) throw new Error("The matter you're linking to no longer exists");
  if (findExistingLink(matterId, relatedMatterId)) {
    throw new Error(`This matter is already linked to ${related.fileNumber}`);
  }

  const createdAt = new Date().toISOString();
  const trimmedNote = note?.trim() || null;
  db.prepare(
    "INSERT INTO related_matters (matterId, relatedMatterId, note, createdAt, createdByUserId) VALUES (?, ?, ?, ?, ?)",
  ).run(matterId, relatedMatterId, trimmedNote, createdAt, createdByUserId);

  await recordAuditEvent(
    "related_matter_linked",
    matterId,
    `Linked to matter ${related.fileNumber} ("${related.title}")${trimmedNote ? `: ${trimmedNote}` : ""}`,
  );

  return {
    matterId: related.id,
    fileNumber: related.fileNumber,
    title: related.title,
    status: related.status,
    note: trimmedNote,
    createdAt,
  };
}

// Deletes both directions: only one row is ever inserted per link, but which
// direction that is depends on which matter the lawyer was looking at when
// they created it, so unlinking from either side has to clear both.
export async function removeRelatedMatter(
  matterId: string,
  relatedMatterId: string,
): Promise<boolean> {
  if (!findExistingLink(matterId, relatedMatterId)) return false;

  db.prepare(
    "DELETE FROM related_matters WHERE (matterId = ? AND relatedMatterId = ?) OR (matterId = ? AND relatedMatterId = ?)",
  ).run(matterId, relatedMatterId, relatedMatterId, matterId);

  const related = getMatterSummary(relatedMatterId);
  await recordAuditEvent(
    "related_matter_unlinked",
    matterId,
    related
      ? `Unlinked from matter ${related.fileNumber} ("${related.title}")`
      : "Unlinked from a deleted matter",
  );
  return true;
}

export async function searchMattersForLinking(
  query: string,
  excludeMatterId: string,
): Promise<MatterSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return db
    .prepare(
      `SELECT id, fileNumber, title, status FROM matters
       WHERE id != ? AND (title LIKE ? OR fileNumber LIKE ?)
       ORDER BY createdAt DESC
       LIMIT ?`,
    )
    .all(excludeMatterId, `%${trimmed}%`, `%${trimmed}%`, SEARCH_RESULT_LIMIT)
    .map((row) => toPlain<MatterSearchResult>(row));
}
