// Minimal service worker whose only job is Web Push delivery — no offline
// caching, since this app always needs a live connection to the server
// anyway (it's not designed to work offline).
self.addEventListener("push", (event) => {
  let payload = { title: "Lawyer Assistant", body: "You have a new reminder." };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    // Malformed payload — fall back to the generic message above.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url || "/calendar" },
      icon: "/file.svg",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/calendar";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
