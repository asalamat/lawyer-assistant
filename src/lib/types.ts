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
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Document {
  id: string;
  matterId: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  storagePath: string;
  contentHash: string;
}

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
}

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
] as const;
export type DraftType = (typeof DRAFT_TYPES)[number];

export interface Draft {
  id: string;
  matterId: string;
  draftType: DraftType;
  content: string;
  createdAt: string;
}

export interface EvidenceMatrix {
  id: string;
  matterId: string;
  content: string;
  createdAt: string;
}

export interface IndependentReview {
  id: string;
  matterId: string;
  sourceType: "digest" | "evidence_matrix" | "chat_message";
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
