import { recordAuditEvent } from "./auditLog";
import { createAccessToken, markAccessTokenUsed } from "./clientAccess";
import db, { toPlain } from "./db";

// A fixed question set, not a configurable template builder — a firm-wide
// general intake form that every matter's questionnaire uses verbatim. The
// ids are stable storage keys: answersJson is keyed by them, so renaming or
// removing one orphans answers already collected under the old id.
export type IntakeQuestionType = "text" | "textarea" | "select";

export interface IntakeQuestion {
  id: string;
  label: string;
  type: IntakeQuestionType;
  options?: string[];
}

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  { id: "full_legal_name", label: "Your full legal name", type: "text" },
  {
    id: "preferred_contact_method",
    label: "Preferred way for us to contact you",
    type: "select",
    options: ["Email", "Phone call", "Text message", "Mail"],
  },
  { id: "phone", label: "Phone number", type: "text" },
  { id: "email", label: "Email address", type: "text" },
  { id: "mailing_address", label: "Mailing address", type: "textarea" },
  { id: "referral_source", label: "How did you hear about our firm?", type: "text" },
  {
    id: "matter_description",
    label: "In your own words, briefly describe your legal matter",
    type: "textarea",
  },
  {
    id: "previous_lawyer",
    label: "Have you previously retained another lawyer for this matter?",
    type: "select",
    options: ["No", "Yes"],
  },
  {
    id: "key_dates",
    label: "Any dates or deadlines you're aware of (court dates, filing deadlines, limitation periods)",
    type: "textarea",
  },
  {
    id: "documents_in_hand",
    label: "What documents do you already have in hand?",
    type: "textarea",
  },
];

export type IntakeStatus = "sent" | "completed";

export interface IntakeResponse {
  id: string;
  matterId: string;
  status: IntakeStatus;
  answersJson: string | null;
  clientName: string | null;
  clientEmail: string | null;
  createdAt: string;
  createdByUserId: string | null;
  sentAt: string | null;
  completedAt: string | null;
}

const QUESTION_IDS = new Set(INTAKE_QUESTIONS.map((question) => question.id));

export async function createAndSendIntake(
  matterId: string,
  createdByUserId: string | null,
): Promise<{ id: string; token: string }> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO intake_responses (id, matterId, status, answersJson, clientName, clientEmail, createdAt, createdByUserId, sentAt, completedAt) VALUES (?, ?, 'sent', NULL, NULL, NULL, ?, ?, ?, NULL)",
  ).run(id, matterId, now, createdByUserId, now);

  const token = createAccessToken("intake", matterId, id, createdByUserId);
  await recordAuditEvent(
    "intake_questionnaire_sent",
    matterId,
    "Issued a client intake questionnaire link",
  );
  return { id, token };
}

export async function listIntakeResponses(matterId: string): Promise<IntakeResponse[]> {
  return db
    .prepare("SELECT * FROM intake_responses WHERE matterId = ? ORDER BY createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<IntakeResponse>(row));
}

export async function getIntakeResponse(id: string): Promise<IntakeResponse | null> {
  const row = db.prepare("SELECT * FROM intake_responses WHERE id = ?").get(id);
  return row ? toPlain<IntakeResponse>(row) : null;
}

// Answers come back as a flat id -> string map so a question set change
// doesn't invalidate stored responses. Unknown ids are rejected rather than
// stored and ignored: a stored key that no question renders is invisible to
// staff, which is worse than telling the submitter their form is stale.
function validateAnswers(answers: unknown): Record<string, string> {
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    throw new Error("answers must be an object keyed by question id");
  }
  const validated: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (!QUESTION_IDS.has(key)) {
      throw new Error(`Unknown intake question "${key}"`);
    }
    if (typeof value !== "string") {
      throw new Error(`Answer for "${key}" must be text`);
    }
    validated[key] = value;
  }
  return validated;
}

export async function submitIntakeAnswers(
  id: string,
  input: { clientName: string; clientEmail?: string | null; answers: unknown },
): Promise<IntakeResponse> {
  const existing = await getIntakeResponse(id);
  if (!existing) {
    throw new Error("This intake questionnaire no longer exists.");
  }
  if (existing.status !== "sent") {
    throw new Error("This intake questionnaire has already been completed.");
  }

  const clientName = input.clientName.trim();
  if (!clientName) throw new Error("Your name is required");
  const clientEmail = input.clientEmail?.trim() || null;
  const answers = validateAnswers(input.answers);

  const completedAt = new Date().toISOString();
  db.prepare(
    "UPDATE intake_responses SET status = 'completed', answersJson = ?, clientName = ?, clientEmail = ?, completedAt = ? WHERE id = ?",
  ).run(JSON.stringify(answers), clientName, clientEmail, completedAt, id);

  // The submitter's token isn't passed down here (the route validated it
  // already) — it's looked up by the resource it was minted for, since
  // exactly one intake token is issued per response row.
  const tokenRow = db
    .prepare(
      "SELECT token FROM client_access_tokens WHERE purpose = 'intake' AND resourceId = ?",
    )
    .get(id) as { token: string } | undefined;
  if (tokenRow) markAccessTokenUsed(tokenRow.token);

  await recordAuditEvent(
    "intake_questionnaire_completed",
    existing.matterId,
    `${clientName} completed the intake questionnaire`,
  );

  const updated = await getIntakeResponse(id);
  if (!updated) throw new Error("This intake questionnaire no longer exists.");
  return updated;
}

export function parseIntakeAnswers(response: IntakeResponse): Record<string, string> | null {
  if (!response.answersJson) return null;
  return JSON.parse(response.answersJson) as Record<string, string>;
}
