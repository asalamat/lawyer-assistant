"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AiIcon,
  EvidenceIcon,
  IntegrationIcon,
  MailIcon,
  MicIcon,
  MonitorIcon,
  ReviewIcon,
  SecurityIcon,
  UpdateIcon,
} from "./icons";

const LINKS = [
  { href: "/settings", label: "Appearance", Icon: MonitorIcon },
  { href: "/settings/ai", label: "AI model", Icon: AiIcon },
  { href: "/settings/transcription", label: "Transcription", Icon: MicIcon },
  { href: "/settings/review", label: "Independent review", Icon: ReviewIcon },
  { href: "/settings/legal-research", label: "Legal research", Icon: EvidenceIcon },
  { href: "/settings/email", label: "Email", Icon: MailIcon },
  { href: "/settings/integrations", label: "Integrations", Icon: IntegrationIcon },
  { href: "/settings/security", label: "Security", Icon: SecurityIcon },
  { href: "/settings/updates", label: "Software updates", Icon: UpdateIcon },
];

export default function SettingsSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 flex-col gap-1 sm:w-48">
      {LINKS.map(({ href, label, Icon }) => {
        const active = href === "/settings" ? pathname === "/settings" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? "flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent"
                : "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
