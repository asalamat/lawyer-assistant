// Seeds a starting checklist when a new matter is opened, keyed by
// matterType. matterType itself stays free-text (see createMatter/db.ts) —
// this is deliberately a fuzzy, case-insensitive match with a "no template
// matched" fallback, not a required enum, so existing matters and any
// matterType a firm types are never blocked or broken by this feature.
export interface TaskTemplateItem {
  title: string;
  // Days from matter creation, not a fixed date — the actual due date is
  // computed at seed time from the matter's createdAt.
  dueOffsetDays?: number;
}

export const TASK_TEMPLATES: Record<string, TaskTemplateItem[]> = {
  "criminal defence": [
    { title: "Request initial disclosure from Crown", dueOffsetDays: 3 },
    { title: "Confirm next court date and calendar it" },
    { title: "Review disclosure for missing items", dueOffsetDays: 14 },
    { title: "Interview client about the incident", dueOffsetDays: 7 },
    { title: "Check for a bail/release condition review" },
  ],
  "criminal law": [
    { title: "Request initial disclosure from Crown", dueOffsetDays: 3 },
    { title: "Confirm next court date and calendar it" },
    { title: "Review disclosure for missing items", dueOffsetDays: 14 },
    { title: "Interview client about the incident", dueOffsetDays: 7 },
    { title: "Check for a bail/release condition review" },
  ],
  family: [
    { title: "Send client intake questionnaire" },
    { title: "Request financial disclosure documents", dueOffsetDays: 7 },
    { title: "Check for any urgent parenting/support issues" },
    { title: "Confirm service of any filed documents", dueOffsetDays: 10 },
  ],
  "personal injury": [
    { title: "Request medical records and treatment history", dueOffsetDays: 7 },
    { title: "Send letter of representation to insurer", dueOffsetDays: 3 },
    { title: "Calendar limitation period deadline" },
    { title: "Request accident/incident report", dueOffsetDays: 7 },
    { title: "Open a disbursement log for medical/expert costs" },
  ],
  "real estate": [
    { title: "Order title search", dueOffsetDays: 2 },
    { title: "Confirm closing date and calendar it" },
    { title: "Request mortgage payout statement", dueOffsetDays: 5 },
    { title: "Review agreement of purchase and sale for conditions" },
  ],
  "civil litigation": [
    { title: "Calendar limitation period deadline" },
    { title: "Draft and review statement of claim/defence", dueOffsetDays: 14 },
    { title: "Request relevant documents from client", dueOffsetDays: 7 },
    { title: "Check for any applicable notice requirements" },
  ],
  "wills and estates": [
    { title: "Send client intake questionnaire" },
    { title: "Confirm executor/beneficiary details" },
    { title: "Request asset and liability list", dueOffsetDays: 7 },
  ],
  corporate: [
    { title: "Request corporate minute book" },
    { title: "Confirm signing authorities and officers" },
    { title: "Review existing shareholder/partnership agreements", dueOffsetDays: 7 },
  ],
  immigration: [
    { title: "Confirm application type and deadline" },
    { title: "Request supporting documents from client", dueOffsetDays: 7 },
    { title: "Calendar any statutory response deadline" },
  ],
  traffic: [
    { title: "Confirm the offence notice/summons deadline and calendar it", dueOffsetDays: 2 },
    { title: "Request disclosure from the prosecutor's office", dueOffsetDays: 7 },
    { title: "Review the certificate of offence for defects (date, location, wording)" },
    { title: "Check whether a trial date has been set or needs requesting" },
  ],
  "provincial offences": [
    { title: "Confirm the offence notice/summons deadline and calendar it", dueOffsetDays: 2 },
    { title: "Request disclosure from the prosecutor's office", dueOffsetDays: 7 },
    { title: "Review the certificate of offence for defects (date, location, wording)" },
    { title: "Check whether a trial date has been set or needs requesting" },
  ],
  employment: [
    { title: "Request employment contract and any termination letter", dueOffsetDays: 5 },
    { title: "Calculate reasonable notice/statutory entitlements owing", dueOffsetDays: 7 },
    { title: "Confirm ROE and final pay were issued", dueOffsetDays: 7 },
    { title: "Check for an ESA complaint deadline" },
  ],
};

function normalize(matterType: string): string {
  return matterType.trim().toLowerCase();
}

// Exact match first, then a substring match in either direction — a
// matterType of "Family Law" or "Family" should both hit the "family"
// template without maintaining every phrasing as its own key.
export function findTaskTemplate(matterType: string): TaskTemplateItem[] | null {
  const key = normalize(matterType);
  if (!key) return null;
  if (TASK_TEMPLATES[key]) return TASK_TEMPLATES[key];
  const match = Object.keys(TASK_TEMPLATES).find((k) => key.includes(k) || k.includes(key));
  return match ? TASK_TEMPLATES[match] : null;
}
