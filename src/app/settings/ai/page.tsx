import { getAiProviderOrder, getAnthropicApiKeyStatus, getOpenaiApiKeyStatus } from "@/lib/settings";
import AiProviderOrder from "@/components/AiProviderOrder";
import SettingsForm from "@/components/SettingsForm";
import SettingsSection from "@/components/SettingsSection";
import { AiIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const status = await getAnthropicApiKeyStatus();
  const openaiStatus = await getOpenaiApiKeyStatus();
  const providerOrder = await getAiProviderOrder();

  return (
    <SettingsSection
      title="AI model"
      description="Powers chat, digests, deadline extraction, drafting, and the evidence matrix. Configure a second provider as a backup — if the primary fails, the app automatically falls through to it."
      icon={AiIcon}
    >
      <SettingsForm initialStatus={status} />
      <SettingsForm
        initialStatus={openaiStatus}
        title="OpenAI API key (backup provider)"
        placeholder="sk-..."
        apiPath="/api/settings/openai"
        bodyKey="openaiApiKey"
      />
      <AiProviderOrder initialOrder={providerOrder} />
    </SettingsSection>
  );
}
