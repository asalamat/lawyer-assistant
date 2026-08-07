import { getPiiMaskingSettings, getMalwareScanningEnabled } from "@/lib/settings";
import { isMalwareScanningAvailable } from "@/lib/malwareScan";
import SettingsSection from "@/components/SettingsSection";
import MalwareScanSettingsForm from "@/components/MalwareScanSettingsForm";
import PiiMaskingSettingsForm from "@/components/PiiMaskingSettingsForm";
import { PrivacyIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function PrivacySettingsPage() {
  const settings = await getPiiMaskingSettings();
  const malwareScanEnabled = await getMalwareScanningEnabled();
  const malwareScanAvailable = await isMalwareScanningAvailable();

  return (
    <SettingsSection
      title="Privacy"
      description="Firm-wide setting — applies to every user and every matter, not a personal preference."
      icon={PrivacyIcon}
    >
      <div className="surface-card">
        <PiiMaskingSettingsForm initialSettings={settings} />
      </div>
      <MalwareScanSettingsForm initialEnabled={malwareScanEnabled} initialAvailable={malwareScanAvailable} />
    </SettingsSection>
  );
}
