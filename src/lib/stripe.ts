import { getStripeConfig } from "./settings";

// Stripe's REST API directly via fetch (Basic Auth, secret key as
// username, no password) — no SDK dependency for the handful of calls
// this app actually makes (create/fetch a Checkout Session, check the
// account). Stripe's API takes form-encoded bodies with bracket notation
// for nested objects/arrays, not JSON.
const STRIPE_API_BASE = "https://api.stripe.com/v1";

export async function isStripeConfigured(): Promise<boolean> {
  return Boolean(await getStripeConfig());
}

function authHeader(secretKey: string): string {
  return "Basic " + Buffer.from(`${secretKey}:`).toString("base64");
}

async function stripeRequest(
  method: "GET" | "POST",
  path: string,
  body?: URLSearchParams,
): Promise<Record<string, unknown>> {
  const config = await getStripeConfig();
  if (!config) {
    throw new Error("Stripe is not configured. Add your secret key in Settings > Payments.");
  }
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(config.secretKey),
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Stripe request failed (HTTP ${res.status})`);
  }
  return json;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
}

// A single line item, amount in whole currency units (dollars) — converted
// to cents here since that's what Stripe's API actually expects.
export async function createCheckoutSession(params: {
  amount: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSessionResult> {
  const body = new URLSearchParams({
    mode: "payment",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": params.description,
    "line_items[0][price_data][unit_amount]": String(Math.round(params.amount * 100)),
    "line_items[0][quantity]": "1",
  });
  const session = await stripeRequest("POST", "/checkout/sessions", body);
  return { id: session.id as string, url: session.url as string };
}

export interface CheckoutSessionStatus {
  id: string;
  paid: boolean;
  amountTotal: number;
}

export async function getCheckoutSession(sessionId: string): Promise<CheckoutSessionStatus> {
  const session = await stripeRequest("GET", `/checkout/sessions/${sessionId}`);
  return {
    id: session.id as string,
    paid: session.payment_status === "paid",
    amountTotal: (session.amount_total as number) / 100,
  };
}

export async function testStripeConnection(): Promise<void> {
  await stripeRequest("GET", "/balance");
}
