const CACHE_NAME = 'sarahperes-pages-v3';
const APP_SHELL = [
  './',
  './index.html',
  './sitepra.html',
  './hipofise-workspace.html',
  './mapa-estudo-editor.html',
  './gerador-estudo.html',
  './psiquiatria-estudo.html',
  './psiquiatria-print.html',
  './psiquiatria-editor.html',
  './hipofise-estudo.json',
  './psiquiatria-estudo.json',
  './questoes-hipofise.json',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

function isStaticAppAsset(request) {
  const url = new URL(request.url);
  if (url.origin !== location.origin) return false;
  return /\.(html|js|css|json)$/i.test(url.pathname);
}

async function networkFirst(request, fallbackPath = null) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackPath) {
      const fallback = await cache.match(fallbackPath);
      if (fallback) return fallback;
    }
    throw new Error('offline');
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({ error: { message: 'IA indisponivel offline.' } }), { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } })));
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, './index.html'));
    return;
  }
  if (isStaticAppAsset(event.request)) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && url.origin === location.origin) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  })));
});
