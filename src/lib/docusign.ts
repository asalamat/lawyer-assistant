import { createSign } from "crypto";
import { type DocuSignConfig, getDocuSignConfig } from "./settings";

// JWT Grant + remote signing, deliberately not embedded signing or
// Authorization Code Grant — this app has no public URL of its own (it
// runs on one local machine), so the client can never load anything hosted
// here. Remote signing sidesteps that entirely: DocuSign emails the
// recipient directly and hosts the whole signing ceremony on its own
// servers. This app only ever makes outbound calls to DocuSign's API
// (create envelope, poll status, download the signed result), which works
// fine from behind a NAT/firewall with no inbound exposure at all.

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// DocuSign returns JSON for normal API errors, but a misconfigured URL,
// a proxy in front of it, or certain auth failures can return an HTML
// error page instead — calling res.json() on that throws a useless
// "Unexpected token '<'" that buries whatever actually went wrong. Read
// as text first and only parse if it looks like JSON, so a real failure
// surfaces the actual status code and a snippet of the real response.
// No explicit return type — callers expect the same loosely-typed shape
// `Response.json()` itself returns, since the real shape varies per
// DocuSign endpoint (token/userinfo/envelope/status).
async function readJsonOrThrow(res: Response, context: string) {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    throw new Error(
      `${context} — DocuSign returned a non-JSON response (HTTP ${res.status}): ${trimmed.slice(0, 200) || "(empty body)"}`,
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`${context} — DocuSign's response wasn't valid JSON (HTTP ${res.status}): ${trimmed.slice(0, 200)}`);
  }
}

// Built by hand with node:crypto's RSA-SHA256 signer rather than pulling in
// the `jsonwebtoken` package for one call site — a JWT is just two base64url
// JSON blobs and a signature over them, and Node's crypto already covers
// RS256 directly.
function buildJwtAssertion(config: DocuSignConfig, authHost: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.integrationKey,
    sub: config.userId,
    aud: authHost,
    scope: "signature impersonation",
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(config.privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

interface AuthBundle {
  accessToken: string;
  expiresAt: number;
  baseUri: string;
  accountId: string;
}

let cached: AuthBundle | null = null;

// The account's actual API base URI (which region/datacenter it lives on)
// isn't something the account owner would know to enter — it's only
// discoverable from DocuSign's own userinfo endpoint after authenticating,
// so this is fetched fresh alongside every new token rather than asking for
// it as a settings field.
async function getAuthBundle(config: DocuSignConfig): Promise<AuthBundle> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached;

  const authHost = config.demo ? "account-d.docusign.com" : "account.docusign.com";
  const assertion = buildJwtAssertion(config, authHost);

  const tokenRes = await fetch(`https://${authHost}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const tokenBody = await readJsonOrThrow(tokenRes, "DocuSign authentication failed");
  if (!tokenRes.ok) {
    // consent_required means the one-time admin-consent step (see Settings
    // > DocuSign) hasn't been done yet for this integration key/user pair.
    throw new Error(tokenBody.error_description || tokenBody.error || "DocuSign authentication failed");
  }

  const userInfoRes = await fetch(`https://${authHost}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  });
  const userInfo = await readJsonOrThrow(userInfoRes, "Failed to look up the DocuSign account");
  if (!userInfoRes.ok) {
    throw new Error("Failed to look up the DocuSign account (userinfo request failed).");
  }
  const accounts = (userInfo.accounts ?? []) as { account_id: string; base_uri: string; is_default: boolean }[];
  const account = accounts.find((a) => a.account_id === config.accountId) ?? accounts.find((a) => a.is_default) ?? accounts[0];
  if (!account) {
    throw new Error("No DocuSign account found for this integration user.");
  }

  cached = {
    accessToken: tokenBody.access_token,
    expiresAt: Date.now() + tokenBody.expires_in * 1000,
    // DocuSign's userinfo endpoint returns base_uri as just the account's
    // server host (e.g. "https://demo.docusign.net") — the actual REST API
    // lives under a /restapi path that isn't included and has to be added
    // by hand, per DocuSign's own JWT integration guide.
    baseUri: `${account.base_uri}/restapi`,
    accountId: account.account_id,
  };
  return cached;
}

async function requireConfig(): Promise<DocuSignConfig> {
  const config = await getDocuSignConfig();
  if (!config || !config.enabled) {
    throw new Error("DocuSign is not configured or is turned off in Settings > DocuSign.");
  }
  return config;
}

async function docusignFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const config = await requireConfig();
  const bundle = await getAuthBundle(config);
  return fetch(`${bundle.baseUri}${path.replace("{accountId}", bundle.accountId)}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${bundle.accessToken}` },
  });
}

