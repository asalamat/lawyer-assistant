import Link from "next/link";
import LogoutButton from "./LogoutButton";
import ThemeToggle from "./ThemeToggle";
import { AuditIcon, DashboardIcon, HelpIcon, MattersIcon, SettingsIcon } from "./icons";

const LINKS = [
  { href: "/", label: "Dashboard", Icon: DashboardIcon },
  { href: "/matters", label: "Matters", Icon: MattersIcon },
  { href: "/audit", label: "Audit log", Icon: AuditIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
  { href: "/help", label: "Help", Icon: HelpIcon },
];

export default function Nav() {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Lawyer Assistant</span>
          <ul className="flex gap-4 text-sm">
            {LINKS.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link href={href} className="flex items-center gap-1.5 hover:underline">
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}
