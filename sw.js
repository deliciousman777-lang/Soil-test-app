const CACHE = 'soil-test-cache-v21';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./sedimentation.js','./hydrometer-input.js','./sedimentation-cm-fix.js','./grain-charts.js','./fine-sieve.js','./dvalue-spline.js','./particle-density.js','./pycnometer-master.js','./report-sheet.js','./report-ternary-fix.js','./atterberg-limits.js','./cone-index.js','./report-extra-tests.js','./sample-manager.js','./manifest.webmanifest','./icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});