// Verifies the credentials actually work — mints a token and confirms the
// account resolves, without creating anything. Surfaces DocuSign's own
// error text (e.g. "consent_required") rather than a generic failure.
export async function testDocuSignConnection(): Promise<{ accountId: string; baseUri: string }> {
  const config = await getDocuSignConfig();
  if (!config) throw new Error("DocuSign is not configured yet.");
  cached = null; // force a fresh check rather than trusting a stale cached bundle
  const bundle = await getAuthBundle(config);
  return { accountId: bundle.accountId, baseUri: bundle.baseUri };
}

export interface EnvelopeDocument {
  content: string; // base64
  name: string;
  fileExtension: string;
}

export interface CreateEnvelopeParams {
  recipientEmail: string;
  recipientName: string;
  emailSubject: string;
  documents: EnvelopeDocument[];
}

// The signature tab is anchored to a literal "/sig/" string rather than a
// fixed page position, since documents attached alongside the cover sheet
// (see requestDocuSignSignature in signableDocuments.ts) can be any length
// — anchor-string placement finds the right spot regardless of page count,
// a fixed x/y position wouldn't.
export async function createDocuSignEnvelope(params: CreateEnvelopeParams): Promise<{ envelopeId: string; status: string }> {
  const res = await docusignFetch("/v2.1/accounts/{accountId}/envelopes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      emailSubject: params.emailSubject,
      status: "sent",
      documents: params.documents.map((doc, index) => ({
        documentBase64: doc.content,
        name: doc.name,
        fileExtension: doc.fileExtension,
        documentId: String(index + 1),
      })),
      recipients: {
        signers: [
          {
            email: params.recipientEmail,
            name: params.recipientName,
            recipientId: "1",
            routingOrder: "1",
            tabs: {
              signHereTabs: [{ anchorString: "/sig/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "-10" }],
            },
          },
        ],
      },
    }),
  });
  const body = await readJsonOrThrow(res, "Failed to create the DocuSign envelope");
  if (!res.ok) throw new Error(body.message || "Failed to create the DocuSign envelope.");
  return { envelopeId: body.envelopeId, status: body.status };
}

export interface DocuSignEnvelopeStatus {
  status: string; // sent | delivered | completed | declined | voided, per DocuSign's own vocabulary
  completedAt: string | null;
  signerName: string | null;
  signerEmail: string | null;
  declinedReason: string | null;
}

export async function getDocuSignEnvelopeStatus(envelopeId: string): Promise<DocuSignEnvelopeStatus> {
  const res = await docusignFetch(`/v2.1/accounts/{accountId}/envelopes/${envelopeId}?include=recipients`);
  const body = await readJsonOrThrow(res, "Failed to check the envelope's status");
  if (!res.ok) throw new Error(body.message || "Failed to check the envelope's status.");
  const signer = body.recipients?.signers?.[0];
  return {
    status: body.status,
    completedAt: signer?.signedDateTime ?? null,
    signerName: signer?.name ?? null,
    signerEmail: signer?.email ?? null,
    declinedReason: signer?.declinedReason ?? null,
  };
}

// The combined, tamper-sealed signed document (all envelope documents plus
// DocuSign's own certificate of completion merged into one PDF) — this is
// what gets saved back as the matter's document once signed.
export async function downloadCombinedDocument(envelopeId: string): Promise<Buffer> {
  const res = await docusignFetch(`/v2.1/accounts/{accountId}/envelopes/${envelopeId}/documents/combined`);
  if (!res.ok) throw new Error("Failed to download the signed document from DocuSign.");
  return Buffer.from(await res.arrayBuffer());
}
