import Link from "next/link";
import HealthIndicator from "./HealthIndicator";
import LogoutButton from "./LogoutButton";
import ThemeToggle from "./ThemeToggle";
import WeatherDisplay from "./WeatherDisplay";
import {
  AuditIcon,
  DashboardIcon,
  HelpIcon,
  MattersIcon,
  SearchIcon,
  SettingsIcon,
} from "./icons";

const LINKS = [
  { href: "/", label: "Dashboard", Icon: DashboardIcon },
  { href: "/matters", label: "Matters", Icon: MattersIcon },
  { href: "/audit", label: "Audit log", Icon: AuditIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
  { href: "/help", label: "Help", Icon: HelpIcon },
];

export default function Nav() {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="font-display text-lg italic tracking-tight">Lawyer Assistant</span>
          <ul className="flex gap-5 text-sm">
            {LINKS.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-1.5 text-foreground/80 transition-colors hover:text-accent"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-4">
          <HealthIndicator />
          <WeatherDisplay />
          <Link
            href="/search"
            aria-label="Search"
            title="Search everything"
            className="text-foreground/80 transition-colors hover:text-accent"
          >
            <SearchIcon className="h-4 w-4" />
          </Link>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}
