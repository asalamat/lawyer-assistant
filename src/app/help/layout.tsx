import { getAppVersion } from "@/lib/systemInfo";
import HelpSidebarNav from "@/components/HelpSidebarNav";

export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const version = await getAppVersion();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl italic">Help</h1>
        <p className="mt-1 text-sm text-muted">
          What this app can do today. Updated as features are added — if something
          you use isn&apos;t listed here, it&apos;s a documentation gap, not a hidden feature.
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <HelpSidebarNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <p className="text-xs text-muted">
        Version {version.appVersion}
        {version.gitCommit && ` (${version.gitCommit.shortSha})`}
      </p>
    </main>
  );
}
