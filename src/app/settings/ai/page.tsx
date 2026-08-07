import {
  DEFAULT_OLLAMA_BASE_URL,
  getAiProviderOrder,
  getAnthropicApiKeyStatus,
  getGeminiApiKeyStatus,
  getOllamaConfig,
  getOpenaiApiKeyStatus,
} from "@/lib/settings";
import AiProviderOrder from "@/components/AiProviderOrder";
import OllamaSettingsForm from "@/components/OllamaSettingsForm";
import SettingsForm from "@/components/SettingsForm";
import SettingsSection from "@/components/SettingsSection";
import { AiIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const status = await getAnthropicApiKeyStatus();
  const openaiStatus = await getOpenaiApiKeyStatus();
  const geminiStatus = await getGeminiApiKeyStatus();
  const ollamaConfig = await getOllamaConfig();
  const providerOrder = await getAiProviderOrder();

  return (
    <SettingsSection
      title="AI model"
      description="Powers chat, digests, deadline extraction, drafting, and the evidence matrix. Configure additional providers as backups — if one fails, the app automatically falls through to the next one in the order below."
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
      <SettingsForm
        initialStatus={geminiStatus}
        title="Gemini API key (backup provider)"
        placeholder="AIza..."
        apiPath="/api/settings/gemini"
        bodyKey="geminiApiKey"
      />
      <OllamaSettingsForm
        initialStatus={{
          configured: Boolean(ollamaConfig),
          baseUrl: ollamaConfig?.baseUrl ?? DEFAULT_OLLAMA_BASE_URL,
          model: ollamaConfig?.model ?? "",
        }}
      />
      <AiProviderOrder initialOrder={providerOrder} />
    </SettingsSection>
  );
}
