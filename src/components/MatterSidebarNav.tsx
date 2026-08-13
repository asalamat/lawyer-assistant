"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  AuditIcon,
  CalendarIcon,
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
  TaskIcon,
  TemplateIcon,
  TimesheetIcon,
  TrustIcon,
  UsersIcon,
} from "./icons";

// Grouped by stage of the case-handling workflow rather than one long flat
// list — 27 links in a row was hard to scan. Overview stays outside any
// group since it's the entry point back to the matter, not a category
// member itself.
export default function MatterSidebarNav({ matterId }: { matterId: string }) {
  const pathname = usePathname();
  const base = `/matters/${matterId}`;

  const overview = { href: base, label: "Overview", Icon: OverviewIcon };

  const groups = [
    {
      label: "Client & intake",
      links: [
        { href: `${base}/notes`, label: "Notes", Icon: NoteIcon },
        { href: `${base}/parties`, label: "Parties", Icon: UsersIcon },
        { href: `${base}/intake`, label: "Intake", Icon: IntakeIcon },
        { href: `${base}/consent`, label: "Consent & signatures", Icon: SignatureIcon },
        { href: `${base}/messages`, label: "Client messages", Icon: ChatIcon },
        { href: `${base}/email`, label: "Email", Icon: MailIcon },
      ],
    },
    {
      label: "Schedule",
      links: [
        { href: `${base}/deadlines`, label: "Deadlines", Icon: DeadlineIcon },
        { href: `${base}/calendar`, label: "Calendar", Icon: CalendarIcon },
        { href: `${base}/tasks`, label: "Tasks", Icon: TaskIcon },
      ],
    },
    {
      label: "Case analysis",
      links: [
        { href: `${base}/digest`, label: "Digest", Icon: DigestIcon },
        { href: `${base}/evidence-matrix`, label: "Evidence matrix", Icon: EvidenceIcon },
        { href: `${base}/evidence-connections`, label: "Evidence connections", Icon: EvidenceIcon },
        { href: `${base}/contradictions`, label: "Contradictions", Icon: EvidenceIcon },
        { href: `${base}/missing-evidence`, label: "Missing evidence", Icon: AuditIcon },
        { href: `${base}/exhibit-list`, label: "Exhibit list", Icon: DocumentIcon },
        { href: `${base}/disclosure-checklist`, label: "Disclosure checklist", Icon: AuditIcon },
        { href: `${base}/crown-position`, label: "Crown position", Icon: ScaleIcon },
        { href: `${base}/privilege-review`, label: "Privilege & redaction", Icon: SecurityIcon },
        { href: `${base}/case-noteup`, label: "Case citations", Icon: ScaleIcon },
      ],
    },
    {
      label: "Drafting",
      links: [
        { href: `${base}/drafts`, label: "Drafts", Icon: DraftIcon },
        { href: `${base}/templates`, label: "Templates", Icon: TemplateIcon },
        { href: `${base}/redline`, label: "Redline", Icon: ScaleIcon },
      ],
    },
    {
      label: "Billing",
      links: [
        { href: `${base}/timesheet`, label: "Timesheet", Icon: TimesheetIcon },
        { href: `${base}/trust`, label: "Trust", Icon: TrustIcon },
      ],
    },
    {
      label: "Chat & history",
      links: [
        { href: `${base}/chat`, label: "Chat", Icon: ChatIcon },
        { href: `${base}/activity`, label: "Activity", Icon: ActivityIcon },
      ],
    },
  ];

  function isActive(href: string): boolean {
    return href === base ? pathname === base : pathname.startsWith(href);
  }

  function renderLink({ href, label, Icon }: { href: string; label: string; Icon: typeof OverviewIcon }) {
    const active = isActive(href);
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
  }

  return (
    <nav className="flex shrink-0 flex-col gap-4 sm:w-52">
      {renderLink(overview)}
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 text-xs font-bold uppercase tracking-wide text-accent">{group.label}</p>
          {group.links.map(renderLink)}
        </div>
      ))}
    </nav>
  );
}
