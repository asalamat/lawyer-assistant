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

  const overview = {
    href: base,
    label: "Overview",
    Icon: OverviewIcon,
    tip: "Upload documents, see the document list, attach reference material, manage team and compliance",
  };

  const groups = [
    {
      label: "Client & intake",
      links: [
        { href: `${base}/notes`, label: "Notes", Icon: NoteIcon, tip: "Free-text notes and findings, included in the matter digest" },
        { href: `${base}/parties`, label: "Parties", Icon: UsersIcon, tip: "Opposing party, counsel, witnesses, experts — plus links to related matters" },
        { href: `${base}/intake`, label: "Intake", Icon: IntakeIcon, tip: "Send the client a no-login questionnaire link" },
        { href: `${base}/consent`, label: "Consent & signatures", Icon: SignatureIcon, tip: "Prepare and send retainers/waivers/consents for the client to sign" },
        { href: `${base}/messages`, label: "Client messages", Icon: ChatIcon, tip: "Two-way message thread with the client, visible in their portal too" },
        { href: `${base}/email`, label: "Email", Icon: MailIcon, tip: "Compose and send an email from this matter, with Smart draft" },
      ],
    },
    {
      label: "Schedule",
      links: [
        { href: `${base}/deadlines`, label: "Deadlines", Icon: DeadlineIcon, tip: "AI-extracted and rule-computed deadlines, court dates, limitation periods" },
        { href: `${base}/calendar`, label: "Calendar", Icon: CalendarIcon, tip: "This matter's deadlines and events on a calendar view" },
        { href: `${base}/tasks`, label: "Tasks", Icon: TaskIcon, tip: "A plain to-do checklist, separate from Deadlines" },
        { href: `${base}/requirements`, label: "Requirements", Icon: TaskIcon, tip: "A practice-area-specific checklist of documents/steps this kind of matter typically needs" },
      ],
    },
    {
      label: "Case analysis",
      links: [
        { href: `${base}/digest`, label: "Digest", Icon: DigestIcon, tip: "Executive summary: parties, key dates, facts, evidence, open questions" },
        { href: `${base}/evidence-matrix`, label: "Evidence matrix", Icon: EvidenceIcon, tip: "Allegations mapped to elements, supporting evidence, and gaps" },
        { href: `${base}/evidence-connections`, label: "Evidence connections", Icon: EvidenceIcon, tip: "How each document corroborates, contradicts, or is missing for an allegation" },
        { href: `${base}/contradictions`, label: "Contradictions", Icon: EvidenceIcon, tip: "Genuine inconsistencies across witness statements and documents" },
        { href: `${base}/witness-prep`, label: "Witness prep", Icon: UsersIcon, tip: "Suggested direct/cross-examination questions grounded in a witness's documented statements" },
        { href: `${base}/missing-evidence`, label: "Missing evidence", Icon: AuditIcon, tip: "Rolls up missing/gap items already flagged elsewhere in this matter" },
        { href: `${base}/exhibit-list`, label: "Exhibit list", Icon: DocumentIcon, tip: "A numbered exhibit list built from this matter's documents" },
        { href: `${base}/disclosure-checklist`, label: "Disclosure checklist", Icon: AuditIcon, tip: "What's disclosed vs. what the documents reference as existing" },
        { href: `${base}/crown-position`, label: "Crown position", Icon: ScaleIcon, tip: "Charges, elements, weaknesses, and plausible Crown positions" },
        { href: `${base}/privilege-review`, label: "Privilege & redaction", Icon: SecurityIcon, tip: "Flags privileged communications and sensitive personal information" },
        { href: `${base}/disclosure-package`, label: "Disclosure package", Icon: SecurityIcon, tip: "Per-passage redaction checklist and which documents are ready to disclose" },
        { href: `${base}/case-noteup`, label: "Case citations", Icon: ScaleIcon, tip: "Looks up cited case law on CanLII — real, findable, cited/citing cases" },
      ],
    },
    {
      label: "Drafting",
      links: [
        { href: `${base}/drafts`, label: "Drafts", Icon: DraftIcon, tip: "AI-generated first drafts — memos, letters, correspondence, strategy" },
        { href: `${base}/templates`, label: "Templates", Icon: TemplateIcon, tip: "Fill in a reusable template — retainer letters, form notices" },
        { href: `${base}/redline`, label: "Redline", Icon: ScaleIcon, tip: "Compare a contract against the firm's clause playbook" },
      ],
    },
    {
      label: "Billing",
      links: [
        { href: `${base}/timesheet`, label: "Timesheet", Icon: TimesheetIcon, tip: "Log time, generate invoices, track paid/unpaid" },
        { href: `${base}/trust`, label: "Trust", Icon: TrustIcon, tip: "Trust-fund deposits, withdrawals, transfers, and reconciliation" },
      ],
    },
    {
      label: "Chat & history",
      links: [
        { href: `${base}/chat`, label: "Chat", Icon: ChatIcon, tip: "Ask questions grounded in this matter's documents and notes" },
        { href: `${base}/activity`, label: "Activity", Icon: ActivityIcon, tip: "This matter's audit trail — who did what, and when" },
      ],
    },
  ];

  function isActive(href: string): boolean {
    return href === base ? pathname === base : pathname.startsWith(href);
  }

  function renderLink({
    href,
    label,
    Icon,
    tip,
  }: {
    href: string;
    label: string;
    Icon: typeof OverviewIcon;
    tip?: string;
  }) {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        title={tip}
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
