import { createHash } from "crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

// Multiple Next.js build/dev worker processes can open this file at once.
// busy_timeout alone doesn't cover every race on a brand-new file — the
// WAL-mode switch itself and the initial schema creation can both throw
// SQLITE_BUSY immediately if another process is mid-initializing the same
// file. Retry each of those with a short synchronous backoff.
function isBusyError(err: unknown): boolean {
  const text = String(err) + String((err as { cause?: unknown })?.cause ?? "");
  return text.includes("database is locked") || text.includes("SQLITE_BUSY");
}

function execWithRetry(sql: string, attempts = 10): void {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      db.exec(sql);
      return;
    } catch (err) {
      if (!isBusyError(err) || attempt === attempts - 1) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (attempt + 1));
    }
  }
}

execWithRetry("PRAGMA journal_mode = WAL;");
execWithRetry("PRAGMA busy_timeout = 5000;");

execWithRetry(`
  CREATE TABLE IF NOT EXISTS matters (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    clientName TEXT NOT NULL,
    matterType TEXT NOT NULL,
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    fileName TEXT NOT NULL,
    sizeBytes INTEGER NOT NULL,
    uploadedAt TEXT NOT NULL,
    storagePath TEXT NOT NULL,
    contentHash TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    matterId TEXT,
    detail TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS matter_digests (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS message_feedback (
    id TEXT PRIMARY KEY,
    chatMessageId TEXT NOT NULL UNIQUE,
    rating TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (chatMessageId) REFERENCES chat_messages(id)
  );

  CREATE TABLE IF NOT EXISTS matter_deadlines (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    description TEXT NOT NULL,
    dueDate TEXT,
    sourceDocument TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    draftType TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS evidence_matrices (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS time_entries (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    workedOn TEXT NOT NULL,
    description TEXT NOT NULL,
    hours REAL NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS email_accounts (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL UNIQUE,
    emailAddress TEXT NOT NULL,
    accessToken TEXT NOT NULL,
    refreshToken TEXT,
    tokenExpiresAt TEXT,
    connectedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS independent_reviews (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    sourceType TEXT NOT NULL,
    sourceId TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    invoiceNumber TEXT NOT NULL,
    hourlyRate REAL NOT NULL,
    hours REAL NOT NULL,
    subtotal REAL NOT NULL,
    discount REAL NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL,
    paidAt TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  -- Trust (IOLTA-style) accounting. Matter and account balances are never
  -- stored denormalized — always SUM'd from trust_transactions in the lib
  -- layer, so a balance can't drift out of sync with its own ledger.
  CREATE TABLE IF NOT EXISTS trust_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bankName TEXT,
    accountLast4 TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trust_transactions (
    id TEXT PRIMARY KEY,
    trustAccountId TEXT NOT NULL,
    matterId TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    transactionDate TEXT NOT NULL,
    createdByUserId TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (trustAccountId) REFERENCES trust_accounts(id),
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );
  CREATE INDEX IF NOT EXISTS idx_trust_transactions_matterId ON trust_transactions(matterId);
  CREATE INDEX IF NOT EXISTS idx_trust_transactions_trustAccountId ON trust_transactions(trustAccountId);

  -- A permanent record every time someone reconciles an account against a
  -- bank statement — kept even after the fact, since "we reconciled on this
  -- date and it matched" is itself the bar-audit evidence, not just a
  -- transient UI state.
  CREATE TABLE IF NOT EXISTS trust_reconciliations (
    id TEXT PRIMARY KEY,
    trustAccountId TEXT NOT NULL,
    statementDate TEXT NOT NULL,
    bankBalance REAL NOT NULL,
    ledgerBalance REAL NOT NULL,
    variance REAL NOT NULL,
    reconciledByUserId TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (trustAccountId) REFERENCES trust_accounts(id)
  );
  CREATE INDEX IF NOT EXISTS idx_trust_reconciliations_trustAccountId ON trust_reconciliations(trustAccountId);

  -- Firm-editable deadline rule library — there's no licensed court-rules
  -- database in this stack (that's what LawToolBox sells as its core
  -- product), so the firm defines its own reusable rules ("21 days after
  -- service, business days") instead of us shipping an authoritative,
  -- unmaintainable jurisdiction database.
  CREATE TABLE IF NOT EXISTS deadline_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    offsetDays INTEGER NOT NULL,
    offsetUnit TEXT NOT NULL,
    direction TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    recurringYearly INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS matter_notes (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS reference_documents (
    id TEXT PRIMARY KEY,
    fileName TEXT NOT NULL,
    sizeBytes INTEGER NOT NULL,
    uploadedAt TEXT NOT NULL,
    storagePath TEXT NOT NULL,
    contentHash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS matter_reference_documents (
    matterId TEXT NOT NULL,
    referenceDocumentId TEXT NOT NULL,
    attachedAt TEXT NOT NULL,
    PRIMARY KEY (matterId, referenceDocumentId),
    FOREIGN KEY (matterId) REFERENCES matters(id),
    FOREIGN KEY (referenceDocumentId) REFERENCES reference_documents(id)
  );

  CREATE TABLE IF NOT EXISTS legislation_watches (
    id TEXT PRIMARY KEY,
    databaseId TEXT NOT NULL,
    legislationId TEXT NOT NULL,
    label TEXT NOT NULL,
    lastSnapshot TEXT,
    lastCheckedAt TEXT,
    lastChangedAt TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    passwordSalt TEXT NOT NULL,
    mustChangePassword INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    tokenHash TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  -- A persistent client-portal account, distinct from the staff users
  -- table — a different identity realm with its own login/session (see
  -- clientAuth.ts), not another role on the staff side. One account per
  -- client for now (the client entity itself logs in, not a named contact).
  CREATE TABLE IF NOT EXISTS client_users (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    passwordSalt TEXT NOT NULL,
    mustChangePassword INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (clientId) REFERENCES clients(id)
  );
  CREATE INDEX IF NOT EXISTS idx_client_users_clientId ON client_users(clientId);

  -- In-app messaging between staff and a client's portal account — an
  -- actual two-way thread, not the one-directional document-sharing the
  -- portal launched with. No real SMS/texting integration (that needs a
  -- Twilio-like account this firm doesn't have yet) — in-app only.
  CREATE TABLE IF NOT EXISTS portal_messages (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    senderType TEXT NOT NULL,
    senderUserId TEXT,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    readAt TEXT,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );
  CREATE INDEX IF NOT EXISTS idx_portal_messages_matterId ON portal_messages(matterId);

  -- Merge-field document templates ("{{matter.title}}") authored directly
  -- in-app as markdown/text, not real uploaded .docx files — reuses the
  -- same rendering/export pipeline every other generated document already
  -- has instead of adding a docx-templating dependency for less benefit.
  CREATE TABLE IF NOT EXISTS document_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    createdByUserId TEXT
  );

  -- templateId is deliberately NOT a hard foreign key — content is a fully
  -- rendered, self-contained snapshot at generation time, so a generated
  -- document stays valid (and viewable) even after its template is edited
  -- or deleted; templateId is just informational lineage, not something
  -- deleting a template should be blocked by.
  CREATE TABLE IF NOT EXISTS assembled_documents (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    templateId TEXT,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );
  CREATE INDEX IF NOT EXISTS idx_assembled_documents_matterId ON assembled_documents(matterId);

  -- Pre-matter prospective-client tracking — the intake questionnaire and
  -- everything else in this app assumes a matter already exists; this is
  -- the layer before that. convertedMatterId is a soft reference for the
  -- same reason assembled_documents.templateId is — a lead's own record
  -- should stay intact even if the matter it became is later deleted.
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    source TEXT,
    stage TEXT NOT NULL DEFAULT 'new',
    notes TEXT,
    assignedToUserId TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    convertedMatterId TEXT,
    convertedAt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);

  CREATE TABLE IF NOT EXISTS client_sessions (
    tokenHash TEXT PRIMARY KEY,
    clientUserId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY (clientUserId) REFERENCES client_users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_client_sessions_clientUserId ON client_sessions(clientUserId);

  -- A personal, freeform note pinned to a specific page (keyed by its raw
  -- pathname, e.g. "/matters/abc123/digest") — private to the user who
  -- wrote it, never shown to anyone else. Multiple notes per page, like
  -- real sticky notes on a monitor.
  CREATE TABLE IF NOT EXISTS sticky_notes (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    pagePath TEXT NOT NULL,
    content TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'yellow',
    x REAL,
    y REAL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_sticky_notes_user_page ON sticky_notes(userId, pagePath);

  -- Issued once a password has already been verified but MFA is still
  -- outstanding — a real session is only ever created after the TOTP/backup
  -- code check passes. Short-lived (see createPendingMfaToken), single-use.
  CREATE TABLE IF NOT EXISTS pending_mfa (
    tokenHash TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS saved_searches (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    label TEXT NOT NULL,
    query TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_saved_searches_userId ON saved_searches(userId);

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);

  -- Full transparency trace for agentic (tool-calling loop) features, not
  -- just the one-shot generations everything else in this app uses. Kept
  -- as a single JSON blob rather than a normalized steps table since a
  -- trace is only ever displayed whole, never queried by step.
  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    kind TEXT NOT NULL,
    draftId TEXT,
    iterations INTEGER NOT NULL,
    traceJson TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_agent_runs_draftId ON agent_runs(draftId);

  CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    documentId TEXT,
    referenceDocumentId TEXT,
    matterId TEXT,
    fileName TEXT NOT NULL,
    pageNumber INTEGER,
    chunkIndex INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_document_chunks_documentId ON document_chunks(documentId);
  CREATE INDEX IF NOT EXISTS idx_document_chunks_referenceDocumentId ON document_chunks(referenceDocumentId);
  CREATE INDEX IF NOT EXISTS idx_document_chunks_matterId ON document_chunks(matterId);
  CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
  CREATE INDEX IF NOT EXISTS idx_matter_notes_matterId ON matter_notes(matterId);
  CREATE INDEX IF NOT EXISTS idx_reference_documents_contentHash ON reference_documents(contentHash);
  CREATE INDEX IF NOT EXISTS idx_matter_reference_documents_matterId ON matter_reference_documents(matterId);
  CREATE INDEX IF NOT EXISTS idx_matter_reference_documents_refId ON matter_reference_documents(referenceDocumentId);
  CREATE INDEX IF NOT EXISTS idx_documents_matterId ON documents(matterId);
  CREATE INDEX IF NOT EXISTS idx_documents_contentHash ON documents(matterId, contentHash);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_matterId ON chat_messages(matterId);
  CREATE INDEX IF NOT EXISTS idx_matter_digests_matterId ON matter_digests(matterId);
  CREATE INDEX IF NOT EXISTS idx_matter_deadlines_matterId ON matter_deadlines(matterId);
  CREATE INDEX IF NOT EXISTS idx_drafts_matterId ON drafts(matterId);
  CREATE INDEX IF NOT EXISTS idx_evidence_matrices_matterId ON evidence_matrices(matterId);
  CREATE INDEX IF NOT EXISTS idx_time_entries_matterId ON time_entries(matterId);
  CREATE INDEX IF NOT EXISTS idx_independent_reviews_matterId ON independent_reviews(matterId);
  CREATE INDEX IF NOT EXISTS idx_invoices_matterId ON invoices(matterId);

  -- Single-purpose, no-login links handed to a client (to sign a document or
  -- fill out an intake questionnaire). Deliberately not a client portal/account
  -- system: each token is scoped to exactly one resource and expires.
  CREATE TABLE IF NOT EXISTS client_access_tokens (
    token TEXT PRIMARY KEY,
    purpose TEXT NOT NULL,
    matterId TEXT NOT NULL,
    resourceId TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    usedAt TEXT,
    revokedAt TEXT,
    createdAt TEXT NOT NULL,
    createdByUserId TEXT,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE INDEX IF NOT EXISTS idx_client_access_tokens_resourceId ON client_access_tokens(resourceId);

  -- Retainer agreements / conflict waivers / privacy consent / custom
  -- documents that need a client signature. status tracks the workflow
  -- (draft -> sent -> signed/declined/voided/expired); the actual signature
  -- capture lives in the signatures table below.
  CREATE TABLE IF NOT EXISTS signable_documents (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    sourceDocumentId TEXT,
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    createdByUserId TEXT,
    sentAt TEXT,
    signedAt TEXT,
    declinedAt TEXT,
    FOREIGN KEY (matterId) REFERENCES matters(id),
    FOREIGN KEY (sourceDocumentId) REFERENCES documents(id)
  );

  CREATE INDEX IF NOT EXISTS idx_signable_documents_matterId ON signable_documents(matterId);

  -- A basic electronic signature (typed name + optional drawn signature
  -- image), not a qualified/advanced e-signature. documentHash pins down
  -- exactly what was signed for later verification.
  CREATE TABLE IF NOT EXISTS signatures (
    id TEXT PRIMARY KEY,
    signableDocumentId TEXT NOT NULL,
    signerName TEXT NOT NULL,
    signerEmail TEXT,
    signatureText TEXT NOT NULL,
    signatureImage TEXT,
    documentHash TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    signedAt TEXT NOT NULL,
    FOREIGN KEY (signableDocumentId) REFERENCES signable_documents(id)
  );

  CREATE INDEX IF NOT EXISTS idx_signatures_signableDocumentId ON signatures(signableDocumentId);

  -- Fixed question set defined in code (see intake.ts), not a configurable
  -- template builder — consistent with this app's no-config, hand-rolled
  -- style at MVP scale.
  CREATE TABLE IF NOT EXISTS intake_responses (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    status TEXT NOT NULL,
    answersJson TEXT,
    clientName TEXT,
    clientEmail TEXT,
    createdAt TEXT NOT NULL,
    createdByUserId TEXT,
    sentAt TEXT,
    completedAt TEXT,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE INDEX IF NOT EXISTS idx_intake_responses_matterId ON intake_responses(matterId);

  -- Ownership/assignment bookkeeping (who's actually working the file).
  -- Every matter is visible to every staff member by default (shared
  -- visibility, see docs/ROADMAP.md) — this table becomes the real access
  -- list only once a matter's ethicalWall flag is on (see matterAccess.ts).
  CREATE TABLE IF NOT EXISTS matter_team (
    matterId TEXT NOT NULL,
    userId TEXT NOT NULL,
    roleOnMatter TEXT NOT NULL,
    addedAt TEXT NOT NULL,
    addedByUserId TEXT,
    PRIMARY KEY (matterId, userId),
    FOREIGN KEY (matterId) REFERENCES matters(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_matter_team_matterId ON matter_team(matterId);
  CREATE INDEX IF NOT EXISTS idx_matter_team_userId ON matter_team(userId);

  -- First-class party records (opposing party, witness, co-counsel, etc.) —
  -- previously only existed as ephemeral AI-generated graph labels, never
  -- stored/queryable. See checkConflicts() in matters.ts for why this was
  -- called out as a gap.
  CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE INDEX IF NOT EXISTS idx_parties_matterId ON parties(matterId);

  -- Directed link between two matters (e.g. same opposing party, related
  -- litigation). Stored one row per direction so each side can carry its own
  -- note; list queries check both matterId and relatedMatterId.
  CREATE TABLE IF NOT EXISTS related_matters (
    matterId TEXT NOT NULL,
    relatedMatterId TEXT NOT NULL,
    note TEXT,
    createdAt TEXT NOT NULL,
    createdByUserId TEXT,
    PRIMARY KEY (matterId, relatedMatterId),
    FOREIGN KEY (matterId) REFERENCES matters(id),
    FOREIGN KEY (relatedMatterId) REFERENCES matters(id)
  );

  CREATE INDEX IF NOT EXISTS idx_related_matters_matterId ON related_matters(matterId);
  CREATE INDEX IF NOT EXISTS idx_related_matters_relatedMatterId ON related_matters(relatedMatterId);

  -- One row per case citation found in a matter's documents/notes, refreshed
  -- wholesale (delete-then-reinsert) each time "Check case citations" runs —
  -- see refreshCaseNoteups() in caseNoteup.ts. Not history: only the latest
  -- check per citation is kept.
  CREATE TABLE IF NOT EXISTS case_noteups (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    citation TEXT NOT NULL,
    databaseId TEXT NOT NULL,
    caseId TEXT NOT NULL,
    found INTEGER NOT NULL,
    title TEXT,
    url TEXT,
    citedCasesJson TEXT NOT NULL,
    citingCasesJson TEXT NOT NULL,
    citedLegislationsJson TEXT NOT NULL,
    error TEXT,
    checkedAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE INDEX IF NOT EXISTS idx_case_noteups_matterId ON case_noteups(matterId);

  -- Four new AI-generated analysis types, all the same shape as the
  -- existing matter_digests/evidence_matrices tables (append-only history,
  -- one markdown blob per generation) — see listSimpleGeneratedDocs in
  -- matters.ts, which reads/writes all four generically instead of
  -- duplicating four near-identical CRUD implementations.
  CREATE TABLE IF NOT EXISTS contradiction_analyses (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );
  CREATE INDEX IF NOT EXISTS idx_contradiction_analyses_matterId ON contradiction_analyses(matterId);

  CREATE TABLE IF NOT EXISTS exhibit_lists (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );
  CREATE INDEX IF NOT EXISTS idx_exhibit_lists_matterId ON exhibit_lists(matterId);

  CREATE TABLE IF NOT EXISTS disclosure_checklists (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );
  CREATE INDEX IF NOT EXISTS idx_disclosure_checklists_matterId ON disclosure_checklists(matterId);

  CREATE TABLE IF NOT EXISTS crown_position_analyses (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );
  CREATE INDEX IF NOT EXISTS idx_crown_position_analyses_matterId ON crown_position_analyses(matterId);

  CREATE TABLE IF NOT EXISTS privilege_reviews (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );
  CREATE INDEX IF NOT EXISTS idx_privilege_reviews_matterId ON privilege_reviews(matterId);
`);

