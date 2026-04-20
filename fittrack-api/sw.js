// FitTrack Service Worker v4 — bump version to force cache refresh
const CACHE = "fittrack-v4";
const PAGES = [
  "/login.html","/dashboard.html","/start-activity.html",
  "/save-activity.html","/activity-history.html","/squad.html",
  "/live-tracker-neon.html","/map-viewer.html"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PAGES.map(p => c.add(p).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // API — network only, offline error if no connection
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: "You are offline" }), {
          headers: { "Content-Type": "application/json" }
        })
      )
    );
    return;
  }

  // HTML pages — network first, cache fallback (skip caching login so form works fresh)
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (!url.pathname.includes("login")) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request) || caches.match("/login.html"))
    );
    return;
  }

  // Static assets — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
