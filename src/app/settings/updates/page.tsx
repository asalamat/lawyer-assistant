import UpdateChecker from "@/components/UpdateChecker";
import SettingsSection from "@/components/SettingsSection";
import { UpdateIcon } from "@/components/icons";

export default function UpdatesSettingsPage() {
  return (
    <SettingsSection title="Software updates" icon={UpdateIcon}>
      <UpdateChecker />
    </SettingsSection>
  );
}
