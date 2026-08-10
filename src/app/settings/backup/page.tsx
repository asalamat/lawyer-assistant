import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listBackups } from "@/lib/backup";
import { getOAuthCredentialStatus } from "@/lib/emailIntegration";
import { listRcloneRemotes } from "@/lib/rcloneBackup";
import { getInstallPlan, isRcloneInstalled } from "@/lib/rcloneInstall";
import { getBackupScheduleStatus, getChangeBackupStatus, getCloudBackupStatus, getOrCreateCronSecret } from "@/lib/settings";
import BackupManager from "@/components/BackupManager";
import CloudBackupPanel from "@/components/CloudBackupPanel";
import SettingsSection from "@/components/SettingsSection";
import { BackupIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function BackupSettingsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/settings/security");

  const [
    backups,
    cronSecret,
    schedule,
    cloud,
    oauthCredentialStatus,
    rcloneRemotes,
    rcloneInstalled,
    rcloneInstallPlan,
    changeBackup,
  ] = await Promise.all([
    listBackups(),
    getOrCreateCronSecret(),
    getBackupScheduleStatus(),
    getCloudBackupStatus(),
    getOAuthCredentialStatus(),
    listRcloneRemotes(),
    isRcloneInstalled(),
    getInstallPlan(),
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
          initialOAuthConfigured={{ google: oauthCredentialStatus.google, microsoft: oauthCredentialStatus.microsoft }}
          initialRcloneRemotes={rcloneRemotes}
          initialRcloneInstalled={rcloneInstalled}
          initialRcloneInstallPlan={rcloneInstallPlan}
          initialChangeBackup={changeBackup}
        />
        <BackupManager initialBackups={backups} cronSecret={cronSecret} cloudConfigured={cloud.configured} />
      </div>
    </SettingsSection>
  );
}
