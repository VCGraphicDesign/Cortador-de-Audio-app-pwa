// Minimal Service Worker to enable PWA installability
const CACHE_NAME = 'audiocutter-pro-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
