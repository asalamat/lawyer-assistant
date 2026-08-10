"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/lib/formatDate";
import type { InstallPlan } from "@/lib/rcloneInstall";
import type { BackupScheduleStatus, ChangeBackupStatus, CloudBackupProvider, CloudBackupStatus } from "@/lib/settings";
import ChangeBackupPanel from "./ChangeBackupPanel";
import RcloneWizard from "./RcloneWizard";

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  return formatDateTime(iso);
}

const PROVIDER_LABELS: Record<CloudBackupProvider, string> = {
  s3: "S3-compatible (AWS S3, R2, B2, Wasabi, MinIO…)",
  "google-drive": "Google Drive",
  onedrive: "OneDrive",
  rclone: "rclone (no app registration needed)",
};

function emailProviderKeyFor(provider: "google-drive" | "onedrive"): "google" | "microsoft" {
  return provider === "google-drive" ? "google" : "microsoft";
}

export default function CloudBackupPanel({
  initialSchedule,
  initialCloud,
  initialOAuthConfigured,
  initialRcloneRemotes,
  initialRcloneInstalled,
  initialRcloneInstallPlan,
  initialChangeBackup,
}: {
  initialSchedule: BackupScheduleStatus;
  initialCloud: CloudBackupStatus;
  initialOAuthConfigured: { google: boolean; microsoft: boolean };
  initialRcloneRemotes: string[];
  initialRcloneInstalled: boolean;
  initialRcloneInstallPlan: InstallPlan;
  initialChangeBackup: ChangeBackupStatus;
}) {
  const searchParams = useSearchParams();
  const [callbackNotice] = useState(() => ({
    connected: searchParams.get("cloudBackupConnected"),
    error: searchParams.get("cloudBackupError"),
  }));

  const [schedule, setSchedule] = useState(initialSchedule);
  const [scheduleEnabled, setScheduleEnabled] = useState(initialSchedule.enabled);
  const [intervalHours, setIntervalHours] = useState(String(initialSchedule.intervalHours));
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [selectedProvider, setSelectedProvider] = useState<CloudBackupProvider>(initialCloud.provider ?? "s3");
  const [cloud, setCloud] = useState(initialCloud);

  const [endpoint, setEndpoint] = useState(initialCloud.endpoint ?? "");
  const [region, setRegion] = useState(initialCloud.region ?? "us-east-1");
  const [bucket, setBucket] = useState(initialCloud.bucket ?? "");
  const [prefix, setPrefix] = useState(initialCloud.prefix ?? "");
  const [forcePathStyle, setForcePathStyle] = useState(initialCloud.forcePathStyle);
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [savingCloud, setSavingCloud] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudSaved, setCloudSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const [oauthConfigured, setOAuthConfigured] = useState(initialOAuthConfigured);
  const [oauthClientId, setOAuthClientId] = useState("");
  const [oauthClientSecret, setOAuthClientSecret] = useState("");
  const [savingOAuth, setSavingOAuth] = useState(false);
  const [oauthError, setOAuthError] = useState<string | null>(null);

  const [rcloneRemotes, setRcloneRemotes] = useState(initialRcloneRemotes);
  const [rcloneRemote, setRcloneRemote] = useState(initialCloud.rcloneRemote ?? initialRcloneRemotes[0] ?? "");
  const [rclonePath, setRclonePath] = useState(initialCloud.rclonePath ?? "LawyerAssistantBackups");
  const [savingRclone, setSavingRclone] = useState(false);
  const [rcloneError, setRcloneError] = useState<string | null>(null);
  const [rcloneSaved, setRcloneSaved] = useState(false);

  const [rcloneInstalled, setRcloneInstalled] = useState(initialRcloneInstalled);
  const [installPlan, setInstallPlan] = useState(initialRcloneInstallPlan);
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function pollInstallStatus() {
    pollRef.current = setInterval(() => {
      fetch("/api/settings/cloud-backup/rclone/install")
        .then((res) => res.json())
        .then((body) => {
          setInstallPlan(body);
          if (body.status?.state === "success") {
            if (pollRef.current) clearInterval(pollRef.current);
            setInstalling(false);
            setRcloneInstalled(true);
            setInstallLog(null);
            return fetch("/api/settings/cloud-backup/rclone")
              .then((r) => r.json())
              .then((r) => setRcloneRemotes(r.remotes ?? []));
          }
          if (body.status?.state === "error") {
            if (pollRef.current) clearInterval(pollRef.current);
            setInstalling(false);
            setInstallLog(body.status.log);
          }
        })
        .catch(() => {
          if (pollRef.current) clearInterval(pollRef.current);
          setInstalling(false);
        });
    }, 3000);
  }

  async function installRclone() {
    setInstalling(true);
    setInstallLog(null);
    try {
      await fetch("/api/settings/cloud-backup/rclone/install", { method: "POST" });
      pollInstallStatus();
    } catch {
      setInstalling(false);
      setInstallLog("Something went wrong starting the install.");
    }
  }

  const isDriveProvider = selectedProvider === "google-drive" || selectedProvider === "onedrive";
  const driveConnectedHere = isDriveProvider && cloud.provider === selectedProvider && cloud.configured;
  const emailProviderKey = isDriveProvider ? emailProviderKeyFor(selectedProvider) : null;
  const driveAppConfigured = selectedProvider === "google-drive" ? oauthConfigured.google : oauthConfigured.microsoft;

  async function saveSchedule() {
    setSavingSchedule(true);
    setScheduleError(null);
    try {
      const res = await fetch("/api/settings/backup-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: scheduleEnabled, intervalHours: Number(intervalHours) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setSchedule(body);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingSchedule(false);
    }
  }

  async function saveS3() {
    setSavingCloud(true);
    setCloudError(null);
    setCloudSaved(false);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/cloud-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, region, bucket, prefix, forcePathStyle, accessKeyId, secretAccessKey }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setCloud(body);
      setAccessKeyId("");
      setSecretAccessKey("");
      setCloudSaved(true);
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingCloud(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/cloud-backup/test");
      const body = await res.json();
      setTestResult(body);
    } catch {
      setTestResult({ ok: false, error: "Something went wrong" });
    } finally {
      setTesting(false);
    }
  }

  async function saveOAuthCredentials() {
    if (!emailProviderKey) return;
    setSavingOAuth(true);
    setOAuthError(null);
    try {
      const res = await fetch(`/api/integrations/${emailProviderKey}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: oauthClientId, clientSecret: oauthClientSecret }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setOAuthConfigured((prev) => ({ ...prev, [emailProviderKey]: true }));
      setOAuthClientId("");
      setOAuthClientSecret("");
    } catch (err) {
      setOAuthError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingOAuth(false);
    }
  }

  async function saveRclone() {
    setSavingRclone(true);
    setRcloneError(null);
    setRcloneSaved(false);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/cloud-backup/rclone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remote: rcloneRemote, path: rclonePath }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setCloud(body);
      setRcloneSaved(true);
    } catch (err) {
      setRcloneError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingRclone(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/settings/cloud-backup/disconnect", { method: "POST" });
      const body = await res.json();
      setCloud(body);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="surface-row flex flex-col gap-3 text-sm">
        <p className="font-medium">Automatic backups</p>
        <p className="text-muted">
          Runs entirely in this app — no OS-level cron job needed. Creates a local backup on the
          interval below and, if cloud storage is configured further down, uploads it there too.
        </p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
          />
          Enable automatic backups
        </label>
        <div className="flex items-center gap-2">
          <span className="text-muted">Every</span>
          <input
            type="number"
            min={1}
            max={168}
            value={intervalHours}
            onChange={(e) => setIntervalHours(e.target.value)}
            className="surface-input w-20"
          />
          <span className="text-muted">hour(s)</span>
        </div>
        {scheduleError && <p className="text-red-600">{scheduleError}</p>}
        <button
          onClick={saveSchedule}
          disabled={savingSchedule}
          className="btn-primary self-start px-3 py-1.5 text-xs"
        >
          {savingSchedule ? "Saving…" : "Save schedule"}
        </button>
        <p className="text-xs text-muted">
          Last automatic backup: {formatWhen(schedule.lastRunAt)}
          {schedule.lastStatus === "error" && schedule.lastError ? (
            <span className="text-red-600"> — failed: {schedule.lastError}</span>
          ) : null}
        </p>
      </div>

      <ChangeBackupPanel initialStatus={initialChangeBackup} />

      <div className="surface-row flex flex-col gap-3 text-sm">
        <p className="font-medium">Cloud storage</p>

        {callbackNotice.connected && (
          <p className="text-emerald-600">
            Connected {callbackNotice.connected === "google-drive" ? "Google Drive" : "OneDrive"}.
          </p>
        )}
        {callbackNotice.error && <p className="text-red-600">{callbackNotice.error}</p>}

        <div className="flex flex-wrap gap-2">
          {(Object.keys(PROVIDER_LABELS) as CloudBackupProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedProvider(p)}
              className={
                selectedProvider === p
                  ? "btn-primary px-3 py-1.5 text-xs"
                  : "btn-secondary px-3 py-1.5 text-xs"
              }
            >
              {PROVIDER_LABELS[p]}
            </button>
          ))}
        </div>

        {selectedProvider === "rclone" ? (
          <>
            <p className="text-muted">
              Uses <span className="font-mono text-xs">rclone</span> — a free command-line sync
              tool that ships its own already-registered Microsoft/Google app, so there&apos;s
              nothing to register yourself. One-time setup, done once in a terminal on this
              machine (not something every user needs to repeat):
            </p>
            {!rcloneInstalled && (
              <div className="flex flex-col gap-2 text-xs text-muted">
                <span>rclone isn&apos;t installed on this machine yet.</span>
                {installPlan.canAutoInstall ? (
                  <div className="flex items-center gap-2">
                    <button onClick={installRclone} disabled={installing} className="btn-primary px-3 py-1.5 text-xs">
                      {installing ? "Installing…" : "Install rclone"}
                    </button>
                    <span className="font-mono">({installPlan.command})</span>
                  </div>
                ) : (
                  <span>
                    Can&apos;t install it automatically here ({installPlan.reason}) — download it directly instead:{" "}
                    <a href={installPlan.manualUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      rclone.org/downloads
                    </a>{" "}
                    (pick the installer for your operating system, no command line needed).
                  </span>
                )}
                {installLog && <p className="text-red-600">{installLog}</p>}
              </div>
            )}

            {rcloneInstalled && (
              <RcloneWizard
                onComplete={(newRemote) => {
                  setRcloneRemote(newRemote);
                  fetch("/api/settings/cloud-backup/rclone")
                    .then((r) => r.json())
                    .then((r) => setRcloneRemotes(r.remotes ?? []));
                }}
              />
            )}

            {rcloneInstalled && (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer select-none">
                  Prefer to set it up yourself in a terminal instead?
                </summary>
                <p className="mt-2">
                  Run <code className="rounded bg-black/[0.04] px-1 dark:bg-white/[0.06]">rclone config</code> → {" "}
                  <span className="font-mono">n</span> (new remote) → name it → pick{" "}
                  <span className="font-mono">onedrive</span> or <span className="font-mono">drive</span> from the
                  list → accept the defaults → it opens your browser to sign in and approve access, then come back
                  here and pick the remote you named below.
                </p>
              </details>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Remote name</span>
                {rcloneRemotes.length > 0 ? (
                  <select
                    value={rcloneRemote}
                    onChange={(e) => setRcloneRemote(e.target.value)}
                    className="surface-input"
                  >
                    <option value="">Select a remote…</option>
                    {rcloneRemotes.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={rcloneRemote}
                    onChange={(e) => setRcloneRemote(e.target.value)}
                    placeholder="onedrive"
                    className="surface-input"
                  />
                )}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Folder path on the remote</span>
                <input
                  value={rclonePath}
                  onChange={(e) => setRclonePath(e.target.value)}
                  placeholder="LawyerAssistantBackups"
                  className="surface-input"
                />
              </label>
            </div>
            {rcloneRemotes.length === 0 && (
              <p className="text-xs text-muted">
                No remotes found yet — run <span className="font-mono">rclone config</span> first, then reload this
                page to pick from a list instead of typing the name.
              </p>
            )}

            {rcloneError && <p className="text-red-600">{rcloneError}</p>}
            {rcloneSaved && <p className="text-emerald-600">Saved.</p>}

            <div className="flex gap-2">
              <button
                onClick={saveRclone}
                disabled={savingRclone || !rcloneRemote.trim()}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                {savingRclone ? "Saving…" : "Save"}
              </button>
              {cloud.provider === "rclone" && cloud.configured && (
                <button onClick={disconnect} disabled={disconnecting} className="btn-secondary px-3 py-1.5 text-xs">
                  {disconnecting ? "Clearing…" : "Clear"}
                </button>
              )}
            </div>
          </>
        ) : selectedProvider === "s3" ? (
          <>
            <p className="text-muted">
              Works with AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO, DigitalOcean Spaces —
              anything speaking the S3 API. A free-tier bucket on Backblaze B2 or Cloudflare R2
              takes a few minutes to create.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Endpoint URL (blank = real AWS S3)</span>
                <input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://s3.us-west-000.backblazeb2.com"
                  className="surface-input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Region</span>
                <input value={region} onChange={(e) => setRegion(e.target.value)} className="surface-input" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Bucket</span>
                <input value={bucket} onChange={(e) => setBucket(e.target.value)} className="surface-input" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Path prefix (optional)</span>
                <input
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="lawyer-assistant-backups"
                  className="surface-input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Access key ID</span>
                <input
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  placeholder={cloud.provider === "s3" && cloud.configured ? cloud.accessKeyIdPreview ?? "" : ""}
                  className="surface-input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Secret access key</span>
                <input
                  type="password"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  placeholder={cloud.provider === "s3" && cloud.configured ? "••••••••" : ""}
                  className="surface-input"
                />
              </label>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={forcePathStyle}
                onChange={(e) => setForcePathStyle(e.target.checked)}
              />
              Use path-style addressing (needed for MinIO/some self-hosted providers)
            </label>

            {cloudError && <p className="text-red-600">{cloudError}</p>}
            {cloudSaved && <p className="text-emerald-600">Saved.</p>}

            <div className="flex gap-2">
              <button
                onClick={saveS3}
                disabled={savingCloud || !region.trim() || !bucket.trim() || !accessKeyId.trim() || !secretAccessKey}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                {savingCloud ? "Saving…" : "Save cloud settings"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted">
              Only backs up into a dedicated{" "}
              <span className="font-mono text-xs">
                {selectedProvider === "google-drive" ? "Lawyer Assistant Backups" : "LawyerAssistantBackups"}
              </span>{" "}
              folder it creates itself — never touches the rest of the connected account&apos;s
              files.
            </p>

            {!driveAppConfigured && (
              <div className="surface-row flex flex-col gap-2 border-amber-500/40 bg-amber-500/10">
                <p className="font-medium">
                  One-time setup: register a free {selectedProvider === "google-drive" ? "Google Cloud" : "Azure AD"} app
                </p>
                <p className="text-xs text-muted">
                  This is the same app registration the {selectedProvider === "google-drive" ? "Gmail" : "Outlook/O365"} email
                  integration uses (Settings &gt; Integrations) — if you&apos;ve already registered one for
                  email, reuse it: just add the permission below and enter the same Client ID/Secret here.
                  {selectedProvider === "google-drive" ? (
                    <>
                      {" "}In Google Cloud Console: APIs &amp; Services &gt; Credentials — create an OAuth
                      Client ID (type: Web application), add authorized redirect URI{" "}
                      <code className="rounded bg-black/[0.04] px-1 dark:bg-white/[0.06]">
                        https://YOUR-APP-URL/api/integrations/google/callback
                      </code>
                      , then under APIs &amp; Services &gt; Enabled APIs, enable the Google Drive API.
                    </>
                  ) : (
                    <>
                      {" "}In the Azure Portal: Microsoft Entra ID &gt; App registrations — new
                      registration, add redirect URI (platform: Web){" "}
                      <code className="rounded bg-black/[0.04] px-1 dark:bg-white/[0.06]">
                        https://YOUR-APP-URL/api/integrations/microsoft/callback
                      </code>
                      , then under API permissions &gt; Add a permission &gt; Microsoft Graph &gt;
                      Delegated permissions, add <span className="font-mono">Files.ReadWrite</span>.
                      Create a client secret under Certificates &amp; secrets.
                    </>
                  )}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={oauthClientId}
                    onChange={(e) => setOAuthClientId(e.target.value)}
                    placeholder="Client ID"
                    className="surface-input flex-1"
                  />
                  <input
                    type="password"
                    value={oauthClientSecret}
                    onChange={(e) => setOAuthClientSecret(e.target.value)}
                    placeholder="Client secret"
                    className="surface-input flex-1"
                  />
                  <button
                    onClick={saveOAuthCredentials}
                    disabled={savingOAuth || !oauthClientId.trim() || !oauthClientSecret.trim()}
                    className="btn-primary px-3 py-2 text-xs"
                  >
                    {savingOAuth ? "Saving…" : "Save"}
                  </button>
                </div>
                {oauthError && <p className="text-xs text-red-600">{oauthError}</p>}
              </div>
            )}

            {driveConnectedHere ? (
              <>
                <p>
                  Connected as <span className="font-medium">{cloud.driveAccountEmail}</span>.
                </p>
                <button
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="btn-secondary self-start px-3 py-1.5 text-xs"
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </>
            ) : (
              driveAppConfigured && (
                <a href={`/api/settings/cloud-backup/connect/${selectedProvider}`} className="btn-primary self-start px-3 py-1.5 text-xs">
                  Connect {PROVIDER_LABELS[selectedProvider]}
                </a>
              )
            )}
          </>
        )}

        {testResult && (
          <p className={testResult.ok ? "text-emerald-600" : "text-red-600"}>
            {testResult.ok ? "Connection works." : `Failed: ${testResult.error}`}
          </p>
        )}
        {driveConnectedHere ||
        (cloud.provider === "s3" && cloud.configured) ||
        (cloud.provider === "rclone" && cloud.configured) ? (
          <button onClick={testConnection} disabled={testing} className="btn-secondary self-start px-3 py-1.5 text-xs">
            {testing ? "Testing…" : "Test connection"}
          </button>
        ) : null}

        <p className="text-xs text-muted">
          {cloud.configured
            ? `Active: ${PROVIDER_LABELS[cloud.provider as CloudBackupProvider]}${
                cloud.provider === "s3" ? ` — bucket "${cloud.bucket}"` : ""
              }${cloud.provider === "rclone" ? ` — remote "${cloud.rcloneRemote}"` : ""}.`
            : "Not configured yet."}{" "}
          Last upload: {formatWhen(cloud.lastRunAt)}
          {cloud.lastStatus === "error" && cloud.lastError ? (
            <span className="text-red-600"> — failed: {cloud.lastError}</span>
          ) : null}
          {cloud.lastStatus === "ok" && cloud.lastUploadedFileName ? ` (${cloud.lastUploadedFileName})` : null}
        </p>
      </div>
    </div>
  );
}
