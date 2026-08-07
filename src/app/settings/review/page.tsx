import { getOpenaiApiKeyStatus } from "@/lib/settings";
import SettingsForm from "@/components/SettingsForm";
import SettingsSection from "@/components/SettingsSection";
import { ReviewIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ReviewSettingsPage() {
  const status = await getOpenaiApiKeyStatus();

  return (
    <SettingsSection
      title="Independent AI review"
      description="Get a second opinion from OpenAI on a generated matter digest or evidence matrix, to catch blind spots a single model might share with itself."
      icon={ReviewIcon}
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
