import { getCurrentUser } from "@/lib/auth";
import SettingsSidebarNav from "@/components/SettingsSidebarNav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-3xl italic">Settings</h1>
      <div className="flex flex-col gap-6 sm:flex-row">
        <SettingsSidebarNav isAdmin={user?.role === "admin"} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
