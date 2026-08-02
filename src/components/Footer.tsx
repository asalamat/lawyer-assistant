import type { AppVersion } from "@/lib/systemInfo";

export default function Footer({ version }: { version: AppVersion }) {
  return (
    <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted">
      Lawyer Assistant v{version.appVersion}
      {version.gitCommit && ` (${version.gitCommit.shortSha})`}
    </footer>
  );
}
