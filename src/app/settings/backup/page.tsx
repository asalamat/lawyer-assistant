import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listBackups } from "@/lib/backup";
import { getDriveAppCredentialStatus } from "@/lib/driveOAuthApp";
import { getBackupScheduleStatus, getChangeBackupStatus, getCloudBackupStatus, getOrCreateCronSecret } from "@/lib/settings";
import BackupManager from "@/components/BackupManager";
import CloudBackupPanel from "@/components/CloudBackupPanel";
import SettingsSection from "@/components/SettingsSection";
import { BackupIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function BackupSettingsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/settings/security");

  const [backups, cronSecret, schedule, cloud, driveAppCredentialStatus, changeBackup] = await Promise.all([
    listBackups(),
    getOrCreateCronSecret(),
    getBackupScheduleStatus(),
    getCloudBackupStatus(),
    getDriveAppCredentialStatus(),
    getChangeBackupStatus(),
  ]);

  return (
    <SettingsSection
      title="Backup & restore"
      description="Back up the entire app — matters, documents, clients, users, settings — into one file, and restore from it if needed."
      icon={BackupIcon}
    >
      <div className="flex flex-col gap-6">
        <CloudBackupPanel
          initialSchedule={schedule}
          initialCloud={cloud}
          initialDriveAppConfigured={driveAppCredentialStatus}
          initialChangeBackup={changeBackup}
        />
        <BackupManager initialBackups={backups} cronSecret={cronSecret} cloudConfigured={cloud.configured} />
      </div>
    </SettingsSection>
  );
}
