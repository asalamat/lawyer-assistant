import { recordAuditEvent } from "./auditLog";
import type { UserRole } from "./auth";
import db, { toPlain } from "./db";

export interface MatterTeamMember {
  matterId: string;
  userId: string;
  roleOnMatter: string;
  addedAt: string;
  addedByUserId: string | null;
  name: string;
  email: string;
  userRole: UserRole;
}

// Normally bookkeeping, not an access-control gate — every staff member can
// see every matter by default (see src/proxy.ts). It becomes the actual
// access list once a matter's ethicalWall flag is turned on (see
// src/lib/matterAccess.ts) — assign the team before applying a wall, not
// after, or only admins will be able to get back in.
const TEAM_SELECT = `SELECT t.matterId as matterId, t.userId as userId, t.roleOnMatter as roleOnMatter,
          t.addedAt as addedAt, t.addedByUserId as addedByUserId,
          u.name as name, u.email as email, u.role as userRole
   FROM matter_team t
   JOIN users u ON u.id = t.userId`;

export async function listTeam(matterId: string): Promise<MatterTeamMember[]> {
  return db
    .prepare(`${TEAM_SELECT} WHERE t.matterId = ? ORDER BY t.addedAt ASC`)
    .all(matterId)
    .map((row) => toPlain<MatterTeamMember>(row));
}

export async function getTeamMember(
  matterId: string,
  userId: string,
): Promise<MatterTeamMember | null> {
  const row = db
    .prepare(`${TEAM_SELECT} WHERE t.matterId = ? AND t.userId = ?`)
    .get(matterId, userId);
  return row ? toPlain<MatterTeamMember>(row) : null;
}

export async function addTeamMember(
  matterId: string,
  userId: string,
  roleOnMatter: string,
  addedByUserId: string | null,
): Promise<MatterTeamMember> {
  const role = roleOnMatter.trim();
  if (!role) throw new Error("Describe this person's role on the matter.");

  const user = db.prepare("SELECT name, active FROM users WHERE id = ?").get(userId) as
    | { name: string; active: number }
    | undefined;
  if (!user) throw new Error("That person no longer has an account here.");
  if (!user.active) {
    throw new Error(`${user.name}'s account is deactivated and can't be assigned to a matter.`);
  }

  const existing = await getTeamMember(matterId, userId);
  if (existing) {
    throw new Error(`${user.name} is already on this matter's team as ${existing.roleOnMatter}.`);
  }

  db.prepare(
    "INSERT INTO matter_team (matterId, userId, roleOnMatter, addedAt, addedByUserId) VALUES (?, ?, ?, ?, ?)",
  ).run(matterId, userId, role, new Date().toISOString(), addedByUserId);

  await recordAuditEvent(
    "matter_team_member_added",
    matterId,
    `Assigned ${user.name} to this matter as ${role}`,
  );
  return (await getTeamMember(matterId, userId)) as MatterTeamMember;
}

export async function removeTeamMember(matterId: string, userId: string): Promise<boolean> {
  const member = await getTeamMember(matterId, userId);
  if (!member) return false;

  db.prepare("DELETE FROM matter_team WHERE matterId = ? AND userId = ?").run(matterId, userId);
  await recordAuditEvent(
    "matter_team_member_removed",
    matterId,
    `Removed ${member.name} (${member.roleOnMatter}) from this matter's team`,
  );
  return true;
}
