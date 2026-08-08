"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  AuditIcon,
  ChatIcon,
  DeadlineIcon,
  DigestIcon,
  DocumentIcon,
  DraftIcon,
  EvidenceIcon,
  IntakeIcon,
  MailIcon,
  NoteIcon,
  OverviewIcon,
  ScaleIcon,
  SecurityIcon,
  SignatureIcon,
  TimesheetIcon,
  TrustIcon,
  UsersIcon,
} from "./icons";

export default function MatterSidebarNav({ matterId }: { matterId: string }) {
  const pathname = usePathname();
  const base = `/matters/${matterId}`;

  const links = [
    { href: base, label: "Overview", Icon: OverviewIcon },
    { href: `${base}/notes`, label: "Notes", Icon: NoteIcon },
    { href: `${base}/parties`, label: "Parties", Icon: UsersIcon },
    { href: `${base}/intake`, label: "Intake", Icon: IntakeIcon },
    { href: `${base}/consent`, label: "Consent & signatures", Icon: SignatureIcon },
    { href: `${base}/digest`, label: "Digest", Icon: DigestIcon },
    { href: `${base}/deadlines`, label: "Deadlines", Icon: DeadlineIcon },
    { href: `${base}/evidence-matrix`, label: "Evidence matrix", Icon: EvidenceIcon },
    { href: `${base}/contradictions`, label: "Contradictions", Icon: EvidenceIcon },
    { href: `${base}/exhibit-list`, label: "Exhibit list", Icon: DocumentIcon },
    { href: `${base}/disclosure-checklist`, label: "Disclosure checklist", Icon: AuditIcon },
    { href: `${base}/crown-position`, label: "Crown position", Icon: ScaleIcon },
    { href: `${base}/privilege-review`, label: "Privilege & redaction", Icon: SecurityIcon },
    { href: `${base}/case-noteup`, label: "Case citations", Icon: ScaleIcon },
    { href: `${base}/drafts`, label: "Drafts", Icon: DraftIcon },
    { href: `${base}/timesheet`, label: "Timesheet", Icon: TimesheetIcon },
    { href: `${base}/trust`, label: "Trust", Icon: TrustIcon },
    { href: `${base}/email`, label: "Email", Icon: MailIcon },
    { href: `${base}/activity`, label: "Activity", Icon: ActivityIcon },
    { href: `${base}/chat`, label: "Chat", Icon: ChatIcon },
  ];

  return (
    <nav className="flex shrink-0 flex-col gap-1 sm:w-48">
      {links.map(({ href, label, Icon }) => {
        const active = href === base ? pathname === base : pathname.startsWith(href);
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
