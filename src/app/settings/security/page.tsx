import { getCurrentUser, isTotpEnabled } from "@/lib/auth";
import { listCredentials } from "@/lib/webauthn";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import MfaSettingsForm from "@/components/MfaSettingsForm";
import PasskeySettingsForm from "@/components/PasskeySettingsForm";
import PushNotificationSettings from "@/components/PushNotificationSettings";
import SettingsSection from "@/components/SettingsSection";
import { SecurityIcon } from "@/components/icons";

export default async function SecuritySettingsPage() {
  const user = await getCurrentUser();
  const mfaEnabled = user ? await isTotpEnabled(user.id) : false;
  const passkeys = user ? await listCredentials(user.id) : [];

  return (
    <SettingsSection title="Security" icon={SecurityIcon}>
      <div className="flex flex-col gap-6">
        <ChangePasswordForm />
        <PasskeySettingsForm initialCredentials={passkeys} />
        <MfaSettingsForm initialEnabled={mfaEnabled} />
        <PushNotificationSettings />
      </div>
    </SettingsSection>
  );
}
