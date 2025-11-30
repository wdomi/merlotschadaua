// Name of cache
const CACHE_NAME = "merlotschadaua-cache-v1";

// Which requests to cache
const MAP_TILE_URL = "https://wmts.geo.admin.ch/";

// Install event
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(clients.claim());
});

// Intercept all network requests
self.addEventListener("fetch", event => {
  const req = event.request;
  const url = req.url;

  // Cache *only* map tiles + local static files
  const shouldCache =
    url.startsWith(MAP_TILE_URL) ||
    url.includes("/data/view_birdsCSV_apps.csv") ||
    url.endsWith("/index.html") ||
    url.endsWith("/app.js") ||
    url.endsWith("/manifest.json") ||
    url.endsWith(".png") ||
    url.endsWith(".jpg") ||
    url.endsWith(".css");

  if (!shouldCache) {
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      try {
        // Try online first
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        // Offline fallback
        const cached = await cache.match(req);
        if (cached) return cached;

        // No cached → fallback response
        return new Response("Offline and not cached.", { status: 503 });
      }
    })
  );
});
