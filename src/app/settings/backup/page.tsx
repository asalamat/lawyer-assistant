import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listBackups } from "@/lib/backup";
import { getOrCreateCronSecret } from "@/lib/settings";
import BackupManager from "@/components/BackupManager";
import SettingsSection from "@/components/SettingsSection";
import { BackupIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function BackupSettingsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/settings/security");

  const backups = await listBackups();
  const cronSecret = await getOrCreateCronSecret();

  return (
    <SettingsSection
      title="Backup & restore"
      description="Back up the entire app — matters, documents, clients, users, settings — into one file, and restore from it if needed."
      icon={BackupIcon}
    >
      <BackupManager initialBackups={backups} cronSecret={cronSecret} />
    </SettingsSection>
  );
}
