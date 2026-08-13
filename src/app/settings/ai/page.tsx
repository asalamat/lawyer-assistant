import {
  DEFAULT_OLLAMA_BASE_URL,
  getAiProviderOrder,
  getAnthropicApiKeyStatus,
  getDeepseekApiKeyStatus,
  getGeminiApiKeyStatus,
  getIndependentReviewProviderOrder,
  getMoonshotApiKeyStatus,
  getOllamaConfig,
  getOpenaiApiKeyStatus,
  type IndependentReviewProvider,
} from "@/lib/settings";
import AiProviderMatrix from "@/components/AiProviderMatrix";
import OllamaSettingsForm from "@/components/OllamaSettingsForm";
import SettingsForm from "@/components/SettingsForm";
import SettingsSection from "@/components/SettingsSection";
import { AiIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const status = await getAnthropicApiKeyStatus();
  const openaiStatus = await getOpenaiApiKeyStatus();
  const geminiStatus = await getGeminiApiKeyStatus();
  const deepseekStatus = await getDeepseekApiKeyStatus();
  const moonshotStatus = await getMoonshotApiKeyStatus();
  const ollamaConfig = await getOllamaConfig();
  const primaryOrder = await getAiProviderOrder();
  const independentOrder = await getIndependentReviewProviderOrder();
  const configured: Record<IndependentReviewProvider, boolean> = {
    anthropic: status.configured,
    openai: openaiStatus.configured,
    gemini: geminiStatus.configured,
    ollama: Boolean(ollamaConfig),
    deepseek: deepseekStatus.configured,
    moonshot: moonshotStatus.configured,
  };

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
      <SettingsForm
        initialStatus={deepseekStatus}
        title="DeepSeek API key (independent review)"
        placeholder="sk-..."
        apiPath="/api/settings/deepseek"
        bodyKey="deepseekApiKey"
      />
      <SettingsForm
        initialStatus={moonshotStatus}
        title="Moonshot AI / Kimi API key (independent review)"
        placeholder="sk-..."
        apiPath="/api/settings/moonshot"
        bodyKey="moonshotApiKey"
      />
      <OllamaSettingsForm
        initialStatus={{
          configured: Boolean(ollamaConfig),
          baseUrl: ollamaConfig?.baseUrl ?? DEFAULT_OLLAMA_BASE_URL,
          model: ollamaConfig?.model ?? "",
        }}
      />
      <AiProviderMatrix
        initialPrimaryOrder={primaryOrder}
        initialIndependentOrder={independentOrder}
        initialSamePrimaryProvider={primaryOrder[0] === independentOrder[0]}
        configured={configured}
      />
    </SettingsSection>
  );
}
