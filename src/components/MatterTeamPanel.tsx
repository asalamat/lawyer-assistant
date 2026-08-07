"use client";

import { useEffect, useState } from "react";
import type { MatterTeamMember } from "@/lib/matterTeam";

interface StaffOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function MatterTeamPanel({
  matterId,
  initialTeam,
}: {
  matterId: string;
  initialTeam: MatterTeamMember[];
}) {
  const [team, setTeam] = useState(initialTeam);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [roleOnMatter, setRoleOnMatter] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/staff")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStaff(data);
      });
  }, []);

  const assignedIds = new Set(team.map((member) => member.userId));
  const available = staff.filter((person) => !assignedIds.has(person.id));

  async function handleAdd() {
    if (!selectedUserId || !roleOnMatter.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, roleOnMatter }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not add team member");
      setTeam((prev) => [...prev, body]);
      setSelectedUserId("");
      setRoleOnMatter("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(member: MatterTeamMember) {
    setError(null);
    const res = await fetch(`/api/matters/${matterId}/team/${member.userId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not remove team member");
      return;
    }
    setTeam((prev) => prev.filter((m) => m.userId !== member.userId));
  }

  return (
    <div>
      <h2 className="mb-2 font-display text-lg">Team</h2>
      <p className="mb-2 text-sm text-muted">
        Who&apos;s working this matter and in what capacity. Everyone at the firm can still see
        every matter — this records responsibility, it doesn&apos;t restrict access.
      </p>

      {team.length === 0 ? (
        <p className="text-sm text-muted">Nobody is assigned to this matter yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {team.map((member) => (
            <li
              key={member.userId}
              className="surface-row flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {member.name} <span className="badge ml-1">{member.roleOnMatter}</span>
                </p>
                <p className="text-xs text-muted">
                  {member.email} · {member.userRole}
                </p>
              </div>
              <button
                onClick={() => handleRemove(member)}
                className="self-start text-xs text-muted hover:text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="surface-input flex-1"
          >
            <option value="">Add a team member…</option>
            {available.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} ({person.email}) · {person.role}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={roleOnMatter}
            onChange={(e) => setRoleOnMatter(e.target.value)}
            placeholder="Role on this matter, e.g. Lead lawyer"
            className="surface-input flex-1"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !selectedUserId || !roleOnMatter.trim()}
            className="btn-secondary"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
