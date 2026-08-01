import { getSmtpStatus } from "@/lib/settings";
import SettingsSection from "@/components/SettingsSection";
import SmtpSettingsForm from "@/components/SmtpSettingsForm";
import { MailIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function EmailSettingsPage() {
  const status = await getSmtpStatus();

  return (
    <SettingsSection
      title="Email (SMTP)"
      description="Configure an outgoing mail server so the app can send invoices to clients by email. For Gmail/Office 365 you'll typically need an app password rather than your normal login password."
      icon={MailIcon}
    >
      <SmtpSettingsForm initialStatus={status} />
    </SettingsSection>
  );
}
