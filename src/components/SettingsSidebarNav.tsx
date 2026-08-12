"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AiIcon,
  BackupIcon,
  DeadlineIcon,
  EvidenceIcon,
  IntegrationIcon,
  MailIcon,
  MicIcon,
  MonitorIcon,
  PrivacyIcon,
  ReviewIcon,
  ScaleIcon,
  SecurityIcon,
  SignatureIcon,
  TemplateIcon,
  TranslateIcon,
  UpdateIcon,
  UsersIcon,
} from "./icons";

const LINKS = [
  { href: "/settings", label: "Appearance", Icon: MonitorIcon, adminOnly: false },
  { href: "/settings/ai", label: "AI model", Icon: AiIcon, adminOnly: true },
  { href: "/settings/transcription", label: "Transcription", Icon: MicIcon, adminOnly: true },
  { href: "/settings/review", label: "Independent review", Icon: ReviewIcon, adminOnly: true },
  { href: "/settings/legal-research", label: "Legal research", Icon: EvidenceIcon, adminOnly: true },
  { href: "/settings/deadline-rules", label: "Deadline rules", Icon: DeadlineIcon, adminOnly: true },
  { href: "/settings/document-templates", label: "Document templates", Icon: TemplateIcon, adminOnly: false },
  { href: "/settings/clause-library", label: "Clause library", Icon: ScaleIcon, adminOnly: false },
  { href: "/settings/translation", label: "Translation", Icon: TranslateIcon, adminOnly: false },
  { href: "/settings/privacy", label: "Privacy", Icon: PrivacyIcon, adminOnly: true },
  { href: "/settings/email", label: "Email", Icon: MailIcon, adminOnly: true },
  { href: "/settings/docusign", label: "DocuSign", Icon: SignatureIcon, adminOnly: true },
  { href: "/settings/integrations", label: "Integrations", Icon: IntegrationIcon, adminOnly: true },
  { href: "/settings/api-webhooks", label: "API & webhooks", Icon: IntegrationIcon, adminOnly: true },
  { href: "/settings/campaigns", label: "Marketing campaigns", Icon: MailIcon, adminOnly: true },
  { href: "/settings/users", label: "Users", Icon: UsersIcon, adminOnly: true },
  { href: "/settings/backup", label: "Backup", Icon: BackupIcon, adminOnly: true },
  { href: "/settings/security", label: "Security", Icon: SecurityIcon, adminOnly: false },
  { href: "/settings/updates", label: "Software updates", Icon: UpdateIcon, adminOnly: true },
];

export default function SettingsSidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const visibleLinks = LINKS.filter((link) => isAdmin || !link.adminOnly);

  return (
    <nav className="flex shrink-0 flex-col gap-1 sm:w-48">
      {visibleLinks.map(({ href, label, Icon }) => {
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
