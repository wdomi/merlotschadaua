// Basic offline support + MapTiler tile caching

const APP_CACHE = "merlotschadaua-app-v2";
const TILE_CACHE = "merlotschadaua-tiles-v1";

const APP_ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/manifest.json",
  "/data/view_birdsCSV_apps.csv",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Install: cache core assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== APP_CACHE && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache MapTiler tiles + fallback for app shell
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // MapTiler tiles
  if (url.origin === "https://api.maptiler.com") {
    event.respondWith(
      caches.open(TILE_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        try {
          const response = await fetch(event.request);
          cache.put(event.request, response.clone());
          return response;
        } catch (err) {
          // if offline and nothing cached:
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // App core assets: network-first, fallback to cache
  if (APP_ASSETS.includes(url.pathname) || APP_ASSETS.includes("/" + url.pathname)) {
    event.respondWith(
      caches.open(APP_CACHE).then(async cache => {
        try {
          const fresh = await fetch(event.request);
          cache.put(event.request, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response("Offline", { status: 503 });
        }
      })
    );
    return;
  }

  // Default: try network, then cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
