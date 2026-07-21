/* sw.js — Service worker : cache l'app shell pour un fonctionnement 100% hors-ligne.
   Stratégie : cache-first pour les assets de l'app, réseau en secours. Les données
   utilisateur vivent dans IndexedDB (jamais dans le cache), donc rien à synchroniser. */
const CACHE = 'chrono-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/data.js',
  './js/illustrations.js',
  './js/store.js',
  './js/logic.js',
  './js/ui.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      // met en cache les nouveaux GET same-origin réussis
      if (res && res.status === 200 && new URL(req.url).origin === self.location.origin) {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
