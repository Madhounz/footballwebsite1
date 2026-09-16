/**
 * ninety's service worker.
 *
 * A scores site must never show a stale score, so nothing here is cache-first
 * except things that cannot change: the hashed build assets and the brand
 * files. Pages go to the network first and only fall back to what was seen
 * before when the network fails — which is the whole point on a phone that
 * drops to nothing in a lift or on a train.
 *
 * Written by hand rather than generated: it is sixty lines, and a caching bug
 * here shows people yesterday's result, which is the one thing this site is
 * supposed to be right about.
 */
const VERSION = "v1";
const STATIC = `ninety-static-${VERSION}`;
const PAGES = `ninety-pages-${VERSION}`;
const DATA = `ninety-data-${VERSION}`;
const OFFLINE = "/offline.html";
/** Pages kept for offline reading; oldest go first. */
const PAGE_LIMIT = 40;
/** How long to wait for the network before showing what we already have. */
const NETWORK_TIMEOUT_MS = 3500;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((cache) => cache.addAll([OFFLINE, "/icons/icon-192.png", "/brand/mark.svg"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC, PAGES, DATA]);
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/** Keeps a cache from growing without end. */
async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(key);
}

async function fromNetworkFirst(request, cacheName, { fallback, keepAnyway = false } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok && response.type === "basic") {
      // Pages carry `no-store`, because a scores page must never be served
      // stale by a browser or a proxy. That instruction is about being online:
      // this copy is only ever read when the network has already failed, which
      // is the one moment yesterday's page beats a blank screen. Anything else
      // — the API — is taken at its word.
      const noStore = (response.headers.get("cache-control") ?? "").includes("no-store");
      if (keepAnyway || !noStore) {
        cache.put(request, response.clone()).then(() => trim(cacheName, PAGE_LIMIT));
      }
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallback) {
      const offline = await caches.match(fallback);
      if (offline) return offline;
    }
    throw new Error("offline and nothing cached");
  }
}

async function fromCacheFirst(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the refresh endpoint, and never answer it from a cache.
  if (url.pathname.startsWith("/api/sync")) return;

  // App Router navigations fetch a payload rather than a document. Serving one
  // of those from a cache next to fresh HTML mixes two versions of the page, so
  // they always go to the network.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  // Build output is content-hashed: if the URL is the same, so are the bytes.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/")
  ) {
    event.respondWith(fromCacheFirst(request));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fromNetworkFirst(request, DATA));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fromNetworkFirst(request, PAGES, { fallback: OFFLINE, keepAnyway: true }));
  }
});
