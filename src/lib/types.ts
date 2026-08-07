export type MatterClassification = "standard" | "privileged" | "highly-sensitive";

export interface Matter {
  id: string;
  fileNumber: string;
  title: string;
  clientName: string;
  clientEmail: string | null;
  clientId: string | null;
  matterType: string;
  status: "open" | "closed" | "archived";
  hourlyRate: number | null;
  classification: MatterClassification;
  legalHold: number;
  legalHoldReason: string | null;
  retentionDate: string | null;
  ethicalWall: number;
  createdAt: string;
}

export type ClientType = "individual" | "corporate" | "institutional";

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  // Who to actually contact at a corporate/institutional client — not
  // meaningful for an individual client, who IS the contact.
  contactPerson: string | null;
  registrationNumber: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
}

// Common party roles, offered as autocomplete suggestions on the parties
// form rather than as a closed set — real matters throw up roles no fixed
// list would cover ("adjuster", "translator", "estate trustee"), so role is
// stored as free text and only required to be non-empty.
export const PARTY_ROLE_SUGGESTIONS = [
  "Opposing party",
  "Opposing counsel",
  "Witness",
  "Expert witness",
  "Co-counsel",
  "Insurer",
  "Investigating officer",
  "Court",
  "Other",
] as const;

export interface Party {
  id: string;
  matterId: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
}

// One entry per matter linked to the matter being viewed — already resolved
// to the *other* matter's identifying fields, since a bare id is useless to
// display and the link is symmetric from the reader's point of view even
// though the stored row is directed.
export interface RelatedMatterLink {
  matterId: string;
  fileNumber: string;
  title: string;
  status: Matter["status"];
  note: string | null;
  createdAt: string;
}

export interface SavedSearch {
  id: string;
  userId: string;
  label: string;
  query: string;
  createdAt: string;
}

// extractionStatus is null until the first extraction attempt: "ok" (readable),
// "failed" (extractable in principle but the attempt errored/produced nothing —
// see extractionError), or "unsupported" (not a type this app tries to read).
export type ExtractionStatus = "ok" | "failed" | "unsupported";

export interface Document {
  id: string;
  matterId: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  storagePath: string;
  contentHash: string;
  extractionStatus: ExtractionStatus | null;
  extractionError: string | null;
  extractionCheckedAt: string | null;
  detectedLanguage: string | null;
  ocrConfidence: number | null;
  qualityScore: number | null;
  malwareScanStatus: MalwareScanStatus | null;
  malwareScanDetail: string | null;
  // Set when this document was an attachment on an imported email — points
  // at the email's own Document row (see emailImport.ts).
  parentDocumentId: string | null;
  // Whether this document is visible in the client portal (see
  // clientPortal.ts) — off by default, a lawyer has to opt each document in.
  sharedWithClient: number;
}

// A persistent client-portal login, distinct from staff users (see
// clientAuth.ts). Never carries password fields outside that module.
export interface ClientUser {
  id: string;
  clientId: string;
  email: string;
  mustChangePassword: number;
  active: number;
  createdAt: string;
}

export type MalwareScanStatus = "clean" | "infected" | "error" | "not_scanned";

// A shared, firm-wide document library (e.g. statutes, the Criminal Code,
// key case law PDFs) — not tied to one matter. Attached to individual
// matters via matter_reference_documents so a lawyer chooses which
// reference material is relevant to a given case, rather than every matter
// silently pulling in every uploaded reference document's full text.
export interface ReferenceDocument {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  storagePath: string;
  contentHash: string;
  approved: number;
  approvedBy: string | null;
  approvedAt: string | null;
  sensitivityFlag: string | null;
  extractionStatus: ExtractionStatus | null;
  extractionError: string | null;
  extractionCheckedAt: string | null;
  detectedLanguage: string | null;
  ocrConfidence: number | null;
  qualityScore: number | null;
  malwareScanStatus: MalwareScanStatus | null;
  malwareScanDetail: string | null;
  category: ReferenceDocumentCategory;
}

