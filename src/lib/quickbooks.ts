import { randomBytes } from "crypto";
import {
  getQuickBooksAppCredentials,
  getQuickBooksConnection,
  saveQuickBooksConnection,
  updateQuickBooksTokens,
  type QuickBooksConnection,
} from "./settings";

// Intuit's standard OAuth 2.0 authorization-code flow — shared endpoints
// for sandbox and production alike; only the Accounting API base URL
// differs by environment (see apiBase() below).
const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const SCOPE = "com.intuit.quickbooks.accounting";

function apiBase(sandbox: boolean): string {
  return sandbox ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";
}

// No PKCE — unlike the Drive/OneDrive flow, Intuit's OAuth is a
// confidential-client flow (a real client secret is always issued), so a
// plain opaque state string is enough CSRF protection.
const pendingStates = new Set<string>();

export function createQuickBooksOAuthState(): string {
  const state = randomBytes(16).toString("hex");
  pendingStates.add(state);
  return state;
}

export function consumeQuickBooksOAuthState(state: string): boolean {
  if (!pendingStates.has(state)) return false;
  pendingStates.delete(state);
  return true;
}

export function buildQuickBooksAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

interface TokenResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

async function exchangeToken(clientId: string, clientSecret: string, body: URLSearchParams): Promise<TokenResult> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const tokens = await res.json();
  if (!res.ok) throw new Error(tokens?.error_description ?? `Token exchange failed (HTTP ${res.status})`);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };
}

export async function exchangeQuickBooksCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<TokenResult> {
  return exchangeToken(
    clientId,
    clientSecret,
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  );
}

async function refreshQuickBooksToken(clientId: string, clientSecret: string, refreshToken: string): Promise<TokenResult> {
  return exchangeToken(
    clientId,
    clientSecret,
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  );
}

async function fetchCompanyName(realmId: string, accessToken: string, sandbox: boolean): Promise<string | null> {
  const res = await fetch(`${apiBase(sandbox)}/v3/company/${realmId}/companyinfo/${realmId}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body?.CompanyInfo?.CompanyName ?? null;
}

// Called from the OAuth callback route — realmId (the connected QBO
// company id) arrives as its own query param alongside `code`, distinct
// from anything in the token response itself.
export async function completeQuickBooksOAuthCallback(code: string, redirectUri: string, realmId: string): Promise<void> {
  const app = await getQuickBooksAppCredentials();
  if (!app) throw new Error("QuickBooks app credentials not configured");

  const tokens = await exchangeQuickBooksCode(app.clientId, app.clientSecret, code, redirectUri);
  const companyName = await fetchCompanyName(realmId, tokens.accessToken, app.sandbox);

  const connection: QuickBooksConnection = {
    realmId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: tokens.expiresAt,
    companyName,
  };
  await saveQuickBooksConnection(connection);
}

class QuickBooksUnauthorizedError extends Error {}

async function refreshAndPersistToken(connection: QuickBooksConnection): Promise<string> {
  const app = await getQuickBooksAppCredentials();
  if (!app) throw new Error("QuickBooks app credentials not configured — set them up again in Settings > QuickBooks.");
  const refreshed = await refreshQuickBooksToken(app.clientId, app.clientSecret, connection.refreshToken);
  await updateQuickBooksTokens(refreshed.accessToken, refreshed.refreshToken, refreshed.expiresAt);
  return refreshed.accessToken;
}

async function withTokenRetry<T>(
  connection: QuickBooksConnection,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  try {
    return await fn(connection.accessToken);
  } catch (err) {
    if (!(err instanceof QuickBooksUnauthorizedError)) throw err;
    const freshToken = await refreshAndPersistToken(connection);
    return await fn(freshToken);
  }
}

async function assertOk(res: Response, label: string): Promise<Record<string, unknown>> {
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) throw new QuickBooksUnauthorizedError(label);
  if (!res.ok) {
    const detail = body?.Fault?.Error?.[0]?.Message ?? JSON.stringify(body);
    throw new Error(`${label} failed: ${detail}`);
  }
  return body;
}

function escapeQbQueryValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

export async function isQuickBooksConnected(): Promise<boolean> {
  return Boolean(await getQuickBooksConnection());
}

export async function testQuickBooksConnection(): Promise<{ companyName: string | null }> {
  const app = await getQuickBooksAppCredentials();
  const connection = await getQuickBooksConnection();
  if (!app || !connection) throw new Error("QuickBooks is not connected.");
  return withTokenRetry(connection, async (accessToken) => {
    const res = await fetch(`${apiBase(app.sandbox)}/v3/company/${connection.realmId}/companyinfo/${connection.realmId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const body = await assertOk(res, "Connection test");
    return { companyName: (body.CompanyInfo as { CompanyName?: string } | undefined)?.CompanyName ?? null };
  });
}

