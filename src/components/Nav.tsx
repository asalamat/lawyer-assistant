import Link from "next/link";
import LogoutButton from "./LogoutButton";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/matters", label: "Matters" },
  { href: "/audit", label: "Audit log" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Lawyer Assistant</span>
          <ul className="flex gap-4 text-sm">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <LogoutButton />
      </nav>
    </header>
  );
}
