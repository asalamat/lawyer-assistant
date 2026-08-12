import { getDocuSignStatus } from "@/lib/settings";
import DocuSignSettingsForm from "@/components/DocuSignSettingsForm";
import SettingsSection from "@/components/SettingsSection";
import { SignatureIcon } from "@/components/icons";

export default async function DocuSignSettingsPage() {
  const status = await getDocuSignStatus();

  return (
    <SettingsSection title="DocuSign" icon={SignatureIcon}>
      <DocuSignSettingsForm initialStatus={status} />
    </SettingsSection>
  );
}
