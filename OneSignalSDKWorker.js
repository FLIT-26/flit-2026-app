// FL!T 2026 — combined service worker.
// Handles OneSignal push/notificationclick AND the app-shell offline cache.
// IMPORTANT: this file must stay merged like this. If it's ever reverted to
// just the importScripts line below (OneSignal's plain default), or if a
// second separate service-worker.js is ever registered alongside it, the
// "notification click opens the installed app" behavior silently breaks —
// this has happened before in this project, so treat this file as sensitive
// to overwriting during future deploys/re-uploads.

importScripts("https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js");

/* ---------------- app shell offline cache ---------------- */

const CACHE_NAME = 'flit2026-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls (Google Apps Script) — always go to network.
  if (url.hostname.indexOf('script.google.com') !== -1) {
    return;
  }

  // Only handle same-origin GET requests for the app shell; everything else
  // (fonts, OneSignal SDK, etc.) passes straight through to the network.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
