import { getOpenaiApiKeyStatus } from "@/lib/settings";
import SettingsForm from "@/components/SettingsForm";
import SettingsSection from "@/components/SettingsSection";
import { MicIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function TranscriptionSettingsPage() {
  const status = await getOpenaiApiKeyStatus();

  return (
    <SettingsSection
      title="Audio & video transcription"
      description="Recordings (client calls, hearing audio) uploaded as matter documents are transcribed with OpenAI Whisper and added to chat context. Supports .mp3/.mp4/.mpeg/.mpga/.m4a/.wav/.webm up to 25MB."
      icon={MicIcon}
    >
      <SettingsForm
        initialStatus={status}
        title="OpenAI API key"
        placeholder="sk-..."
        apiPath="/api/settings/openai"
        bodyKey="openaiApiKey"
      />
    </SettingsSection>
  );
}
