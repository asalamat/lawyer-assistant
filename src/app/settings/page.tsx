import { getWeatherLocation } from "@/lib/settings";
import SettingsSection from "@/components/SettingsSection";
import TemperatureUnitToggle from "@/components/TemperatureUnitToggle";
import ThemeToggle from "@/components/ThemeToggle";
import WeatherLocationForm from "@/components/WeatherLocationForm";
import { MonitorIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AppearanceSettingsPage() {
  const location = (await getWeatherLocation()) ?? null;

  return (
    <SettingsSection title="Appearance" icon={MonitorIcon}>
      <div className="surface-card flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm">Theme</span>
          <ThemeToggle />
        </div>
        <TemperatureUnitToggle />
        <WeatherLocationForm initialLocation={location} />
      </div>
    </SettingsSection>
  );
}
