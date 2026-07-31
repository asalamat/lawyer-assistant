import SettingsSection from "@/components/SettingsSection";
import TemperatureUnitToggle from "@/components/TemperatureUnitToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { MonitorIcon } from "@/components/icons";

export default function AppearanceSettingsPage() {
  return (
    <SettingsSection title="Appearance" icon={MonitorIcon}>
      <div className="surface-card flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm">Theme</span>
          <ThemeToggle />
        </div>
        <TemperatureUnitToggle />
      </div>
    </SettingsSection>
  );
}
