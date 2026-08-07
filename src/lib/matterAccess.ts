import db from "./db";

// Ethical wall check for a single matter — admins always pass; everyone
// else passes unless the matter has ethicalWall set AND they're not on its
// matter_team. This is the one place that decides *visibility*, called from
// src/proxy.ts for page/API access and from the data layer wherever a list
// of matters needs the same rule applied (matters list, search, related-
// matter lookups) so a walled matter doesn't leak through a different path.
export function canAccessMatter(userId: string, role: string, matterId: string): boolean {
  if (role === "admin") return true;
  const matter = db.prepare("SELECT ethicalWall FROM matters WHERE id = ?").get(matterId) as
    | { ethicalWall: number }
    | undefined;
  if (!matter || !matter.ethicalWall) return true;

  const member = db
    .prepare("SELECT 1 FROM matter_team WHERE matterId = ? AND userId = ?")
    .get(matterId, userId);
  return !!member;
}

// Bulk version for filtering lists (matters list, search results) without a
// query per row — one query for every walled matter's team, not one per matter.
export function filterAccessibleMatterIds(userId: string, role: string, matterIds: string[]): Set<string> {
  if (role === "admin" || matterIds.length === 0) return new Set(matterIds);

  const placeholders = matterIds.map(() => "?").join(",");
  const walledIds = new Set(
    (
      db
        .prepare(`SELECT id FROM matters WHERE ethicalWall = 1 AND id IN (${placeholders})`)
        .all(...matterIds) as { id: string }[]
    ).map((row) => row.id),
  );
  if (walledIds.size === 0) return new Set(matterIds);

  const teamMatterIds = new Set(
    (
      db.prepare("SELECT matterId FROM matter_team WHERE userId = ?").all(userId) as {
        matterId: string;
      }[]
    ).map((row) => row.matterId),
  );

  return new Set(matterIds.filter((id) => !walledIds.has(id) || teamMatterIds.has(id)));
}
