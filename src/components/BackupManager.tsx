"use client";

import { useRef, useState } from "react";

interface BackupInfo {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export default function BackupManager({
  initialBackups,
  cronSecret,
}: {
  initialBackups: BackupInfo[];
  cronSecret: string;
}) {
  const [backups, setBackups] = useState(initialBackups);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadConfirming, setUploadConfirming] = useState(false);
  const [uploadConfirmText, setUploadConfirmText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const res = await fetch("/api/backup");
    if (res.ok) setBackups(await res.json());
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create backup");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(fileName: string) {
    setError(null);
    const res = await fetch(`/api/backup/${encodeURIComponent(fileName)}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Failed to delete backup");
      return;
    }
    await refresh();
  }

  async function handleRestore(fileName: string) {
    setRestoring(true);
    setError(null);
    setRestoreResult(null);
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, confirm: "RESTORE" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Restore failed");
      setRestoreResult(body.message);
      setRestoreTarget(null);
      setConfirmText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRestoring(false);
    }
  }

  async function handleRestoreUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setError(null);
    setRestoreResult(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("confirm", "RESTORE");
      const res = await fetch("/api/backup/restore-upload", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Restore failed");
      setRestoreResult(body.message);
      setUploadFile(null);
      setUploadConfirming(false);
      setUploadConfirmText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  const cronCommand = `curl -X POST https://YOUR-APP-URL/api/backup/scheduled -H "Authorization: Bearer ${cronSecret}"`;

  return (
    <div className="flex flex-col gap-4">
      {restoreResult && (
        <div className="surface-row border-amber-500/40 bg-amber-500/10 text-sm">
          <p className="font-medium">{restoreResult}</p>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {backups.length} backup{backups.length === 1 ? "" : "s"} kept (oldest beyond 10 are
          pruned automatically).
        </p>
        <button onClick={handleCreate} disabled={creating} className="btn-primary px-3 py-1.5 text-sm">
          {creating ? "Backing up…" : "Backup now"}
        </button>
      </div>

      {backups.length === 0 ? (
        <p className="text-sm text-muted">No backups yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {backups.map((b) => (
            <li key={b.fileName} className="surface-row flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">{b.fileName}</span>
                <span className="text-xs text-muted">
                  {(b.sizeBytes / (1024 * 1024)).toFixed(1)} MB &middot;{" "}
                  {new Date(b.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`/api/backup/${encodeURIComponent(b.fileName)}`}
                  className="text-xs text-accent hover:underline"
                >
                  Download
                </a>
                <button
                  onClick={() => handleDelete(b.fileName)}
                  className="text-xs text-muted hover:text-red-600"
                >
                  Delete
                </button>
                <button
                  onClick={() => setRestoreTarget(b.fileName)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Restore from this
                </button>
              </div>
              {restoreTarget === b.fileName && (
                <div className="surface-row flex flex-col gap-2 border-red-600/30 bg-red-600/5">
                  <p className="font-medium text-red-700 dark:text-red-400">
                    This replaces ALL current data (matters, documents, users, everything) with
                    this backup. The current data isn&apos;t deleted — it&apos;s moved aside on
                    disk — but you must restart the app immediately after for the restore to take
                    effect.
                  </p>
                  <p>
                    Type <span className="font-mono">RESTORE</span> to confirm:
                  </p>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="surface-input"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestore(b.fileName)}
                      disabled={confirmText !== "RESTORE" || restoring}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {restoring ? "Restoring…" : "Restore now"}
                    </button>
                    <button
                      onClick={() => {
                        setRestoreTarget(null);
                        setConfirmText("");
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="surface-row flex flex-col gap-2 text-sm">
        <p className="font-medium">Restore from a file</p>
        <p className="text-muted">
          Browse to any backup <span className="font-mono">.tar.gz</span> file on this computer —
          one downloaded earlier, copied in from another machine, or from before a migration —
          not just the ones kept above.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".gz,.tar.gz,application/gzip"
          onChange={(e) => {
            setUploadFile(e.target.files?.[0] ?? null);
            setUploadConfirming(false);
            setUploadConfirmText("");
          }}
          className="text-sm"
        />
        {uploadFile && !uploadConfirming && (
          <button onClick={() => setUploadConfirming(true)} className="btn-secondary self-start text-xs">
            Restore from {uploadFile.name}
          </button>
        )}
        {uploadFile && uploadConfirming && (
          <div className="surface-row flex flex-col gap-2 border-red-600/30 bg-red-600/5">
            <p className="font-medium text-red-700 dark:text-red-400">
              This replaces ALL current data (matters, documents, users, everything) with the
              contents of {uploadFile.name}. The current data isn&apos;t deleted — it&apos;s moved
              aside on disk — but you must restart the app immediately after for the restore to
              take effect.
            </p>
            <p>
              Type <span className="font-mono">RESTORE</span> to confirm:
            </p>
            <input
              value={uploadConfirmText}
              onChange={(e) => setUploadConfirmText(e.target.value)}
              className="surface-input"
            />
            <div className="flex gap-2">
              <button
                onClick={handleRestoreUpload}
                disabled={uploadConfirmText !== "RESTORE" || uploading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {uploading ? "Restoring…" : "Restore now"}
              </button>
              <button
                onClick={() => {
                  setUploadConfirming(false);
                  setUploadConfirmText("");
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="surface-row flex flex-col gap-2 text-sm">
        <p className="font-medium">Automatic backups</p>
        <p className="text-muted">
          This app has no built-in background scheduler — set up an OS-level scheduled task
          hitting this endpoint with your own secret:
        </p>
        <code className="block overflow-x-auto rounded bg-black/[0.04] p-2 text-xs dark:bg-white/[0.06]">
          {cronCommand}
        </code>
        <p className="text-xs text-muted">
          macOS/Linux: add a line like the above (with a real interval, e.g. daily at 2am) to{" "}
          <code>crontab -e</code>. Windows: wrap it in a .bat/.ps1 script and schedule it with
          Task Scheduler.
        </p>
      </div>
    </div>
  );
}
