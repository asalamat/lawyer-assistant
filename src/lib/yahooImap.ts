import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { EmailMessageBody, EmailMessageSummary } from "./emailRead";
import type { EmailFolder } from "./types";

// Yahoo discontinued third-party OAuth mail scopes for self-registered apps
// (confirmed via Yahoo's own developer docs — "mail scopes are not available
// for self-served setup in the developer console") and separately
// discontinued *regular password* IMAP login in May 2024. App passwords are
// a distinct, still-supported mechanism: a per-app credential generated
// under Yahoo Account Security > Generate app password, usable with plain
// IMAP auth. This is the only realistic way to read Yahoo mail from a
// self-hosted app today.
const YAHOO_IMAP_HOST = "imap.mail.yahoo.com";
const YAHOO_IMAP_PORT = 993;

function createClient(emailAddress: string, appPassword: string): ImapFlow {
  return new ImapFlow({
    host: YAHOO_IMAP_HOST,
    port: YAHOO_IMAP_PORT,
    secure: true,
    auth: { user: emailAddress, pass: appPassword },
    logger: false,
  });
}

function wrapLoginError(err: unknown): Error {
  // imapflow's Error.message for a rejected command is a generic "Command
  // failed" — the server's actual reason (e.g. "[AUTHENTICATIONFAILED]
  // ...") is on responseText instead. Prefer that when present.
  const responseText =
    err && typeof err === "object" && "responseText" in err
      ? String((err as { responseText?: unknown }).responseText)
      : null;
  const message = responseText || (err instanceof Error ? err.message : "Unknown IMAP error");
  return new Error(
    `Could not sign in to Yahoo Mail: ${message}. Check the email address and app password — Yahoo requires Two-Step Verification enabled on the account before it will issue an app password.`,
  );
}

export async function testYahooImapLogin(emailAddress: string, appPassword: string): Promise<void> {
  const client = createClient(emailAddress, appPassword);
  try {
    await client.connect();
  } catch (err) {
    throw wrapLoginError(err);
  } finally {
    await client.logout().catch(() => {});
  }
}

// IMAP mailboxes are just folders — "INBOX" is the default, but a real
// account usually has others (Sent, Archive, client-specific folders a
// lawyer set up manually). Excludes \Noselect mailboxes (pure containers
// with no messages of their own, e.g. some servers' top-level "[Gmail]").
export async function listYahooMailboxes(
  emailAddress: string,
  appPassword: string,
): Promise<EmailFolder[]> {
  const client = createClient(emailAddress, appPassword);
  try {
    await client.connect();
  } catch (err) {
    throw wrapLoginError(err);
  }
  try {
    const mailboxes = await client.list();
    return mailboxes
      .filter((mailbox) => !mailbox.flags.has("\\Noselect"))
      .map((mailbox) => ({ id: mailbox.path, name: mailbox.path }));
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function listRecentYahooMessages(
  emailAddress: string,
  appPassword: string,
  maxResults = 25,
  mailbox = "INBOX",
): Promise<EmailMessageSummary[]> {
  const client = createClient(emailAddress, appPassword);
  try {
    await client.connect();
  } catch (err) {
    throw wrapLoginError(err);
  }

  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const total = client.mailbox ? client.mailbox.exists : 0;
      if (total === 0) return [];

      const start = Math.max(1, total - maxResults + 1);
      const messages = await client.fetchAll(`${start}:*`, { envelope: true });

      return messages
        .map((message) => {
          const from = message.envelope?.from?.[0];
          const fromText = from
            ? `${from.name ?? ""} <${from.address ?? ""}>`.trim()
            : "";
          return {
            id: String(message.uid),
            subject: message.envelope?.subject ?? "",
            from: fromText,
            snippet: "",
            receivedAt: message.envelope?.date
              ? new Date(message.envelope.date).toISOString()
              : "",
          };
        })
        // Fetch range order isn't guaranteed newest-first across servers —
        // sort explicitly rather than trust server ordering.
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function getYahooMessageBody(
  emailAddress: string,
  appPassword: string,
  uid: string,
  mailbox = "INBOX",
): Promise<EmailMessageBody> {
  const client = createClient(emailAddress, appPassword);
  try {
    await client.connect();
  } catch (err) {
    throw wrapLoginError(err);
  }

  try {
    // A UID is only unique within its own mailbox — fetching by UID
    // against the wrong mailbox silently returns the wrong message (or
    // nothing), not an error, so the mailbox this UID was listed from
    // must be threaded through here, not assumed to be INBOX.
    const lock = await client.getMailboxLock(mailbox);
    let source: Buffer | undefined;
    try {
      const message = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!message) throw new Error(`Message ${uid} not found`);
      source = message.source;
    } finally {
      lock.release();
    }
    if (!source) throw new Error(`Message ${uid} has no content`);

    const parsed = await simpleParser(source);
    return {
      subject: parsed.subject ?? "",
      from: parsed.from?.text ?? "",
      body: parsed.text ?? (typeof parsed.html === "string" ? parsed.html : ""),
      // mailparser also reports inline images used in the HTML body as
      // "attachments" with contentDisposition "inline" — those are
      // formatting, not something a lawyer filed as an attachment.
      attachments: parsed.attachments
        .filter((a) => a.contentDisposition !== "inline")
        .map((a) => ({
          filename: a.filename ?? "attachment",
          contentType: a.contentType ?? null,
          content: a.content,
        })),
    };
  } finally {
    await client.logout().catch(() => {});
  }
}
