"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "unsupported" | "subscribed" | "unsubscribed" | "denied";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Url);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export default function PushNotificationSettings() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Inlined .then() chain rather than a named async function in the
    // effect body, and no synchronous setState calls before the first
    // await — same set-state-in-effect lint workaround used in
    // NotificationBell.tsx.
    Promise.resolve().then(() => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return Promise.resolve();
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return Promise.resolve();
      }
      return navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setStatus(subscription ? "subscribed" : "unsubscribed"))
        .catch(() => setStatus("unsubscribed"));
    });
  }, []);

  async function handleEnable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const { publicKey } = await fetch("/api/push/vapid-public-key").then((res) => res.json());
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      setStatus("subscribed");
    } catch {
      setError("Couldn't enable browser notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("unsubscribed");
    } catch {
      setError("Couldn't disable browser notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Browser notifications</p>
      {status === "unsupported" && (
        <p className="text-sm text-muted">This browser doesn&apos;t support push notifications.</p>
      )}
      {status === "denied" && (
        <p className="text-sm text-muted">
          Notifications are blocked for this site in your browser settings — enable them there to use this feature.
        </p>
      )}
      {status === "unsubscribed" && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted">Get a browser notification for deadline and event reminders on this device.</p>
          <button onClick={handleEnable} disabled={busy} className="btn-secondary shrink-0 text-sm">
            Enable
          </button>
        </div>
      )}
      {status === "subscribed" && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted">Enabled on this device.</p>
          <button onClick={handleDisable} disabled={busy} className="btn-secondary shrink-0 text-sm">
            Disable
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
