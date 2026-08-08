import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { EmailMessageBody, EmailMessageSummary } from "./emailRead";
import type { EmailFolder, EmailProvider } from "./types";

// App passwords are a real, currently-supported alternative to OAuth for
// IMAP mail access — no developer app registration needed, just a per-app
// credential generated from the account's own security settings. The
// tradeoff: an app password carries no Calendar API scope, so accounts
// connected this way can read mail but can't do calendar sync (see
// calendarSync.ts, which filters these out).
//
// Coverage differs by provider:
// - Yahoo: the only mail-read option at all (no OAuth mail scope exists
//   for self-registered apps — see the comment in emailIntegration.ts).
// - Gmail: fully supported for any account with 2-Step Verification on.
// - Microsoft: only for personal Outlook.com/Hotmail accounts with
//   two-step verification on. Microsoft disabled Basic Auth (including
//   app passwords) for Exchange Online / Microsoft 365 work-or-school
//   tenants in October 2022 with no opt-back-in — those accounts have no
//   IMAP path at all and must use the OAuth connection instead.
interface ImapProviderConfig {
  host: string;
  port: number;
  displayName: string;
}

export const IMAP_PROVIDERS: Record<EmailProvider, ImapProviderConfig> = {
  yahoo: { host: "imap.mail.yahoo.com", port: 993, displayName: "Yahoo Mail" },
  google: { host: "imap.gmail.com", port: 993, displayName: "Gmail" },
  microsoft: { host: "outlook.office365.com", port: 993, displayName: "Outlook/Hotmail" },
};

function createClient(provider: EmailProvider, emailAddress: string, appPassword: string): ImapFlow {
  const config = IMAP_PROVIDERS[provider];
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: emailAddress, pass: appPassword },
    logger: false,
  });
}

function wrapLoginError(provider: EmailProvider, err: unknown): Error {
  // imapflow's Error.message for a rejected command is a generic "Command
  // failed" — the server's actual reason (e.g. "[AUTHENTICATIONFAILED] ...")
  // is on responseText instead. Prefer that when present.
  const responseText =
    err && typeof err === "object" && "responseText" in err
      ? String((err as { responseText?: unknown }).responseText)
      : null;
  const message = responseText || (err instanceof Error ? err.message : "Unknown IMAP error");
  const config = IMAP_PROVIDERS[provider];
  const hint =
    provider === "microsoft"
      ? " Microsoft only supports app passwords for personal Outlook.com/Hotmail accounts with two-step verification on — a work or school Microsoft 365 account has no app-password option at all and needs the OAuth connection above instead."
      : ` Check the email address and app password — ${config.displayName} requires two-step verification enabled on the account before it will issue an app password.`;
  return new Error(`Could not sign in to ${config.displayName}: ${message}.${hint}`);
}

export async function testImapLogin(
  provider: EmailProvider,
  emailAddress: string,
  appPassword: string,
): Promise<void> {
  const client = createClient(provider, emailAddress, appPassword);
  try {
    await client.connect();
  } catch (err) {
    throw wrapLoginError(provider, err);
  } finally {
    await client.logout().catch(() => {});
  }
}

// IMAP mailboxes are just folders — "INBOX" is the default, but a real
// account usually has others (Sent, Archive, client-specific folders a
// lawyer set up manually). Excludes \Noselect mailboxes (pure containers
// with no messages of their own, e.g. some servers' top-level "[Gmail]").
export async function listImapMailboxes(
  provider: EmailProvider,
  emailAddress: string,
  appPassword: string,
): Promise<EmailFolder[]> {
  const client = createClient(provider, emailAddress, appPassword);
  try {
    await client.connect();
  } catch (err) {
    throw wrapLoginError(provider, err);
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

export async function listRecentImapMessages(
  provider: EmailProvider,
  emailAddress: string,
  appPassword: string,
  maxResults = 25,
  mailbox = "INBOX",
): Promise<EmailMessageSummary[]> {
  const client = createClient(provider, emailAddress, appPassword);
  try {
    await client.connect();
  } catch (err) {
    throw wrapLoginError(provider, err);
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

export async function getImapMessageBody(
  provider: EmailProvider,
  emailAddress: string,
  appPassword: string,
  uid: string,
  mailbox = "INBOX",
): Promise<EmailMessageBody> {
  const client = createClient(provider, emailAddress, appPassword);
  try {
    await client.connect();
  } catch (err) {
    throw wrapLoginError(provider, err);
  }

  try {
    // A UID is only unique within its own mailbox — fetching by UID against
    // the wrong mailbox silently returns the wrong message (or nothing),
    // not an error, so the mailbox this UID was listed from must be
    // threaded through here, not assumed to be INBOX.
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
