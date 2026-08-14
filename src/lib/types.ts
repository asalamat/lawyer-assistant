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

// query is a JSON-encoded AnalyticsFilters object, not a plain string.
export interface SavedReport {
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

// Vision-model description of an image document's actual visual content —
// distinct from extractionStatus, which only covers OCR'd text. "pending"
// while a vision call is in flight (see analyzeDocumentPhoto in matters.ts).
export type PhotoAnalysisStatus = "pending" | "ok" | "failed";

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
  photoAnalysisStatus: PhotoAnalysisStatus | null;
  photoAnalysisResult: string | null;
  photoAnalysisError: string | null;
  photoAnalyzedAt: string | null;
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

export const DEADLINE_SOURCES = ["extracted", "rule-computed", "manual"] as const;
export type DeadlineSource = (typeof DEADLINE_SOURCES)[number];

export interface MatterDeadline {
  id: string;
  matterId: string;
  description: string;
  dueDate: string | null;
  sourceDocument: string | null;
  source: DeadlineSource;
  ruleId: string | null;
  triggerDate: string | null;
  calendarEventId: string | null;
  calendarProvider: string | null;
  createdAt: string;
}

// Ad-hoc calendar entry (meeting, reminder) — the other event source the
// native Calendar draws from, alongside MatterDeadline. matterId null
// means a firm-wide event not tied to a specific case.
export interface CalendarEvent {
  id: string;
  matterId: string | null;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  reminderDaysBefore: number | null;
  createdBy: string | null;
  createdAt: string;
}

// A single shape both MatterDeadline and CalendarEvent get normalized
// into for rendering on a calendar grid — the grid component doesn't need
// to know about the two different underlying sources.
export interface CalendarItem {
  id: string;
  kind: "deadline" | "event";
  title: string;
  date: string;
  endDate: string | null;
  matterId: string | null;
  matterTitle: string | null;
}

export type NotificationType = "deadline_reminder" | "event_reminder" | "deadline_overdue" | "document_signed";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  matterId: string | null;
  relatedType: "deadline" | "calendar_event" | "signable_document" | null;
  relatedId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  triggerStage: LeadStage;
  active: number;
  createdAt: string;
}

export interface CampaignStep {
  id: string;
  campaignId: string;
  stepOrder: number;
  delayDays: number;
  subject: string;
  body: string;
}

export interface CampaignEnrollment {
  id: string;
  campaignId: string;
  leadId: string;
  enrolledAt: string;
  nextStepIndex: number;
  nextSendAt: string | null;
  finishedAt: string | null;
}

