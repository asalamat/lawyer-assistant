import { randomUUID } from "crypto";
import webpush from "web-push";
import db from "./db";
import { getVapidKeys, setVapidKeys } from "./settings";

export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

let vapidReady: Promise<{ publicKey: string; privateKey: string }> | null = null;

// Lazily generates the app's own VAPID key pair on first use and configures
// web-push with it — no external account/registration needed, unlike the
// OAuth calendar providers this feature replaced.
async function ensureVapid(): Promise<{ publicKey: string; privateKey: string }> {
  if (!vapidReady) {
    vapidReady = (async () => {
      let keys = await getVapidKeys();
      if (!keys) {
        keys = webpush.generateVAPIDKeys();
        await setVapidKeys(keys);
      }
      webpush.setVapidDetails("mailto:notifications@localhost", keys.publicKey, keys.privateKey);
      return keys;
    })();
  }
  return vapidReady;
}

export async function getVapidPublicKey(): Promise<string> {
  return (await ensureVapid()).publicKey;
}

export async function subscribeUser(userId: string, subscription: PushSubscriptionJson): Promise<void> {
  await ensureVapid();
  db.prepare(
    `INSERT INTO push_subscriptions (id, userId, endpoint, p256dh, auth, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET userId = excluded.userId, p256dh = excluded.p256dh, auth = excluded.auth`,
  ).run(randomUUID(), userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, new Date().toISOString());
}

export async function unsubscribeUser(endpoint: string): Promise<void> {
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

export async function hasActivePushSubscription(userId: string): Promise<boolean> {
  const row = db.prepare("SELECT COUNT(*) as c FROM push_subscriptions WHERE userId = ?").get(userId) as { c: number };
  return row.c > 0;
}

interface PushRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function pushToRow(row: PushRow, payload: string): Promise<void> {
  try {
    await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload);
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // Subscription expired or was revoked on the browser side — stop
      // trying rather than erroring on every future reminder tick.
      db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(row.endpoint);
    } else {
      throw err;
    }
  }
}

// Sends to every browser currently subscribed, firm-wide — matches how
// notifications themselves work (see calendar.ts): there's no per-user
// notification ownership to filter by, only per-device subscription.
export async function sendPushToAllSubscribers(payload: { title: string; body: string; url?: string }): Promise<void> {
  await ensureVapid();
  const rows = db.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions").all() as unknown as PushRow[];
  if (rows.length === 0) return;
  const body = JSON.stringify(payload);
  await Promise.all(rows.map((row) => pushToRow(row, body)));
}
