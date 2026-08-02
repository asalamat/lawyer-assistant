import db from "./db";
import { getYahooMessageBody, listRecentYahooMessages } from "./yahooImap";
import type { EmailProvider } from "./types";

export interface EmailMessageSummary {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  receivedAt: string;
}

export interface EmailMessageBody {
  subject: string;
  from: string;
  body: string;
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
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
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
}

function graphFrom(message: GraphMessage): string {
  const addr = message.from?.emailAddress;
  if (!addr) return "";
  if (addr.name && addr.address) return `${addr.name} <${addr.address}>`;
  return addr.address ?? addr.name ?? "";
}

export async function listRecentMessages(
  provider: EmailProvider,
  options?: { maxResults?: number },
): Promise<EmailMessageSummary[]> {
  const maxResults = options?.maxResults ?? 25;

  const account = await getEmailAccountWithToken(provider);
  if (!account) throw notConnectedError(provider);

  if (provider === "yahoo") {
    // Yahoo account rows store an app password in the accessToken column,
    // not an OAuth token — see src/lib/yahooImap.ts for why.
    return listRecentYahooMessages(account.emailAddress, account.accessToken, maxResults);
  }

  if (provider === "google") {
    const list = (await gmailFetch(
      account.accessToken,
      `messages?maxResults=${maxResults}`,
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
  const list = (await graphFetch(
    account.accessToken,
    `messages?$top=${maxResults}&$select=subject,from,bodyPreview,receivedDateTime`,
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
): Promise<EmailMessageBody> {
  const account = await getEmailAccountWithToken(provider);
  if (!account) throw notConnectedError(provider);

  if (provider === "yahoo") {
    return getYahooMessageBody(account.emailAddress, account.accessToken, messageId);
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
    };
  }

  // provider === "microsoft"
  const msg = (await graphFetch(
    account.accessToken,
    `messages/${messageId}?$select=subject,from,body`,
  )) as GraphMessage;
  const content = msg.body?.content ?? "";
  return {
    subject: msg.subject ?? "",
    from: graphFrom(msg),
    body: msg.body?.contentType === "html" ? stripHtml(content) : content,
  };
}
