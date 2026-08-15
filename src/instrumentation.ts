// Runs once when a new Next.js server instance starts (dev or prod). Used
// here to start the automatic-backup interval (backupScheduler.ts) so
// hourly local+cloud backups work without the account owner having to set
// up an OS-level cron job — see Settings > Backup — the calendar reminder
// scheduler (notificationScheduler.ts), and the DocuSign envelope-status
// poller (docusignScheduler.ts) — this app has no public URL for DocuSign
// to call back to, so polling is the only way to learn when a client signs.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startBackupScheduler } = await import("./lib/backupScheduler");
  startBackupScheduler();
  const { startNotificationScheduler } = await import("./lib/notificationScheduler");
  startNotificationScheduler();
  const { startDocuSignScheduler } = await import("./lib/docusignScheduler");
  startDocuSignScheduler();
  const { startSmsScheduler } = await import("./lib/smsScheduler");
  startSmsScheduler();
  const { startStripePaymentScheduler } = await import("./lib/stripePaymentScheduler");
  startStripePaymentScheduler();
}
