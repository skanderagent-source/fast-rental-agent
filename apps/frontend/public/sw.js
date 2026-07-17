self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Keep requests network-first so authenticated data is never stored by the PWA.
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method === 'GET' && requestUrl.origin === self.location.origin) {
    event.respondWith(fetch(event.request));
  }
});
