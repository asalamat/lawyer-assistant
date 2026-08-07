"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ClientType } from "@/lib/types";

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  individual: "Individual",
  corporate: "Corporate",
  institutional: "Institutional",
};

export default function NewClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ClientType>("individual");
  const [contactPerson, setContactPerson] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          contactPerson: type === "individual" ? undefined : contactPerson,
          registrationNumber: type === "individual" ? undefined : registrationNumber,
          email,
          phone,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create client");
      setName("");
      setType("individual");
      setContactPerson("");
      setRegistrationNumber("");
      setEmail("");
      setPhone("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary self-start">
        Add client
      </button>
    );
  }

  return (
    <form onSubmit={handleCreate} className="surface-card flex flex-col gap-3">
      <h2 className="font-display text-lg">New client</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          required
          autoFocus
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="surface-input"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ClientType)}
          className="surface-input"
        >
          {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {type !== "individual" && (
          <>
            <input
              placeholder="Contact person"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="surface-input"
            />
            <input
              placeholder="Registration/incorporation number (optional)"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              className="surface-input"
            />
          </>
        )}
        <input
          type="email"
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="surface-input"
        />
        <input
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="surface-input"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting} className="btn-primary self-start">
          {submitting ? "Adding…" : "Add client"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
    </form>
  );
}
