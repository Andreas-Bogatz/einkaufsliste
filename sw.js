'use strict';

// Increase when changing the program-cache structure or caching strategy.
// HTML updates are fetched on every navigation, even without a version bump.
const CACHE_PREFIX = 'einkauf-program-' + self.registration.scope + '-';
const CACHE_NAME = CACHE_PREFIX + 'v1';
const appURL = path => new URL(path, self.registration.scope).href;
const INDEX_URL = appURL('./index.html');
const PROGRAM_URLS = [
  INDEX_URL,
  appURL('./manifest.webmanifest'),
  appURL('./icons/apple-touch-icon.png'),
  appURL('./icons/icon-192.png'),
  appURL('./icons/icon-512.png')
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PROGRAM_URLS.map(url => new Request(url, {cache: 'no-store'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Only the app entry points and this exact list of static files are cached.
  const isEntry = url.origin === self.location.origin &&
    (url.pathname === new URL(self.registration.scope).pathname ||
     url.pathname === new URL(INDEX_URL).pathname);
  const key = isEntry ? INDEX_URL : url.href;
  if (!PROGRAM_URLS.includes(key)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // Bypass the HTTP cache, including for HTML-only deployments.
      const response = await fetch(event.request, {cache: 'no-store'});
      if (!response.ok || response.type === 'opaque') throw new Error('Program resource unavailable');
      // A full program cache must not prevent the online app from starting.
      try { await cache.put(key, response.clone()); } catch (error) { console.warn(error); }
      return response;
    } catch (error) {
      const cached = await cache.match(key);
      if (cached) return cached;
      throw error;
    }
  })());
});
