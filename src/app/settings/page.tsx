import { getAnthropicApiKeyStatus, getGeminiApiKeyStatus, getOpenaiApiKeyStatus } from "@/lib/settings";
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
  const openaiStatus = await getOpenaiApiKeyStatus();
  const geminiStatus = await getGeminiApiKeyStatus();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-10">
      <h1 className="font-display text-3xl italic">Settings</h1>

      <SettingsSection title="Appearance" icon={MonitorIcon}>
        <div className="surface-card flex flex-col gap-4">
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
        title="Audio &amp; video transcription"
        description="Recordings (client calls, hearing audio) uploaded as matter documents are transcribed with OpenAI Whisper and added to chat context. Supports .mp3/.mp4/.mpeg/.mpga/.m4a/.wav/.webm up to 25MB."
        icon={AiIcon}
      >
        <SettingsForm
          initialStatus={openaiStatus}
          title="OpenAI API key"
          placeholder="sk-..."
          apiPath="/api/settings/openai"
          bodyKey="openaiApiKey"
        />
      </SettingsSection>

      <SettingsSection
        title="Independent AI review"
        description="Get a second opinion from Google Gemini on a generated matter digest or evidence matrix, to catch blind spots a single model might share with itself."
        icon={AiIcon}
      >
        <SettingsForm
          initialStatus={geminiStatus}
          title="Gemini API key"
          placeholder="AIza..."
          apiPath="/api/settings/gemini"
          bodyKey="geminiApiKey"
        />
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
