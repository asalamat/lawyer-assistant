// Runs once when a new Next.js server instance starts (dev or prod). Used
// here to start the automatic-backup interval (backupScheduler.ts) so
// hourly local+cloud backups work without the account owner having to set
// up an OS-level cron job — see Settings > Backup — and to start the
// calendar reminder scheduler (notificationScheduler.ts).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startBackupScheduler } = await import("./lib/backupScheduler");
  startBackupScheduler();
  const { startNotificationScheduler } = await import("./lib/notificationScheduler");
  startNotificationScheduler();
}