// Finds a QuickBooks Customer matching this client's name, creating one if
// none exists. Reuses the id on every later sync (stored on the client
// row's qbCustomerId) so a repeat sync never creates a duplicate.
export async function getOrCreateQuickBooksCustomer(client: {
  name: string;
  email: string | null;
}): Promise<string> {
  const app = await getQuickBooksAppCredentials();
  const connection = await getQuickBooksConnection();
  if (!app || !connection) throw new Error("QuickBooks is not connected.");

  return withTokenRetry(connection, async (accessToken) => {
    const base = apiBase(app.sandbox);
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };

    const query = `select Id from Customer where DisplayName = '${escapeQbQueryValue(client.name)}'`;
    const searchRes = await fetch(`${base}/v3/company/${connection.realmId}/query?query=${encodeURIComponent(query)}`, {
      headers,
    });
    const searchBody = await assertOk(searchRes, "Customer lookup");
    const existing = (searchBody.QueryResponse as { Customer?: { Id: string }[] } | undefined)?.Customer?.[0];
    if (existing) return existing.Id;

    const createRes = await fetch(`${base}/v3/company/${connection.realmId}/customer`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        DisplayName: client.name,
        ...(client.email ? { PrimaryEmailAddr: { Address: client.email } } : {}),
      }),
    });
    const createBody = await assertOk(createRes, "Customer creation");
    return (createBody.Customer as { Id: string }).Id;
  });
}

let cachedServiceItemId: string | null = null;

// QuickBooks requires every invoice line to reference an Item (a
// Product/Service). Finds this firm's own "Legal Services" item if one
// already exists, otherwise creates it against whatever income account
// the company already has — there's no universal default Item id to rely
// on across different QuickBooks companies the way a fresh sandbox has one.
async function getOrCreateServiceItem(realmId: string, sandbox: boolean, accessToken: string): Promise<string> {
  if (cachedServiceItemId) return cachedServiceItemId;
  const base = apiBase(sandbox);
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };

  const itemQuery = "select Id from Item where Name = 'Legal Services'";
  const itemRes = await fetch(`${base}/v3/company/${realmId}/query?query=${encodeURIComponent(itemQuery)}`, { headers });
  const itemBody = await assertOk(itemRes, "Service item lookup");
  const existingItem = (itemBody.QueryResponse as { Item?: { Id: string }[] } | undefined)?.Item?.[0];
  if (existingItem) {
    cachedServiceItemId = existingItem.Id;
    return existingItem.Id;
  }

  const accountQuery = "select Id from Account where AccountType = 'Income' maxresults 1";
  const accountRes = await fetch(`${base}/v3/company/${realmId}/query?query=${encodeURIComponent(accountQuery)}`, { headers });
  const accountBody = await assertOk(accountRes, "Income account lookup");
  const incomeAccount = (accountBody.QueryResponse as { Account?: { Id: string }[] } | undefined)?.Account?.[0];
  if (!incomeAccount) {
    throw new Error("Couldn't find an income account in this QuickBooks company to attach a service item to.");
  }

  const createRes = await fetch(`${base}/v3/company/${realmId}/item`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      Name: "Legal Services",
      Type: "Service",
      IncomeAccountRef: { value: incomeAccount.Id },
    }),
  });
  const createBody = await assertOk(createRes, "Service item creation");
  const id = (createBody.Item as { Id: string }).Id;
  cachedServiceItemId = id;
  return id;
}

export interface QuickBooksInvoiceInput {
  customerId: string;
  invoiceNumber: string;
  description: string;
  amount: number;
}

export async function createQuickBooksInvoice(input: QuickBooksInvoiceInput): Promise<string> {
  const app = await getQuickBooksAppCredentials();
  const connection = await getQuickBooksConnection();
  if (!app || !connection) throw new Error("QuickBooks is not connected.");

  return withTokenRetry(connection, async (accessToken) => {
    const base = apiBase(app.sandbox);
    const itemId = await getOrCreateServiceItem(connection.realmId, app.sandbox, accessToken);
    const res = await fetch(`${base}/v3/company/${connection.realmId}/invoice`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        CustomerRef: { value: input.customerId },
        DocNumber: input.invoiceNumber,
        Line: [
          {
            Amount: input.amount,
            DetailType: "SalesItemLineDetail",
            Description: input.description,
            SalesItemLineDetail: { ItemRef: { value: itemId } },
          },
        ],
      }),
    });
    const body = await assertOk(res, "Invoice creation");
    return (body.Invoice as { Id: string }).Id;
  });
}

// Records a full payment against an already-synced invoice — QuickBooks
// tracks paid status via a separate Payment object linked to the invoice,
// not a status field on the invoice itself.
export async function recordQuickBooksPayment(customerId: string, qbInvoiceId: string, amount: number): Promise<string> {
  const app = await getQuickBooksAppCredentials();
  const connection = await getQuickBooksConnection();
  if (!app || !connection) throw new Error("QuickBooks is not connected.");

  return withTokenRetry(connection, async (accessToken) => {
    const res = await fetch(`${apiBase(app.sandbox)}/v3/company/${connection.realmId}/payment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        CustomerRef: { value: customerId },
        TotalAmt: amount,
        Line: [{ Amount: amount, LinkedTxn: [{ TxnId: qbInvoiceId, TxnType: "Invoice" }] }],
      }),
    });
    const body = await assertOk(res, "Payment recording");
    return (body.Payment as { Id: string }).Id;
  });
}
