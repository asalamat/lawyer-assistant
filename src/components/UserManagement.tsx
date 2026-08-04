"use client";

import { useEffect, useState } from "react";

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "lawyer" | "staff";
  active: number;
  mustChangePassword: number;
  createdAt: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<{ forEmail: string; value: string } | null>(
    null,
  );

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppUser["role"]>("lawyer");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => {
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUsers(data);
      });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create user");
      setRevealedPassword({ forEmail: body.user.email, value: body.temporaryPassword });
      setEmail("");
      setName("");
      setRole("lawyer");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(user: AppUser) {
    setError(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not update user");
      return;
    }
    await refresh();
  }

  async function handleRoleChange(user: AppUser, newRole: AppUser["role"]) {
    setError(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not update user");
      return;
    }
    await refresh();
  }

  async function handleResetPassword(user: AppUser) {
    setError(null);
    const res = await fetch(`/api/users/${user.id}/reset-password`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not reset password");
      return;
    }
    setRevealedPassword({ forEmail: user.email, value: body.temporaryPassword });
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleCreate} className="surface-card flex flex-col gap-3">
        <h3 className="font-medium">Add a user</h3>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="surface-input"
        />
        <input
          type="text"
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="surface-input"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as AppUser["role"])}
          className="surface-input"
        >
          <option value="lawyer">Lawyer</option>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={creating} className="btn-primary self-start">
          {creating ? "Adding…" : "Add user"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {revealedPassword && (
        <div className="surface-card flex flex-col gap-1 border border-accent/40">
          <p className="text-sm font-medium">
            Temporary password for {revealedPassword.forEmail}
          </p>
          <p className="font-mono text-sm">{revealedPassword.value}</p>
          <p className="text-xs text-muted">
            Shown once — copy it to them now. They&apos;ll be asked to set their own password on
            first login.
          </p>
          <button
            onClick={() => setRevealedPassword(null)}
            className="self-start text-xs text-accent hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="surface-card flex flex-col gap-2">
        <h3 className="font-medium">People with access</h3>
        {!users && <p className="text-sm text-muted">Loading…</p>}
        {users?.map((user) => (
          <div
            key={user.id}
            className="surface-row flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {user.name} {!user.active && <span className="text-xs text-red-600">(deactivated)</span>}
              </p>
              <p className="text-xs text-muted">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={user.role}
                onChange={(e) => handleRoleChange(user, e.target.value as AppUser["role"])}
                className="surface-input py-1 text-sm"
              >
                <option value="lawyer">Lawyer</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={() => handleResetPassword(user)}
                className="text-xs text-accent hover:underline"
              >
                Reset password
              </button>
              <button
                onClick={() => handleToggleActive(user)}
                className="text-xs text-accent hover:underline"
              >
                {user.active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
