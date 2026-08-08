import { listDocumentTemplates } from "@/lib/documentTemplates";
import { TemplateIcon } from "@/components/icons";
import DocumentTemplatesPanel from "@/components/DocumentTemplatesPanel";
import SettingsSection from "@/components/SettingsSection";

export const dynamic = "force-dynamic";

export default async function DocumentTemplatesSettingsPage() {
  const templates = await listDocumentTemplates();

  return (
    <SettingsSection
      title="Document templates"
      description="Reusable templates for routine documents — write the text once with {{field}} placeholders, then generate a filled-in copy for any matter in seconds. matter.title, matter.fileNumber, matter.matterType, matter.clientName, client.email, client.phone, today, and lawyerName fill in automatically; anything else is a custom field you type in when generating."
      icon={TemplateIcon}
    >
      <DocumentTemplatesPanel initialTemplates={templates} />
    </SettingsSection>
  );
}
