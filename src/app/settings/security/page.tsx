import { getCurrentUser, isTotpEnabled } from "@/lib/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import MfaSettingsForm from "@/components/MfaSettingsForm";
import SettingsSection from "@/components/SettingsSection";
import { SecurityIcon } from "@/components/icons";

export default async function SecuritySettingsPage() {
  const user = await getCurrentUser();
  const mfaEnabled = user ? await isTotpEnabled(user.id) : false;

  return (
    <SettingsSection title="Security" icon={SecurityIcon}>
      <div className="flex flex-col gap-6">
        <ChangePasswordForm />
        <MfaSettingsForm initialEnabled={mfaEnabled} />
      </div>
    </SettingsSection>
  );
}
