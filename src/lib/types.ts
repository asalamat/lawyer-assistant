export interface Matter {
  id: string;
  title: string;
  clientName: string;
  matterType: string;
  status: "open" | "closed";
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

export const EMAIL_PROVIDERS = ["google", "microsoft", "yahoo"] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

export interface EmailAccount {
  id: string;
  provider: EmailProvider;
  emailAddress: string;
  connectedAt: string;
}
