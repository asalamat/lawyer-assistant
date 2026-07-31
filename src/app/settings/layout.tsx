import SettingsSidebarNav from "@/components/SettingsSidebarNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-3xl italic">Settings</h1>
      <div className="flex flex-col gap-6 sm:flex-row">
        <SettingsSidebarNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
