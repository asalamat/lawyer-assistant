"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = "idle" | "enrolling" | "confirmed";

export default function MfaSettingsForm({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<Step>("idle");
  const [secret, setSecret] = useState("");
  const [otpAuthUri, setOtpAuthUri] = useState("");
  const [qrCodeDataUri, setQrCodeDataUri] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleEnroll() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start enrollment");
      setSecret(body.secret);
      setOtpAuthUri(body.otpAuthUri);
      setQrCodeDataUri(body.qrCodeDataUri);
      setStep("enrolling");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not confirm code");
      setBackupCodes(body.backupCodes);
      setStep("confirmed");
      setEnabled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone() {
    setStep("idle");
    setCode("");
    setBackupCodes([]);
    setQrCodeDataUri("");
    router.refresh();
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not disable");
      setEnabled(false);
      setCurrentPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "confirmed") {
    return (
      <div className="surface-card flex flex-col gap-3">
        <h3 className="font-medium">Two-factor authentication enabled</h3>
        <p className="text-sm text-muted">
          Save these backup codes somewhere safe — each one can be used once to log in if you lose
          access to your authenticator app. They won&apos;t be shown again.
        </p>
        <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
          {backupCodes.map((code) => (
            <li key={code} className="surface-row">
              {code}
            </li>
          ))}
        </ul>
        <button type="button" onClick={handleDone} className="btn-primary self-start">
          Done
        </button>
      </div>
    );
  }

  if (step === "enrolling") {
    return (
      <form onSubmit={handleConfirm} className="surface-card flex flex-col gap-3">
        <h3 className="font-medium">Set up two-factor authentication</h3>
        <p className="text-sm text-muted">
          Scan this with your authenticator app (Google Authenticator, 1Password, Authy, etc.):
        </p>
        {qrCodeDataUri && (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URI, not a remote image; next/image has no benefit here.
          <img
            src={qrCodeDataUri}
            alt="Scan with your authenticator app to add this account"
            width={240}
            height={240}
            className="self-start rounded-lg border border-border"
          />
        )}
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Can&apos;t scan? Enter this secret manually</summary>
          <code className="mt-1 block break-all rounded bg-black/5 p-2 dark:bg-white/5">{secret}</code>
          <p className="mt-1">otpauth URI: <code className="break-all">{otpAuthUri}</code></p>
        </details>
        <input
          type="text"
          required
          autoFocus
          inputMode="numeric"
          placeholder="Enter the 6-digit code to confirm"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="surface-input"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Confirming…" : "Confirm"}
          </button>
          <button type="button" onClick={() => setStep("idle")} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <h3 className="font-medium">Two-factor authentication</h3>
      {enabled ? (
        <>
          <p className="text-sm text-muted">
            Enabled — logging in requires a code from your authenticator app (or a backup code) in
            addition to your password.
          </p>
          <form onSubmit={handleDisable} className="flex flex-col gap-2">
            <input
              type="password"
              required
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="surface-input"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-secondary self-start">
              {submitting ? "Disabling…" : "Disable two-factor authentication"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            Not enabled. Adds a second step at login (a code from an authenticator app) beyond your
            password.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="button" onClick={handleEnroll} disabled={submitting} className="btn-primary self-start">
            {submitting ? "…" : "Enable two-factor authentication"}
          </button>
        </>
      )}
    </div>
  );
}
