import Link from "next/link";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/matters", label: "Matters" },
  { href: "/chat", label: "Chat" },
];

export default function Nav() {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-4">
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
      </nav>
    </header>
  );
}
