const CACHE_NAME = 'sarahperes-pages-v2';
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
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
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
