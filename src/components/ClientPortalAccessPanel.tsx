"use client";

import { useState } from "react";
import type { Client, ClientUser } from "@/lib/types";

export default function ClientPortalAccessPanel({
  client,
  initialClientUser,
}: {
  client: Client;
  initialClientUser: ClientUser | null;
}) {
  const [clientUser, setClientUser] = useState(initialClientUser);
  const [email, setEmail] = useState(client.email ?? "");
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  async function handleGrant() {
    setGranting(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/portal-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to grant portal access");
      setClientUser(body.clientUser);
      setTemporaryPassword(body.temporaryPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGranting(false);
    }
  }

  return (
    <div>
      <h2 className="mb-2 font-display text-lg">Client portal access</h2>
      <div className="surface-row flex flex-col gap-3 text-sm">
        {clientUser ? (
          <p className="text-muted">
            Portal account: <span className="font-medium text-foreground">{clientUser.email}</span>
          </p>
        ) : (
          <>
            <p className="text-muted">
              This client doesn&apos;t have portal access yet. Grant it to let them log in and
              view documents you&apos;ve shared with them.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Client email"
              className="surface-input"
            />
          </>
        )}
        <button onClick={handleGrant} disabled={granting || !email} className="btn-secondary self-start">
          {granting ? "…" : clientUser ? "Reset password" : "Grant portal access"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {temporaryPassword && (
          <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs">
            Temporary password (shown once — share it securely with the client):{" "}
            <span className="font-mono font-medium">{temporaryPassword}</span>. They&apos;ll be
            asked to set their own on first login at <span className="font-mono">/portal/login</span>.
          </p>
        )}
      </div>
    </div>
  );
}
