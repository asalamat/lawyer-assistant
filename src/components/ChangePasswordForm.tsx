"use client";

import { useState } from "react";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to change password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card flex flex-col gap-3">
      <h3 className="font-medium">Change password</h3>
      <input
        type="password"
        required
        placeholder="Current password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        className="surface-input"
      />
      <input
        type="password"
        required
        placeholder="New password (min 8 characters)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="surface-input"
      />
      <input
        type="password"
        required
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="surface-input"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Password changed.</p>}
      <button type="submit" disabled={submitting} className="btn-primary self-start">
        {submitting ? "Changing…" : "Change password"}
      </button>
      <p className="text-xs text-muted">
        Forgot your password instead? An admin can reset it from Settings &gt; Users, or run{" "}
        <code>npm run reset-password -- you@example.com</code> from the terminal.
      </p>
    </form>
  );
}
