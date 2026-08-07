"use client";

import { useState } from "react";
import { PARTY_ROLE_SUGGESTIONS, type Party } from "@/lib/types";

interface PartyFields {
  name: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
}

const EMPTY_FIELDS: PartyFields = { name: "", role: "", email: "", phone: "", notes: "" };

function toFields(party: Party): PartyFields {
  return {
    name: party.name,
    role: party.role,
    email: party.email ?? "",
    phone: party.phone ?? "",
    notes: party.notes ?? "",
  };
}

function PartyFieldset({
  fields,
  onChange,
  disabled,
}: {
  fields: PartyFields;
  onChange: (fields: PartyFields) => void;
  disabled: boolean;
}) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          required
          placeholder="Name"
          value={fields.name}
          onChange={(e) => onChange({ ...fields, name: e.target.value })}
          disabled={disabled}
          className="surface-input"
        />
        <input
          required
          list="party-roles"
          placeholder="Role (e.g. witness)"
          value={fields.role}
          onChange={(e) => onChange({ ...fields, role: e.target.value })}
          disabled={disabled}
          className="surface-input"
        />
        <input
          type="email"
          placeholder="Email (optional)"
          value={fields.email}
          onChange={(e) => onChange({ ...fields, email: e.target.value })}
          disabled={disabled}
          className="surface-input"
        />
        <input
          placeholder="Phone (optional)"
          value={fields.phone}
          onChange={(e) => onChange({ ...fields, phone: e.target.value })}
          disabled={disabled}
          className="surface-input"
        />
      </div>
      <textarea
        rows={2}
        placeholder="Notes (optional)"
        value={fields.notes}
        onChange={(e) => onChange({ ...fields, notes: e.target.value })}
        disabled={disabled}
        className="surface-input"
      />
    </>
  );
}

export default function PartiesPanel({
  matterId,
  initialParties,
}: {
  matterId: string;
  initialParties: Party[];
}) {
  const [parties, setParties] = useState(initialParties);
  const [newFields, setNewFields] = useState(EMPTY_FIELDS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState(EMPTY_FIELDS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/parties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFields),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add party");
      setParties((prev) => [...prev, body]);
      setNewFields(EMPTY_FIELDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/parties/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFields),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update party");
      setParties((prev) => prev.map((party) => (party.id === body.id ? body : party)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(partyId: string) {
    setParties((prev) => prev.filter((party) => party.id !== partyId));
    if (editingId === partyId) setEditingId(null);
    await fetch(`/api/matters/${matterId}/parties/${partyId}`, { method: "DELETE" });
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <h2 className="font-display text-lg">Parties</h2>
      <p className="text-sm text-muted">
        Everyone involved in this matter besides the client — opposing parties, counsel,
        witnesses, experts. Recorded here so they&apos;re queryable, rather than only appearing
        inside documents.
      </p>

      <datalist id="party-roles">
        {PARTY_ROLE_SUGGESTIONS.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>

      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <PartyFieldset fields={newFields} onChange={setNewFields} disabled={submitting} />
        <button type="submit" disabled={submitting} className="btn-primary self-start">
          {submitting ? "Saving…" : "Add party"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {parties.length === 0 ? (
        <p className="text-sm text-muted">No parties recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {parties.map((party) => (
            <li key={party.id} className="surface-row text-sm">
              {editingId === party.id ? (
                <form onSubmit={handleSaveEdit} className="flex flex-col gap-2">
                  <PartyFieldset
                    fields={editFields}
                    onChange={setEditFields}
                    disabled={submitting}
                  />
                  <div className="flex items-center gap-2">
                    <button type="submit" disabled={submitting} className="btn-primary">
                      {submitting ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <span className="font-medium">{party.name}</span>
                      <span className="badge ml-2">{party.role}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingId(party.id);
                          setEditFields(toFields(party));
                        }}
                        className="text-xs text-muted hover:text-accent"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(party.id)}
                        className="text-xs text-muted hover:text-red-600"
                        aria-label={`Remove ${party.name}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {(party.email || party.phone) && (
                    <p className="text-xs text-muted">
                      {[party.email, party.phone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {party.notes && <p className="mt-1 whitespace-pre-wrap">{party.notes}</p>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
