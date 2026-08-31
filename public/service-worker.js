const CACHE = 'pluto-v1.11.8';

const OFFLINE_SHELL = [
  '/',
  '/styles.css?v=1.11.8',
  '/settings.css?v=1.11.8',
  '/themes/pluto-1.8.0.css?v=1.11.8',
  '/theme.js?v=1.11.8',
  '/settings.js?v=1.11.8',
  '/whats-new.js?v=1.11.8',
  '/whats-new.css?v=1.11.8',
  '/app.js?v=1.11.8',
  '/js/game-ui.js?v=1.11.8',
  '/js/home-game-filter.js?v=1.11.8',
  '/manifest.webmanifest?v=1.11.8',
  '/icons/icon-192-v2.png',
  '/icons/icon-512-v2.png',
  '/icons/maskable-192-v2.png',
  '/icons/maskable-512-v2.png',
  '/assets/pluto-wallpaper.svg',
  '/assets/pluto-logo-v2.png',
  '/assets/pluto-logo-v2.png?v=1.11.8'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => (key.startsWith('minigames-') || key.startsWith('pluto-')) && key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function isCodeRequest(request, url) {
  return request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname === '/service-worker.js';
}

async function networkFirstNoStore(request) {
  try {
    // Critical: bypass the browser HTTP cache. This prevents an old PWA worker
    // from pinning an old HTML/JS/CSS release in a normal browser profile.
    const response = await fetch(request, { cache:'no-store' });
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request.mode === 'navigate' ? '/' : request, response.clone());
    }
    return response;
  } catch (_) {
    return (await caches.match(request.mode === 'navigate' ? '/' : request)) ||
      new Response('Offline', {status:503, headers:{'Content-Type':'text/plain'}});
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  if (isCodeRequest(request, url)) {
    event.respondWith(networkFirstNoStore(request));
    return;
  }

  // Images/assets may be cached normally; code never relies on these for versioning.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          caches.open(CACHE).then((cache) => cache.put(request, response.clone())).catch(() => {});
        }
        return response;
      });
      return cached || network;
    })
  );
});
