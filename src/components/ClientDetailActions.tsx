"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Client } from "@/lib/types";

export default function ClientDetailActions({
  client,
  matterCount,
}: {
  client: Client;
  matterCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, notes }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save changes");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to delete client");
      router.push("/clients");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="surface-card flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input required value={name} onChange={(e) => setName(e.target.value)} className="surface-input" placeholder="Name" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="surface-input" placeholder="Email" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="surface-input" placeholder="Phone" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="surface-input" placeholder="Notes" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary self-start">
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setEditing(true)} className="btn-secondary text-sm">
          Edit
        </button>
      </div>

      <div>
        <h2 className="mb-2 font-display text-lg">Danger zone</h2>
        <div className="surface-row flex flex-col gap-2">
          {matterCount > 0 ? (
            <p className="text-sm text-muted">
              Can&apos;t delete — {matterCount} matter{matterCount > 1 ? "s" : ""} still
              reference{matterCount > 1 ? "" : "s"} this client. Close or reassign
              {matterCount > 1 ? " them" : " it"} first.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted">
                Type <span className="font-mono">DELETE</span> to remove this client permanently.
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="surface-input"
                  placeholder="DELETE"
                />
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={confirmText !== "DELETE" || deleting}
                  className="btn-secondary text-red-600 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete client"}
                </button>
              </div>
              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
