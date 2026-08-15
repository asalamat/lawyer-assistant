import SettingsSection from "@/components/SettingsSection";
import AppQrCode from "@/components/AppQrCode";
import { MonitorIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default function AppSettingsPage() {
  return (
    <SettingsSection
      title="App"
      description="This app can be installed like a native app on a phone, tablet, or desktop — no app store involved. Scan the code below with a phone to get there quickly."
      icon={MonitorIcon}
    >
      <AppQrCode />
    </SettingsSection>
  );
}
