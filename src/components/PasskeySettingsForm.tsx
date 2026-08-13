"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useEffect, useState } from "react";
import { formatDateOnly } from "@/lib/formatDate";
import type { WebauthnCredentialRecord } from "@/lib/webauthn";

export default function PasskeySettingsForm({ initialCredentials }: { initialCredentials: WebauthnCredentialRecord[] }) {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Read only after mount — window isn't available during SSR, and this
  // avoids a hydration mismatch rather than branching on typeof window
  // directly in the render body.
  const [hostname, setHostname] = useState("this app's address");
  useEffect(() => {
    // Wrapped in a microtask rather than calling setState synchronously in
    // the effect body — same react-hooks/set-state-in-effect workaround
    // used elsewhere in this app (e.g. PushNotificationSettings.tsx).
    Promise.resolve().then(() => setHostname(window.location.hostname));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const optionsRes = await fetch("/api/auth/passkey/register-options", { method: "POST" });
      const optionsJSON = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(optionsJSON.error ?? "Could not start passkey registration");

      const response = await startRegistration({ optionsJSON });

      const verifyRes = await fetch("/api/auth/passkey/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, label: label.trim() || "Passkey" }),
      });
      const verifyBody = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyBody.error ?? "Could not register this passkey");

      const listRes = await fetch("/api/auth/passkey");
      setCredentials(await listRes.json());
      setLabel("");
    } catch (err) {
      // A cancelled/dismissed browser passkey prompt throws a real Error
      // with its own message (e.g. "The operation either timed out or was
      // not allowed") — surfacing it directly beats a generic failure here.
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/auth/passkey/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not remove this passkey");
      }
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <h3 className="font-medium">Passkeys</h3>
      <p className="text-sm text-muted">
        Sign in with your device&apos;s fingerprint, face recognition, screen lock, or a security
        key instead of typing your password. Each passkey is tied to this exact address (
        <code className="font-mono text-xs">{hostname}</code>) — it won&apos;t work if you reach
        this app through a different address later.
      </p>

      {credentials.length > 0 && (
        <ul className="flex flex-col gap-2">
          {credentials.map((cred) => (
            <li key={cred.id} className="surface-row flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{cred.label}</p>
                <p className="text-xs text-muted">
                  Added {formatDateOnly(cred.createdAt.slice(0, 10))}
                  {cred.lastUsedAt && ` · last used ${formatDateOnly(cred.lastUsedAt.slice(0, 10))}`}
                </p>
              </div>
              <button
                onClick={() => handleRemove(cred.id)}
                disabled={removingId === cred.id}
                className="text-xs text-muted hover:text-red-600"
              >
                {removingId === cred.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name this passkey (e.g. MacBook Touch ID)"
          className="surface-input"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={adding} className="btn-secondary self-start">
          {adding ? "Adding…" : "Add a passkey"}
        </button>
      </form>
    </div>
  );
}
