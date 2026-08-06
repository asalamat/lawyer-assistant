import { getPiiMaskingSettings } from "@/lib/settings";
import SettingsSection from "@/components/SettingsSection";
import PiiMaskingSettingsForm from "@/components/PiiMaskingSettingsForm";
import { PrivacyIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function PrivacySettingsPage() {
  const settings = await getPiiMaskingSettings();

  return (
    <SettingsSection
      title="Privacy"
      description="Firm-wide setting — applies to every user and every matter, not a personal preference."
      icon={PrivacyIcon}
    >
      <div className="surface-card">
        <PiiMaskingSettingsForm initialSettings={settings} />
      </div>
    </SettingsSection>
  );
}
