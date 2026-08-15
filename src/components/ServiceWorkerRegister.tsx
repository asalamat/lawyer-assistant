"use client";

import { useEffect } from "react";

// Registered app-wide (not just when a user opts into push notifications
// in Settings > Security) so the browser's install-to-home-screen prompt
// sees an active service worker — Chrome's installability check requires
// one, even though this worker itself still does nothing but push
// delivery. Safe to call from both places: browsers dedupe by scriptURL.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a bonus, not a requirement — nothing depends on
        // this succeeding.
      });
    }
  }, []);
  return null;
}
