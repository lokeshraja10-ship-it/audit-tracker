// This app's data is always live from Firestore, so this service worker doesn't
// cache anything — its only job is to exist and handle fetch events, which is
// what Chrome/Android require before offering the "Install app" prompt.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
