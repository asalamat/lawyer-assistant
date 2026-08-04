"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { setSidebarCollapsed, useSidebarCollapsed } from "@/lib/useSidebarCollapsed";
import type { AppVersion } from "@/lib/systemInfo";
import HealthIndicator from "./HealthIndicator";
import LogoutButton from "./LogoutButton";
import {
  AuditIcon,
  DashboardIcon,
  HelpIcon,
  LibraryIcon,
  MattersIcon,
  PanelCollapseIcon,
  PanelExpandIcon,
  ScaleIcon,
  SearchIcon,
  SettingsIcon,
} from "./icons";

const LINKS = [
  { href: "/", label: "Dashboard", Icon: DashboardIcon },
  { href: "/matters", label: "Matters", Icon: MattersIcon },
  { href: "/reference-library", label: "Reference library", Icon: LibraryIcon },
  { href: "/audit", label: "Audit log", Icon: AuditIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
  { href: "/help", label: "Help", Icon: HelpIcon },
];

export default function AppSidebar({
  version,
  user,
}: {
  version: AppVersion;
  user: { name: string; role: string } | null;
}) {
  const pathname = usePathname();
  const collapsed = useSidebarCollapsed();

  return (
    <aside
      className={`flex w-full shrink-0 flex-col border-border bg-card/60 backdrop-blur sm:h-screen sm:sticky sm:top-0 sm:border-r ${
        collapsed ? "sm:w-[4.5rem]" : "sm:w-64"
      } border-b transition-[width] duration-200 sm:border-b-0`}
    >
      <div
        className={`flex items-center gap-2.5 px-5 py-5 ${collapsed ? "sm:justify-center sm:px-0" : ""}`}
      >
        <ScaleIcon className="h-5 w-5 shrink-0 text-accent" />
        {!collapsed && (
          <span className="font-display text-lg italic tracking-tight">Lawyer Assistant</span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {LINKS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`group relative flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors ${
                collapsed ? "justify-center px-0" : "px-3"
              } ${
                active
                  ? "bg-accent/[0.09] font-medium text-accent"
                  : "text-foreground/75 hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.05]"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 h-4 -translate-y-1/2 rounded-r-full bg-accent transition-opacity ${
                  active ? "w-[3px] opacity-100" : "w-[3px] opacity-0"
                }`}
              />
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 border-t border-border px-3 py-4">
        {user && !collapsed && (
          <p className="truncate px-1 text-xs text-muted" title={user.name}>
            Signed in as <span className="font-medium">{user.name}</span>
            {user.role === "admin" && " (admin)"}
          </p>
        )}
        <div
          className={`flex items-center gap-3 ${collapsed ? "flex-col" : "px-1"}`}
        >
          <HealthIndicator />
          <Link
            href="/search"
            aria-label="Search"
            title="Search everything"
            className="text-foreground/75 transition-colors hover:text-accent"
          >
            <SearchIcon className="h-4 w-4" />
          </Link>
        </div>

        <div className={`flex items-center ${collapsed ? "flex-col gap-3" : "justify-between"}`}>
          <LogoutButton iconOnly={collapsed} />
          <button
            onClick={() => setSidebarCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden shrink-0 text-foreground/60 transition-colors hover:text-accent sm:block"
          >
            {collapsed ? (
              <PanelExpandIcon className="h-4 w-4" />
            ) : (
              <PanelCollapseIcon className="h-4 w-4" />
            )}
          </button>
        </div>

        {!collapsed && (
          <p className="px-1 text-left text-xs text-muted">
            v{version.appVersion}
            {version.gitCommit && ` (${version.gitCommit.shortSha})`}
          </p>
        )}
      </div>
    </aside>
  );
}