// keyHash is never selected outside verifyApiKey() itself.
export interface ApiKey {
  id: string;
  label: string;
  createdByUserId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export const WEBHOOK_EVENT_TYPES = ["lead.created", "matter.created"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export interface WebhookSubscription {
  id: string;
  eventType: WebhookEventType;
  url: string;
  secret: string;
  active: number;
  createdAt: string;
}

export interface ClauseLibraryEntry {
  id: string;
  clauseType: string;
  preferredLanguage: string;
  fallbackLanguage: string | null;
  unacceptableLanguage: string | null;
  notes: string | null;
  createdAt: string;
}

export interface MatterTask {
  id: string;
  matterId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  assignedToUserId: string | null;
  completed: number;
  completedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export const DEADLINE_OFFSET_UNITS = ["calendar", "business"] as const;
export type DeadlineOffsetUnit = (typeof DEADLINE_OFFSET_UNITS)[number];

export const DEADLINE_DIRECTIONS = ["after", "before"] as const;
export type DeadlineDirection = (typeof DEADLINE_DIRECTIONS)[number];

export interface DeadlineRule {
  id: string;
  name: string;
  description: string | null;
  offsetDays: number;
  offsetUnit: DeadlineOffsetUnit;
  direction: DeadlineDirection;
  createdAt: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  recurringYearly: number;
  createdAt: string;
}

export const PORTAL_MESSAGE_SENDER_TYPES = ["staff", "client"] as const;
export type PortalMessageSenderType = (typeof PORTAL_MESSAGE_SENDER_TYPES)[number];

export interface PortalMessage {
  id: string;
  matterId: string;
  senderType: PortalMessageSenderType;
  senderUserId: string | null;
  content: string;
  createdAt: string;
  readAt: string | null;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  createdAt: string;
  createdByUserId: string | null;
}

export interface AssembledDocument {
  id: string;
  matterId: string;
  templateId: string;
  content: string;
  createdAt: string;
}

export const LEAD_STAGES = [
  "new",
  "contacted",
  "consultation_scheduled",
  "proposal_sent",
  "won",
  "lost",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: LeadStage;
  notes: string | null;
  assignedToUserId: string | null;
  createdAt: string;
  updatedAt: string;
  convertedMatterId: string | null;
  convertedAt: string | null;
}

export const FEATURE_REQUEST_STATUSES = ["new", "planned", "declined", "done"] as const;
export type FeatureRequestStatus = (typeof FEATURE_REQUEST_STATUSES)[number];

export interface FeatureRequest {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description: string | null;
  status: FeatureRequestStatus;
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
    | "privilege_review"
    | "redline_analysis"
    | "missing_evidence_report";
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
  userId: string | null;
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
  // Set once a client approval has been requested — see requestInvoiceApproval
  // in matters.ts and signableDocuments.ts for what this points at.
  signableDocumentId: string | null;
  // Sum of any disbursements included at invoice-creation time — kept
  // separate from `subtotal` (which stays strictly hours * hourlyRate, same
  // meaning it always had) rather than folded in, so existing callers that
  // only care about billable time aren't silently changed.
  disbursementsTotal: number;
}

export interface Disbursement {
  id: string;
  matterId: string;
  incurredOn: string;
  category: string;
  description: string;
  amount: number;
  receiptDocumentId: string | null;
  invoiceId: string | null;
  userId: string | null;
  createdAt: string;
}

export const EMAIL_PROVIDERS = ["google", "microsoft", "yahoo"] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

// oauth: connected via the provider's real login + consent screen, token
// stored. app_password: connected via IMAP with a per-app password
// generated from the account's own security settings — no developer app
// registration needed. Both are mail-only; this app's calendar is native
// (see calendar.ts), not tied to either connection method. Yahoo has no
// OAuth mail-read option at all (see emailIntegration.ts), so it's always
// "app_password".
export const EMAIL_AUTH_METHODS = ["oauth", "app_password"] as const;
export type EmailAuthMethod = (typeof EMAIL_AUTH_METHODS)[number];

export interface EmailAccount {
  id: string;
  provider: EmailProvider;
  emailAddress: string;
  connectedAt: string;
  calendarSyncEnabled: number;
  authMethod: EmailAuthMethod;
}

export interface EmailFolder {
  id: string;
  name: string;
}

export const STICKY_NOTE_COLORS = ["yellow", "pink", "blue", "green", "purple"] as const;
export type StickyNoteColor = (typeof STICKY_NOTE_COLORS)[number];

export interface StickyNote {
  id: string;
  pagePath: string;
  content: string;
  color: StickyNoteColor;
  // Pixel position on the page, viewport-relative. Null until the note has
  // ever been dragged — the client picks a default in that case.
  x: number | null;
  y: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrustAccount {
  id: string;
  name: string;
  bankName: string | null;
  accountLast4: string | null;
  createdAt: string;
}

export const TRUST_TRANSACTION_TYPES = ["deposit", "withdrawal", "transfer_to_operating"] as const;
export type TrustTransactionType = (typeof TRUST_TRANSACTION_TYPES)[number];

export interface TrustTransaction {
  id: string;
  trustAccountId: string;
  matterId: string;
  type: TrustTransactionType;
  amount: number;
  description: string;
  transactionDate: string;
  createdByUserId: string | null;
  createdAt: string;
}

export interface TrustReconciliation {
  id: string;
  trustAccountId: string;
  statementDate: string;
  bankBalance: number;
  ledgerBalance: number;
  variance: number;
  reconciledByUserId: string | null;
  createdAt: string;
}
