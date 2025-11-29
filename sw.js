// sw.js – very simple service worker for offline caching
const CACHE_NAME = "merlotschadaua-v1";
const OFFLINE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/sw.js",
  "/data/view_birdsCSV_apps.csv"
  // Add icons etc. here if you like:
  // "/icons/icon-192.png",
  // "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Network-first for dynamic requests to /api, cache-first for others
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Don't cache Vercel API calls
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((resp) => {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, respClone);
          });
          return resp;
        })
        .catch(() => {
          // Offline and not in cache -> maybe fallback later
          return cached || new Response("Offline", { status: 503 });
        });
    })
  );
});
