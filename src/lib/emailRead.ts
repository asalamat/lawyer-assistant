import db from "./db";
import { getYahooMessageBody, listRecentYahooMessages, listYahooMailboxes } from "./yahooImap";
import type { EmailFolder, EmailProvider } from "./types";

export interface EmailMessageSummary {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  receivedAt: string;
}

export interface EmailMessageAttachment {
  filename: string;
  contentType: string | null;
  content: Buffer;
}

export interface EmailMessageBody {
  subject: string;
  from: string;
  body: string;
  attachments: EmailMessageAttachment[];
}

// Unlike listEmailAccounts() in emailIntegration.ts, this deliberately selects
// the accessToken — safe server-side only, and required to call provider APIs.
// The token must never be sent to the client.
export async function getEmailAccountWithToken(
  provider: EmailProvider,
): Promise<{ accessToken: string; emailAddress: string } | null> {
  const row = db
    .prepare("SELECT accessToken, emailAddress FROM email_accounts WHERE provider = ?")
    .get(provider) as { accessToken: string; emailAddress: string } | undefined;
  return row ? { accessToken: row.accessToken, emailAddress: row.emailAddress } : null;
}

function notConnectedError(provider: EmailProvider): Error {
  return new Error(
    `No ${provider} account is connected. Connect one in Settings before reading email.`,
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
}
interface GmailMessage {
  id: string;
  snippet?: string;
  payload?: GmailPart;
}

function gmailHeader(headers: GmailHeader[] | undefined, name: string): string {
  const match = headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return match?.value ?? "";
}

function decodeGmailBody(payload: GmailPart | undefined): string {
  if (!payload) return "";

  // Depth-first search for the best body part, preferring text/plain over
  // text/html. Gmail base64url-encodes body.data.
  let htmlFallback: string | null = null;

  function walk(part: GmailPart): string | null {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    if (part.mimeType === "text/html" && part.body?.data && htmlFallback === null) {
      htmlFallback = stripHtml(Buffer.from(part.body.data, "base64url").toString("utf8"));
    }
    for (const child of part.parts ?? []) {
      const found = walk(child);
      if (found !== null) return found;
    }
    return null;
  }

  const plain = walk(payload);
  if (plain !== null) return plain.trim();
  if (htmlFallback !== null) return htmlFallback;

  // Single-part message with no explicit mimeType branch above.
  if (payload.body?.data) {
    const raw = Buffer.from(payload.body.data, "base64url").toString("utf8");
    return payload.mimeType === "text/html" ? stripHtml(raw) : raw.trim();
  }
  return "";
}

// Attachment parts carry a filename and an attachmentId instead of inline
// body.data — the actual bytes need a separate fetch per part (see
// fetchGmailAttachments). Inline images referenced from the HTML body (no
// filename) are skipped; they're formatting, not something a lawyer filed.
function collectGmailAttachmentParts(part: GmailPart | undefined): GmailPart[] {
  if (!part) return [];
  const found: GmailPart[] = [];
  if (part.filename && part.body?.attachmentId) found.push(part);
  for (const child of part.parts ?? []) found.push(...collectGmailAttachmentParts(child));
  return found;
}

async function fetchGmailAttachments(
  accessToken: string,
  messageId: string,
  payload: GmailPart | undefined,
): Promise<EmailMessageAttachment[]> {
  const parts = collectGmailAttachmentParts(payload);
  return Promise.all(
    parts.map(async (part) => {
      const attachment = (await gmailFetch(
        accessToken,
        `messages/${messageId}/attachments/${part.body!.attachmentId}`,
      )) as { data?: string };
      return {
        filename: part.filename!,
        contentType: part.mimeType ?? null,
        content: Buffer.from(attachment.data ?? "", "base64url"),
      };
    }),
  );
}

async function gmailFetch(accessToken: string, path: string): Promise<unknown> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function graphFetch(accessToken: string, path: string): Promise<unknown> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Microsoft Graph API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

interface GraphMessage {
  id: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  body?: { contentType?: string; content?: string };
  hasAttachments?: boolean;
}

interface GraphAttachment {
  "@odata.type"?: string;
  name?: string;
  contentType?: string;
  contentBytes?: string;
  isInline?: boolean;
}

// Only file attachments carry contentBytes — item/reference attachments
// (a forwarded email, a shared OneDrive link) don't have real bytes to
// import as a document, and isInline ones are formatting images embedded
// in the HTML body, not something a lawyer filed as an attachment.
async function fetchGraphAttachments(
  accessToken: string,
  messageId: string,
): Promise<EmailMessageAttachment[]> {
  const result = (await graphFetch(accessToken, `messages/${messageId}/attachments`)) as {
    value?: GraphAttachment[];
  };
  return (result.value ?? [])
    .filter(
      (a) =>
        a["@odata.type"] === "#microsoft.graph.fileAttachment" && !a.isInline && a.contentBytes,
    )
    .map((a) => ({
      filename: a.name ?? "attachment",
      contentType: a.contentType ?? null,
      content: Buffer.from(a.contentBytes!, "base64"),
    }));
}

function graphFrom(message: GraphMessage): string {
  const addr = message.from?.emailAddress;
  if (!addr) return "";
  if (addr.name && addr.address) return `${addr.name} <${addr.address}>`;
  return addr.address ?? addr.name ?? "";
}

interface GmailLabel {
  id: string;
  name: string;
  type?: string;
}

// Gmail models folders as "labels" — a message can have several, so this
// isn't a strict folder tree, but it's the closest equivalent and what a
// user actually means by "folder" in Gmail. Skips labels that aren't
// really folders a person would file mail into (CATEGORY_* tabs,
// UNREAD/STARRED/IMPORTANT/CHAT, which are more like filters/flags).
const GMAIL_SKIP_LABELS = new Set(["UNREAD", "STARRED", "IMPORTANT", "CHAT"]);

async function listGmailLabels(accessToken: string): Promise<EmailFolder[]> {
  const result = (await gmailFetch(accessToken, "labels")) as { labels?: GmailLabel[] };
  return (result.labels ?? [])
    .filter((label) => !label.id.startsWith("CATEGORY_") && !GMAIL_SKIP_LABELS.has(label.id))
    .map((label) => ({ id: label.id, name: label.name }));
}

interface GraphMailFolder {
  id: string;
  displayName: string;
}

// Top-level mail folders only (Inbox, Sent Items, Drafts, Deleted Items,
// Archive, and any folders the user created at the top level) — nested
// subfolders aren't recursed into. Covers what "any folder under the main
// email" means in practice for how most people organize mail; a deeper
// folder tree can be added later if it turns out to matter.
async function listGraphMailFolders(accessToken: string): Promise<EmailFolder[]> {
  const result = (await graphFetch(accessToken, "mailFolders?$top=100")) as {
    value?: GraphMailFolder[];
  };
  return (result.value ?? []).map((folder) => ({ id: folder.id, name: folder.displayName }));
}

export async function listFolders(provider: EmailProvider): Promise<EmailFolder[]> {
  const account = await getEmailAccountWithToken(provider);
  if (!account) throw notConnectedError(provider);

  if (provider === "yahoo") {
    return listYahooMailboxes(account.emailAddress, account.accessToken);
  }
  if (provider === "google") {
    return listGmailLabels(account.accessToken);
  }
  return listGraphMailFolders(account.accessToken);
}

export async function listRecentMessages(
  provider: EmailProvider,
  options?: { maxResults?: number; folderId?: string },
): Promise<EmailMessageSummary[]> {
  const maxResults = options?.maxResults ?? 25;
  const folderId = options?.folderId;

  const account = await getEmailAccountWithToken(provider);
  if (!account) throw notConnectedError(provider);

  if (provider === "yahoo") {
    // Yahoo account rows store an app password in the accessToken column,
    // not an OAuth token — see src/lib/yahooImap.ts for why.
    return listRecentYahooMessages(account.emailAddress, account.accessToken, maxResults, folderId);
  }

  if (provider === "google") {
    const labelParam = folderId ? `&labelIds=${encodeURIComponent(folderId)}` : "";
    const list = (await gmailFetch(
      account.accessToken,
      `messages?maxResults=${maxResults}${labelParam}`,
    )) as { messages?: { id: string }[] };
    const ids = (list.messages ?? []).map((m) => m.id);

    const messages = await Promise.all(
      ids.map(async (id) => {
        const msg = (await gmailFetch(
          account.accessToken,
          `messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        )) as GmailMessage;
        const headers = msg.payload?.headers;
        return {
          id: msg.id,
          subject: gmailHeader(headers, "Subject"),
          from: gmailHeader(headers, "From"),
          snippet: msg.snippet ?? "",
          receivedAt: gmailHeader(headers, "Date"),
        };
      }),
    );
    return messages;
  }

  // provider === "microsoft"
  const basePath = folderId ? `mailFolders/${folderId}/messages` : "messages";
  const list = (await graphFetch(
    account.accessToken,
    `${basePath}?$top=${maxResults}&$select=subject,from,bodyPreview,receivedDateTime`,
  )) as { value?: GraphMessage[] };
  return (list.value ?? []).map((m) => ({
    id: m.id,
    subject: m.subject ?? "",
    from: graphFrom(m),
    snippet: m.bodyPreview ?? "",
    receivedAt: m.receivedDateTime ?? "",
  }));
}

export async function getMessageBody(
  provider: EmailProvider,
  messageId: string,
  folderId?: string,
): Promise<EmailMessageBody> {
  const account = await getEmailAccountWithToken(provider);
  if (!account) throw notConnectedError(provider);

  if (provider === "yahoo") {
    // Yahoo UIDs are only unique within their own mailbox — must use the
    // same folder the message was listed from, not a hardcoded default.
    return getYahooMessageBody(account.emailAddress, account.accessToken, messageId, folderId);
  }

  if (provider === "google") {
    const msg = (await gmailFetch(
      account.accessToken,
      `messages/${messageId}?format=full`,
    )) as GmailMessage;
    const headers = msg.payload?.headers;
    return {
      subject: gmailHeader(headers, "Subject"),
      from: gmailHeader(headers, "From"),
      body: decodeGmailBody(msg.payload) || (msg.snippet ?? ""),
      attachments: await fetchGmailAttachments(account.accessToken, messageId, msg.payload),
    };
  }

  // provider === "microsoft"
  const msg = (await graphFetch(
    account.accessToken,
    `messages/${messageId}?$select=subject,from,body,hasAttachments`,
  )) as GraphMessage;
  const content = msg.body?.content ?? "";
  return {
    subject: msg.subject ?? "",
    from: graphFrom(msg),
    body: msg.body?.contentType === "html" ? stripHtml(content) : content,
    attachments: msg.hasAttachments
      ? await fetchGraphAttachments(account.accessToken, messageId)
      : [],
  };
}
