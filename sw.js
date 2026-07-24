/* sw.js — Service worker offline.
   Stratégie : NETWORK-FIRST pour le code de l'app (HTML/JS/CSS/JSON) → toujours la
   dernière version quand en ligne, cache en secours hors-ligne. CACHE-FIRST pour les
   icônes/images (stables). Les données utilisateur vivent dans IndexedDB, jamais dans
   le cache — rien à synchroniser, une mise à jour ne touche pas l'historique. */
const CACHE = 'chrono-v11';
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

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

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
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // laisse passer le cross-origin

  const keep = (res) => { if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };
  const isShell = req.mode === 'navigate' || /\.(?:js|css|json|html)$/.test(url.pathname);

  if (isShell) {
    // network-first : la dernière version en priorité, cache si hors-ligne
    e.respondWith(fetch(req).then(keep).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))));
  } else {
    // cache-first : icônes/images stables
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(keep)));
  }
});
