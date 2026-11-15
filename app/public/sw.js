// Global Burn Log service worker: lets the site open offline and speeds up repeat visits.
// - pages (navigation): network first, fall back to the last cached copy, so a deploy shows up straight away online
// - hashed build files (/assets/): cache first, they never change
// - data and images: stale-while-revalidate, show the cached copy and refresh it in the background
// Bump VERSION to drop old caches.
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const DATA = `data-${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(["/", "/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![PAGES, STATIC, DATA].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(PAGES)).put(req.mode === "navigate" ? "/" : req, res.clone());
    return res;
  } catch {
    return (await caches.match(req.mode === "navigate" ? "/" : req)) || Response.error();
  }
}
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(STATIC)).put(req, res.clone());
  return res;
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(DATA);
  const hit = await cache.match(req);
  const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await fresh) || Response.error();
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // map tiles and the live alert file go straight to the network
  if (req.mode === "navigate") e.respondWith(networkFirst(req));
  else if (url.pathname.startsWith("/assets/")) e.respondWith(cacheFirst(req));
  else if (url.pathname.startsWith("/data/") || url.pathname.startsWith("/img/")) e.respondWith(staleWhileRevalidate(req));
});
