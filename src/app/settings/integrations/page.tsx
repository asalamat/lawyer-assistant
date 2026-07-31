import IntegrationsPanel from "@/components/IntegrationsPanel";
import SettingsSection from "@/components/SettingsSection";
import { IntegrationIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default function IntegrationsSettingsPage() {
  return (
    <SettingsSection
      title="Integrations"
      description="Connect an email account to bring matter-related correspondence into this app."
      icon={IntegrationIcon}
    >
      <IntegrationsPanel />
    </SettingsSection>
  );
}
