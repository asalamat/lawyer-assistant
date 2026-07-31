import { getAnthropicApiKeyStatus } from "@/lib/settings";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import IntegrationsPanel from "@/components/IntegrationsPanel";
import SettingsForm from "@/components/SettingsForm";
import SettingsSection from "@/components/SettingsSection";
import TemperatureUnitToggle from "@/components/TemperatureUnitToggle";
import ThemeToggle from "@/components/ThemeToggle";
import UpdateChecker from "@/components/UpdateChecker";
import {
  AiIcon,
  IntegrationIcon,
  MonitorIcon,
  SecurityIcon,
  UpdateIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const status = await getAnthropicApiKeyStatus();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-10">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <SettingsSection title="Appearance" icon={MonitorIcon}>
        <div className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-sm">Theme</span>
            <ThemeToggle />
          </div>
          <TemperatureUnitToggle />
        </div>
      </SettingsSection>

      <SettingsSection
        title="AI model"
        description="Powers chat, digests, deadline extraction, drafting, and the evidence matrix."
        icon={AiIcon}
      >
        <SettingsForm initialStatus={status} />
      </SettingsSection>

      <SettingsSection
        title="Integrations"
        description="Connect an email account to bring matter-related correspondence into this app."
        icon={IntegrationIcon}
      >
        <IntegrationsPanel />
      </SettingsSection>

      <SettingsSection title="Security" icon={SecurityIcon}>
        <ChangePasswordForm />
      </SettingsSection>

      <SettingsSection title="Software updates" icon={UpdateIcon}>
        <UpdateChecker />
      </SettingsSection>
    </main>
  );
}
