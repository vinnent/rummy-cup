/* Keeps Rummy Cup Samen on the device so it opens without internet.
   Only answers for its own files: other apps on this site have their own copy-keeper. */
const PREFIX = 'rummy-';
const APP = PREFIX + 'app-2-hout';
const FONTS = PREFIX + 'fonts';
const SHELL = ["./", "index.html", "manifest.webmanifest", "wood.jpg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const OWN = new Set(SHELL.map(p => new URL(p, self.registration.scope).pathname));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX + 'app-') && k !== APP).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  /* Google Fonts: keep the first copy, so the letters look the same offline. */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }
      catch (err) { return new Response('', { status: 504 }); }
    }));
    return;
  }
  if (url.origin !== location.origin || !OWN.has(url.pathname)) return;
  /* Answer from the device at once; when online, fetch a fresh copy for next time. */
  e.respondWith(caches.open(APP).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    return (await fresh) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
