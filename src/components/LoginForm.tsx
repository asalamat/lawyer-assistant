"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm({ mode }: { mode: "login" | "create" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "create" && password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "create" ? { email, name, password } : { email, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Login failed");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {mode === "create" && (
        <p className="text-sm text-muted">
          No account exists yet. Create the first admin account to protect this app.
        </p>
      )}
      <input
        type="email"
        required
        autoFocus
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="surface-input"
      />
      {mode === "create" && (
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="surface-input"
        />
      )}
      <input
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="surface-input"
      />
      {mode === "create" && (
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className="surface-input"
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-primary">
        {submitting ? "…" : mode === "create" ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
