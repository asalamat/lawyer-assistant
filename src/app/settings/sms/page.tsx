import { getTwilioStatus } from "@/lib/settings";
import SettingsSection from "@/components/SettingsSection";
import TwilioSettingsForm from "@/components/TwilioSettingsForm";
import { ChatIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function SmsSettingsPage() {
  const status = await getTwilioStatus();

  return (
    <SettingsSection
      title="SMS"
      description="Connect a Twilio account so staff can text clients directly from a matter. Replies are picked up automatically (checked every few minutes) and matched back to the client by phone number — this app has no public URL for Twilio to notify instantly, so a short delay on replies is expected."
      icon={ChatIcon}
    >
      <TwilioSettingsForm initialStatus={status} />
    </SettingsSection>
  );
}