// The two shared tiers of the three-layer knowledge architecture — the
// firm's own precedents/know-how vs. third-party public legal authority
// (statutes, case law). Client-matter documents are the third tier and
// never appear here — they live in the `documents` table, matter-scoped.
export const REFERENCE_DOCUMENT_CATEGORIES = ["firm_knowledge", "public_authority"] as const;
export type ReferenceDocumentCategory = (typeof REFERENCE_DOCUMENT_CATEGORIES)[number];
export const REFERENCE_DOCUMENT_CATEGORY_LABELS: Record<ReferenceDocumentCategory, string> = {
  firm_knowledge: "Firm knowledge",
  public_authority: "Public legal authority",
};

// A CanLII legislation record being watched for changes. CanLII's API only
// exposes metadata + a part/section list, not the actual statute text, so
// "changed" means the repeal status, effective dates, or section structure
// differ from the last check — not that specific wording was amended.
export interface LegislationWatch {
  id: string;
  databaseId: string;
  legislationId: string;
  label: string;
  lastSnapshot: string | null;
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  matterId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  matterId: string | null;
  detail: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
}

export interface MatterDigest {
  id: string;
  matterId: string;
  content: string;
  createdAt: string;
}

export interface MessageFeedback {
  id: string;
  chatMessageId: string;
  rating: "up" | "down";
  createdAt: string;
}

export interface MatterNote {
  id: string;
  matterId: string;
  content: string;
  createdAt: string;
}

export interface MatterDeadline {
  id: string;
  matterId: string;
  description: string;
  dueDate: string | null;
  sourceDocument: string | null;
  createdAt: string;
}

export const DRAFT_TYPES = [
  "Research memo",
  "Demand letter",
  "Client correspondence",
  "Defence strategy memo",
  "Factum",
  "Motion materials",
  "Affidavit (first draft)",
  "Cross-examination outline",
  "Disclosure request",
] as const;
export type DraftType = (typeof DRAFT_TYPES)[number];

export interface Draft {
  id: string;
  matterId: string;
  draftType: DraftType;
  content: string;
  createdAt: string;
}

export interface AgentTraceStep {
  type: "tool_call" | "tool_result" | "revision" | "final";
  detail: string;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  matterId: string;
  kind: string;
  draftId: string | null;
  iterations: number;
  trace: AgentTraceStep[];
  createdAt: string;
}

export interface EvidenceMatrix {
  id: string;
  matterId: string;
  content: string;
  createdAt: string;
}

export interface CaseNoteupRef {
  title: string;
  citation: string;
}

export interface CaseNoteup {
  id: string;
  matterId: string;
  citation: string;
  databaseId: string;
  caseId: string;
  found: boolean;
  title: string | null;
  url: string | null;
  citedCases: CaseNoteupRef[];
  citingCases: CaseNoteupRef[];
  citedLegislations: CaseNoteupRef[];
  error: string | null;
  checkedAt: string;
}

export interface IndependentReview {
  id: string;
  matterId: string;
  sourceType:
    | "digest"
    | "evidence_matrix"
    | "chat_message"
    | "contradiction_analysis"
    | "exhibit_list"
    | "disclosure_checklist"
    | "crown_position_analysis"
    | "privilege_review";
  sourceId: string;
  content: string;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  matterId: string;
  workedOn: string;
  description: string;
  hours: number;
  rate: number | null;
  invoiceId: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  matterId: string;
  invoiceNumber: string;
  hourlyRate: number;
  hours: number;
  subtotal: number;
  discount: number;
  total: number;
  status: "unpaid" | "paid";
  paidAt: string | null;
  createdAt: string;
}

export const EMAIL_PROVIDERS = ["google", "microsoft", "yahoo"] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

export interface EmailAccount {
  id: string;
  provider: EmailProvider;
  emailAddress: string;
  connectedAt: string;
}

export interface EmailFolder {
  id: string;
  name: string;
}
