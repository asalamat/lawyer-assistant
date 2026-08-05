import { getDefaultTranslationLanguage } from "@/lib/settings";
import SettingsSection from "@/components/SettingsSection";
import TranslationLanguageForm from "@/components/TranslationLanguageForm";
import { TranslateIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function TranslationSettingsPage() {
  const language = await getDefaultTranslationLanguage();

  return (
    <SettingsSection
      title="Translation"
      description="Translate any AI-generated content — digests, evidence matrices, drafts, chat answers, independent reviews, and the smart email draft — into another language, using the same AI provider already configured (no separate translation service or API key needed)."
      icon={TranslateIcon}
    >
      <div className="surface-card">
        <TranslationLanguageForm initialLanguage={language} />
      </div>
    </SettingsSection>
  );
}
