"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HELP_SECTIONS } from "@/lib/helpContent";

export default function HelpSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 flex-col gap-4 sm:w-56">
      {HELP_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-muted">
            {section.title}
          </p>
          <div className="flex flex-col gap-1">
            {section.items.map((item) => {
              const href = `/help/${item.slug}`;
              const active = pathname === href;
              return (
                <Link
                  key={item.slug}
                  href={href}
                  className={
                    active
                      ? "rounded-lg bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent"
                      : "rounded-lg px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
