import { createHmac, randomBytes, randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { WebhookEventType, WebhookSubscription } from "./types";

export async function listWebhookSubscriptions(): Promise<WebhookSubscription[]> {
  return db
    .prepare("SELECT * FROM webhook_subscriptions ORDER BY createdAt DESC")
    .all()
    .map((row) => toPlain<WebhookSubscription>(row));
}

// The secret is generated here, not supplied by the caller — same
// one-time-reveal shape as an API key, shown once when the subscription is
// created so the receiving endpoint can be configured with it.
export async function createWebhookSubscription(
  eventType: WebhookEventType,
  url: string,
): Promise<WebhookSubscription> {
  if (!url.trim().startsWith("http")) throw new Error("A valid URL is required");

  const subscription: WebhookSubscription = {
    id: randomUUID(),
    eventType,
    url: url.trim(),
    secret: randomBytes(24).toString("hex"),
    active: 1,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO webhook_subscriptions (id, eventType, url, secret, active, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    subscription.id,
    subscription.eventType,
    subscription.url,
    subscription.secret,
    subscription.active,
    subscription.createdAt,
  );
  await recordAuditEvent("webhook_subscription_created", null, `Added a ${eventType} webhook to ${subscription.url}`);
  return subscription;
}

export async function deleteWebhookSubscription(id: string): Promise<void> {
  const row = db.prepare("SELECT eventType, url FROM webhook_subscriptions WHERE id = ?").get(id) as
    | { eventType: string; url: string }
    | undefined;
  db.prepare("DELETE FROM webhook_subscriptions WHERE id = ?").run(id);
  if (row) {
    await recordAuditEvent("webhook_subscription_deleted", null, `Removed the ${row.eventType} webhook to ${row.url}`);
  }
}

function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

// Best-effort, fire-and-forget — a webhook delivery failing (receiving
// endpoint down, DNS error, timeout) must never block or roll back the
// action that triggered it. Every active subscription for this event type
// gets its own signed POST; failures are swallowed silently rather than
// retried — there's no delivery/retry queue in this first version.
export async function fireWebhook(eventType: WebhookEventType, payload: unknown): Promise<void> {
  const subscriptions = db
    .prepare("SELECT * FROM webhook_subscriptions WHERE eventType = ? AND active = 1")
    .all(eventType)
    .map((row) => toPlain<WebhookSubscription>(row));
  if (subscriptions.length === 0) return;

  const body = JSON.stringify({ event: eventType, data: payload });
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await fetch(subscription.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Signature": signPayload(body, subscription.secret),
          },
          body,
        });
      } catch {
        // Best-effort — see comment above.
      }
    }),
  );
}
