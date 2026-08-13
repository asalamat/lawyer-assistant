"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/formatDate";
import type { BackupScheduleStatus, ChangeBackupStatus, CloudBackupProvider, CloudBackupStatus } from "@/lib/settings";
import ChangeBackupPanel from "./ChangeBackupPanel";

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  return formatDateTime(iso);
}

const PROVIDER_LABELS: Record<CloudBackupProvider, string> = {
  s3: "S3-compatible (AWS S3, R2, B2, Wasabi, MinIO…)",
  "google-drive": "Google Drive",
  onedrive: "OneDrive",
};

export default function CloudBackupPanel({
  initialSchedule,
  initialCloud,
  initialDriveAppConfigured,
  initialChangeBackup,
}: {
  initialSchedule: BackupScheduleStatus;
  initialCloud: CloudBackupStatus;
  initialDriveAppConfigured: Record<"google-drive" | "onedrive", boolean>;
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

  const [driveAppConfiguredMap, setDriveAppConfiguredMap] = useState(initialDriveAppConfigured);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    Promise.resolve().then(() => setOrigin(window.location.origin));
  }, []);
  const [oauthClientId, setOAuthClientId] = useState("");
  const [oauthClientSecret, setOAuthClientSecret] = useState("");
  const [savingOAuth, setSavingOAuth] = useState(false);
  const [oauthError, setOAuthError] = useState<string | null>(null);

  const isDriveProvider = selectedProvider === "google-drive" || selectedProvider === "onedrive";
  const driveConnectedHere = isDriveProvider && cloud.provider === selectedProvider && cloud.configured;
  const driveAppConfigured = isDriveProvider ? driveAppConfiguredMap[selectedProvider] : false;

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
    if (!isDriveProvider) return;
    setSavingOAuth(true);
    setOAuthError(null);
    try {
      const res = await fetch(`/api/settings/cloud-backup/oauth-app/${selectedProvider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: oauthClientId, clientSecret: oauthClientSecret || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setDriveAppConfiguredMap((prev) => ({ ...prev, [selectedProvider]: true }));
      setOAuthClientId("");
      setOAuthClientSecret("");
    } catch (err) {
      setOAuthError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingOAuth(false);
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

        {selectedProvider === "s3" ? (
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
                  A dedicated app just for cloud backup, separate from anything used for email — do
                  this once and every staff member afterward just clicks &ldquo;Connect&rdquo; and signs in with
                  their own {selectedProvider === "google-drive" ? "Google" : "Microsoft"} account,
                  no credentials to paste.
                  {selectedProvider === "google-drive" ? (
                    <>
                      {" "}In Google Cloud Console: APIs &amp; Services &gt; Credentials — create an OAuth
                      Client ID (type: Web application), add authorized redirect URI{" "}
                      <code className="rounded bg-black/[0.04] px-1 dark:bg-white/[0.06]">
                        {origin || "https://YOUR-APP-URL"}/api/settings/cloud-backup/oauth/google-drive/callback
                      </code>
                      , then under APIs &amp; Services &gt; Enabled APIs, enable the Google Drive API. Google
                      still issues a client secret for this app type — enter it below alongside the Client ID.
                    </>
                  ) : (
                    <>
                      {" "}In the Azure Portal: Microsoft Entra ID &gt; App registrations — new
                      registration, platform type <span className="font-mono">Mobile and desktop
                      applications</span>, redirect URI{" "}
                      <code className="rounded bg-black/[0.04] px-1 dark:bg-white/[0.06]">
                        http://localhost/api/settings/cloud-backup/oauth/onedrive/callback
                      </code>
                      {" "}(Microsoft ignores the port on localhost redirect URIs, so this works no
                      matter which port the app is actually running on — register it exactly as
                      shown, with the literal word &ldquo;localhost&rdquo;). Then under API permissions &gt; Add
                      a permission &gt; Microsoft Graph &gt; Delegated permissions, add{" "}
                      <span className="font-mono">Files.ReadWrite</span>. No client secret needed —
                      this app type authenticates with PKCE instead, so leave the secret field below
                      blank.
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
                  {selectedProvider === "google-drive" && (
                    <input
                      type="password"
                      value={oauthClientSecret}
                      onChange={(e) => setOAuthClientSecret(e.target.value)}
                      placeholder="Client secret"
                      className="surface-input flex-1"
                    />
                  )}
                  <button
                    onClick={saveOAuthCredentials}
                    disabled={
                      savingOAuth ||
                      !oauthClientId.trim() ||
                      (selectedProvider === "google-drive" && !oauthClientSecret.trim())
                    }
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
        {driveConnectedHere || (cloud.provider === "s3" && cloud.configured) ? (
          <button onClick={testConnection} disabled={testing} className="btn-secondary self-start px-3 py-1.5 text-xs">
            {testing ? "Testing…" : "Test connection"}
          </button>
        ) : null}

        <p className="text-xs text-muted">
          {cloud.configured
            ? `Active: ${PROVIDER_LABELS[cloud.provider as CloudBackupProvider]}${
                cloud.provider === "s3" ? ` — bucket "${cloud.bucket}"` : ""
              }.`
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
