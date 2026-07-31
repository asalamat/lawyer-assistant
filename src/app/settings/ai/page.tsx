import { getAnthropicApiKeyStatus } from "@/lib/settings";
import SettingsForm from "@/components/SettingsForm";
import SettingsSection from "@/components/SettingsSection";
import { AiIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const status = await getAnthropicApiKeyStatus();

  return (
    <SettingsSection
      title="AI model"
      description="Powers chat, digests, deadline extraction, drafting, and the evidence matrix."
      icon={AiIcon}
    >
      <SettingsForm initialStatus={status} />
    </SettingsSection>
  );
}
