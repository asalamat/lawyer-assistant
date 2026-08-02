import { getAppVersion } from "@/lib/systemInfo";
import UpdateChecker from "@/components/UpdateChecker";
import SettingsSection from "@/components/SettingsSection";
import { UpdateIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function UpdatesSettingsPage() {
  const version = await getAppVersion();

  return (
    <SettingsSection title="Software updates" icon={UpdateIcon}>
      <p className="text-sm text-muted">
        Version {version.appVersion}
        {version.gitCommit && ` (${version.gitCommit.shortSha})`}
      </p>
      <UpdateChecker />
    </SettingsSection>
  );
}
