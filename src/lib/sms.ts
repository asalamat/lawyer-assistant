import { getTwilioConfig } from "./settings";

// Twilio's REST API directly via fetch, Basic Auth (accountSid:authToken)
// — no SDK dependency needed for the two calls this app actually makes
// (send, and poll for inbound messages).
const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

export async function isSmsConfigured(): Promise<boolean> {
  return Boolean(await getTwilioConfig());
}

function authHeader(accountSid: string, authToken: string): string {
  return "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
}

export async function sendSms(params: { to: string; body: string }): Promise<{ sid: string; status: string }> {
  const config = await getTwilioConfig();
  if (!config) {
    throw new Error("Twilio is not configured. Add your Account SID, Auth Token, and phone number in Settings > SMS.");
  }

  const res = await fetch(`${TWILIO_API_BASE}/Accounts/${config.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: authHeader(config.accountSid, config.authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: params.to, From: config.fromPhoneNumber, Body: params.body }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.message ?? `Twilio send failed (HTTP ${res.status})`);
  }
  return { sid: body.sid, status: body.status };
}

export interface InboundSmsMessage {
  sid: string;
  from: string;
  body: string;
  dateSent: string;
}

// Polled by smsScheduler.ts — this app has no public URL for Twilio to
// webhook to (same constraint as DocuSign, see docusignScheduler.ts), so
// inbound messages are discovered by listing what Twilio already has
// rather than receiving a push.
export async function listInboundSince(afterIso: string): Promise<InboundSmsMessage[]> {
  const config = await getTwilioConfig();
  if (!config) return [];

  const params = new URLSearchParams({
    To: config.fromPhoneNumber,
    DateSentAfter: afterIso,
    PageSize: "100",
  });
  const res = await fetch(`${TWILIO_API_BASE}/Accounts/${config.accountSid}/Messages.json?${params}`, {
    headers: { Authorization: authHeader(config.accountSid, config.authToken) },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.message ?? `Twilio inbound check failed (HTTP ${res.status})`);
  }

  return (body.messages ?? [])
    .filter((m: { direction: string }) => m.direction === "inbound")
    .map((m: { sid: string; from: string; body: string; date_sent: string }) => ({
      sid: m.sid,
      from: m.from,
      body: m.body,
      dateSent: m.date_sent,
    }));
}

// Verifies credentials by fetching the account itself, without sending a
// message — same "connect, don't act" shape as verifyEmailConnection.
export async function verifyTwilioConnection(): Promise<void> {
  const config = await getTwilioConfig();
  if (!config) throw new Error("Twilio is not configured.");
  const res = await fetch(`${TWILIO_API_BASE}/Accounts/${config.accountSid}.json`, {
    headers: { Authorization: authHeader(config.accountSid, config.authToken) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? `Twilio authentication failed (HTTP ${res.status})`);
  }
}
