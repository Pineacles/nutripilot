// NutriPilot service worker: installable app shell that still opens offline.
// API responses are never cached, so numbers on screen are always live.
// Registered as /sw.js?v=<build stamp>: every deploy installs a fresh worker and drops the old caches.
const VERSION = `nutripilot-${new URL(self.location.href).searchParams.get("v") || "dev"}`;
const SHELL = `${VERSION}-shell`;
const SHELL_URLS = ["/today", "/weekly", "/statistics", "/body", "/settings", "/foods", "/scanner", "/login", "/manifest.webmanifest", "/icons/icon.svg?v=2", "/icons/icon-192.png?v=2"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // One page failing must not block the install.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

// Network first, so a new deploy loads fresh HTML that points at the new JS.
async function page(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || (await cache.match("/today")) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;

  if (path.startsWith("/api/") || path === "/health" || path === "/docs" || path === "/openapi.json") return;
  // Content hashed file names, safe to keep until the next version.
  if (path.startsWith("/_next/static/") || path.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(page(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "CLEAR_CACHE") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});