// Schema migrations for columns added after the table already existed on a
// real (non-empty) database — CREATE TABLE IF NOT EXISTS is a no-op once the
// table exists, so new columns need an explicit ALTER TABLE.
function ensureColumn(table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    execWithRetry(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("matters", "fileNumber", "TEXT");
ensureColumn("matters", "clientEmail", "TEXT");
ensureColumn("matters", "hourlyRate", "REAL");
ensureColumn("time_entries", "invoiceId", "TEXT");
ensureColumn("time_entries", "rate", "REAL");
ensureColumn("audit_log", "userId", "TEXT");
ensureColumn("audit_log", "userName", "TEXT");
ensureColumn("audit_log", "hash", "TEXT");
ensureColumn("matters", "classification", "TEXT NOT NULL DEFAULT 'standard'");
ensureColumn("matters", "legalHold", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("matters", "legalHoldReason", "TEXT");
ensureColumn("matters", "retentionDate", "TEXT");
ensureColumn("matters", "clientId", "TEXT");
// Default 1 so reference documents uploaded before this feature shipped are
// grandfathered in as already-approved rather than suddenly becoming
// unattachable — new uploads explicitly insert approved=0 regardless of
// this column default, so the migration-time default only affects
// pre-existing rows.
ensureColumn("reference_documents", "approved", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("reference_documents", "approvedBy", "TEXT");
ensureColumn("reference_documents", "approvedAt", "TEXT");
ensureColumn("reference_documents", "sensitivityFlag", "TEXT");
// Extraction status is null until the first extraction attempt (upload or a
// later retrigger via digest/chat/etc.) rather than assuming "ok" for
// documents that predate this column — see extractionStatus.ts.
ensureColumn("documents", "extractionStatus", "TEXT");
ensureColumn("documents", "extractionError", "TEXT");
ensureColumn("documents", "extractionCheckedAt", "TEXT");
ensureColumn("reference_documents", "extractionStatus", "TEXT");
ensureColumn("reference_documents", "extractionError", "TEXT");
ensureColumn("reference_documents", "extractionCheckedAt", "TEXT");
ensureColumn("matters", "ethicalWall", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "totpSecret", "TEXT");
ensureColumn("users", "totpEnabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "totpBackupCodesJson", "TEXT");
// Default 'individual' — every client row created before this shipped was
// implicitly an individual, so this backfills correctly with no migration
// script needed. contactPerson/registrationNumber only make sense for
// corporate/institutional clients but are nullable for everyone.
ensureColumn("clients", "type", "TEXT NOT NULL DEFAULT 'individual'");
ensureColumn("clients", "contactPerson", "TEXT");
ensureColumn("clients", "registrationNumber", "TEXT");
// detectedLanguage: ISO 639-3 code (e.g. "eng", "fra") or "und" if the text
// was too short to tell. ocrConfidence only set for OCR'd images (null for
// every other extraction path — there's no equivalent signal). qualityScore
// is a simple 0-100 composite (see extractionStatus.ts) — null until the
// first extraction attempt, same as extractionStatus itself.
ensureColumn("documents", "detectedLanguage", "TEXT");
ensureColumn("documents", "ocrConfidence", "REAL");
ensureColumn("documents", "qualityScore", "INTEGER");
ensureColumn("reference_documents", "detectedLanguage", "TEXT");
ensureColumn("reference_documents", "ocrConfidence", "REAL");
ensureColumn("reference_documents", "qualityScore", "INTEGER");
// malwareScanStatus: "clean" | "infected" | "error" | "not_scanned" (null
// until the first scan attempt at upload time). An infected file's bytes
// are stored in data/quarantine/ instead of the normal uploads directory —
// storagePath still points at wherever it actually landed either way.
ensureColumn("documents", "malwareScanStatus", "TEXT");
ensureColumn("documents", "malwareScanDetail", "TEXT");
ensureColumn("reference_documents", "malwareScanStatus", "TEXT");
ensureColumn("reference_documents", "malwareScanDetail", "TEXT");

// Links an email attachment back to the email it was imported with, so the
// relationship survives even though both end up as ordinary rows in the
// same table (see emailImport.ts). Self-referencing, so no separate join
// table is needed.
ensureColumn("documents", "parentDocumentId", "TEXT");

// A document is only visible in the client portal once a lawyer explicitly
// flips this on (see clientPortal.ts) — nothing is exposed to a client by
// default just because their portal account exists.
ensureColumn("documents", "sharedWithClient", "INTEGER NOT NULL DEFAULT 0");

// Null until the user drags a note for the first time — the client picks a
// cascaded default position in that case rather than the server guessing a
// viewport size it has no way to know.
ensureColumn("sticky_notes", "x", "REAL");
ensureColumn("sticky_notes", "y", "REAL");

// Distinguishes a deadline the AI extracted from a matter's documents
// (existing behaviour — every pre-existing row backfills to this default,
// which is accurate: they were all extracted) from one computed by the
// rules-based calculator or entered by hand. This is what lets
// replaceDeadlines() below wipe and re-derive only the extracted subset on
// every re-extract, instead of destroying rule-computed/manual deadlines
// that happen to live in the same table.
ensureColumn("matter_deadlines", "source", "TEXT NOT NULL DEFAULT 'extracted'");
ensureColumn("matter_deadlines", "ruleId", "TEXT");
ensureColumn("matter_deadlines", "triggerDate", "TEXT");

// Time entries previously had no attorney attribution at all — added so
// the firm analytics dashboard can show hours logged per person going
// forward. Historical entries stay NULL and simply don't count toward it.
ensureColumn("time_entries", "userId", "TEXT");

// One-way calendar push (deadlines -> Google/Outlook), off by default even
// once a mail account is connected — nothing gets pushed to a calendar
// just because email reading works. calendarEventId/calendarProvider let
// a later edit to the same deadline update the event that was already
// pushed, instead of creating a duplicate.
ensureColumn("email_accounts", "calendarSyncEnabled", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("matter_deadlines", "calendarEventId", "TEXT");
ensureColumn("matter_deadlines", "calendarProvider", "TEXT");

// Gmail and Microsoft can be connected either via OAuth (real login +
// consent screen, needed for calendar sync) or via IMAP with a per-app
// password (no developer app registration, mail-only) — see
// emailIntegration.ts. Every row that existed before this column was added
// was necessarily OAuth, except Yahoo, which has never had an OAuth
// mail-read path at all and was always effectively an app password.
ensureColumn("email_accounts", "authMethod", "TEXT NOT NULL DEFAULT 'oauth'");
db.prepare("UPDATE email_accounts SET authMethod = 'app_password' WHERE provider = 'yahoo'").run();

// Splits the reference library's single shelf into the two shared tiers of
// the vision doc's three-layer knowledge architecture (client-matter
// documents are already their own tier — the `documents` table above):
// the firm's own precedents/know-how vs. third-party public legal
// authority (statutes, case law). Existing rows default to firm_knowledge,
// the more conservative assumption for material already uploaded without
// a tier in mind.
ensureColumn("reference_documents", "category", "TEXT NOT NULL DEFAULT 'firm_knowledge'");

// One-time migration: matters used to store client identity only as free
// text (clientName/clientEmail), with no real entity linking one client's
// several matters together. Backfill a clients row per distinct
// name+email pair already on file, and link each matter to it — matters
// keep clientName/clientEmail too (every existing feature reads those
// directly), the clients table is additive, not a replacement.
function backfillClientsFromMatters(): void {
  const unlinked = db
    .prepare("SELECT id, clientName, clientEmail FROM matters WHERE clientId IS NULL")
    .all() as { id: string; clientName: string; clientEmail: string | null }[];
  if (unlinked.length === 0) return;

  const findClient = db.prepare(
    "SELECT id FROM clients WHERE name = ? AND COALESCE(email, '') = COALESCE(?, '')",
  );
  const insertClient = db.prepare(
    "INSERT INTO clients (id, name, email, phone, notes, createdAt) VALUES (?, ?, ?, NULL, NULL, ?)",
  );
  const linkMatter = db.prepare("UPDATE matters SET clientId = ? WHERE id = ?");

  for (const matter of unlinked) {
    const existing = findClient.get(matter.clientName, matter.clientEmail) as
      | { id: string }
      | undefined;
    const clientId = existing?.id ?? crypto.randomUUID();
    if (!existing) {
      insertClient.run(clientId, matter.clientName, matter.clientEmail, new Date().toISOString());
    }
    linkMatter.run(clientId, matter.id);
  }
}

backfillClientsFromMatters();

// One-time migration: this app used to have exactly one global password
// (data/auth.json). Promote it into the first admin user in the `users`
// table, preserving the existing password hash/salt so the current
// password keeps working — no reset needed. Runs once: skipped once any
// row exists in `users`.
function migrateLegacySingleUserToUsersTable(): void {
  const { count } = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (count > 0) return;

  const authPath = path.join(DATA_DIR, "auth.json");
  if (!existsSync(authPath)) return;

  const auth = JSON.parse(readFileSync(authPath, "utf-8")) as {
    passwordHash?: string;
    passwordSalt?: string;
    activeSessionToken?: string;
  };
  if (!auth.passwordHash || !auth.passwordSalt) return;

  db.prepare(
    `INSERT INTO users (id, email, name, role, passwordHash, passwordSalt, mustChangePassword, active, createdAt)
     VALUES (?, ?, ?, 'admin', ?, ?, 0, 1, ?)`,
  ).run(
    crypto.randomUUID(),
    "ali.salamat@cortexhq.ai",
    "Ali Salamat",
    auth.passwordHash,
    auth.passwordSalt,
    new Date().toISOString(),
  );

  // Sessions now live in the `sessions` table; the password fields are
  // superseded by the users table row just created.
  delete auth.passwordHash;
  delete auth.passwordSalt;
  delete auth.activeSessionToken;
  writeFileSync(authPath, JSON.stringify(auth, null, 2), { encoding: "utf-8", mode: 0o600 });
}

migrateLegacySingleUserToUsersTable();

// Hash-chains the audit log so a row edited or deleted after the fact (bypassing
// the app, e.g. direct DB access) is detectable: each row's hash covers its own
// fields plus the previous row's hash, so changing any row invalidates every
// hash after it. GENESIS_HASH is the fixed starting point for the very first row.
export const AUDIT_GENESIS_HASH = "0".repeat(64);

interface AuditHashInput {
  id: string;
  action: string;
  matterId: string | null;
  detail: string;
  createdAt: string;
  userId: string | null;
}

export function computeAuditRowHash(prevHash: string, row: AuditHashInput): string {
  return createHash("sha256")
    .update(`${prevHash}|${row.id}|${row.action}|${row.matterId ?? ""}|${row.detail}|${row.createdAt}|${row.userId ?? ""}`)
    .digest("hex");
}

// Backfills hashes for rows written before this feature shipped, chaining
// from whichever row already has one (or genesis, on first run ever).
function backfillAuditLogHashes(): void {
  const missing = db
    .prepare(
      "SELECT rowid as rowid, id, action, matterId, detail, createdAt, userId FROM audit_log WHERE hash IS NULL ORDER BY rowid ASC",
    )
    .all() as unknown as (AuditHashInput & { rowid: number })[];
  if (missing.length === 0) return;

  const lastHashed = db
    .prepare("SELECT hash FROM audit_log WHERE hash IS NOT NULL ORDER BY rowid DESC LIMIT 1")
    .get() as { hash: string } | undefined;
  let prevHash = lastHashed?.hash ?? AUDIT_GENESIS_HASH;

  const update = db.prepare("UPDATE audit_log SET hash = ? WHERE rowid = ?");
  for (const row of missing) {
    const hash = computeAuditRowHash(prevHash, row);
    update.run(hash, row.rowid);
    prevHash = hash;
  }
}

backfillAuditLogHashes();

// Backfill file numbers for any matter created before this column existed,
// numbering sequentially per calendar year in creation order.
const missingFileNumbers = db
  .prepare("SELECT id, createdAt FROM matters WHERE fileNumber IS NULL ORDER BY createdAt ASC")
  .all() as { id: string; createdAt: string }[];
if (missingFileNumbers.length > 0) {
  const yearCounts = new Map<string, number>();
  const update = db.prepare("UPDATE matters SET fileNumber = ? WHERE id = ?");
  for (const matter of missingFileNumbers) {
    const year = matter.createdAt.slice(0, 4);
    const next = (yearCounts.get(year) ?? 0) + 1;
    yearCounts.set(year, next);
    update.run(`${year}-${String(next).padStart(4, "0")}`, matter.id);
  }
}

export default db;

// better-sqlite/node:sqlite rows have a null prototype, which Next.js's RSC
// serialization rejects when passing data from a Server Component to a
// Client Component. Spreading into a plain object literal fixes that.
export function toPlain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}
