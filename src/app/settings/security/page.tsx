import ChangePasswordForm from "@/components/ChangePasswordForm";
import SettingsSection from "@/components/SettingsSection";
import { SecurityIcon } from "@/components/icons";

export default function SecuritySettingsPage() {
  return (
    <SettingsSection title="Security" icon={SecurityIcon}>
      <ChangePasswordForm />
    </SettingsSection>
  );
}
