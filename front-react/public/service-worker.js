const CACHE_NAME = 'jako-danaya-cache-v2';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/assets/icons/jako_danya_logo.png',
  '/css/app.min.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
        return null;
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Navigation (le document HTML) : toujours essayer le réseau en premier. Avec
  // un cache-first pur ici, une fois "/" mis en cache une seule fois, chaque
  // déploiement ultérieur restait invisible indéfiniment (il fallait vider le
  // cache/forcer un rechargement à chaque fois) puisque l'entrée n'était plus
  // jamais revalidée. Le cache ne sert plus que de secours hors-ligne.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Fichiers statiques (bundles avec hash de contenu notamment) : cache d'abord,
  // sûr puisque leur nom change à chaque changement de contenu.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // only cache successful same-origin responses
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return response;
      });
    })
  );
});
