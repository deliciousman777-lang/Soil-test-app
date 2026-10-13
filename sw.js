const CACHE = 'soil-test-cache-v30';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./sedimentation.js','./hydrometer-input.js','./sedimentation-cm-fix.js','./grain-charts.js','./fine-sieve.js','./dvalue-spline.js','./particle-density.js','./pycnometer-master.js','./report-sheet.js','./report-ternary-fix.js','./atterberg-limits.js','./cone-index.js','./report-extra-tests.js','./sample-manager.js','./atterberg-np.js','./review-all-tests.js','./draft-save.js','./grain-wash-containers.js','./test-date.js','./numeric-input.js','./supabase-config.js','./cloud-sync.js','./manifest.webmanifest','./icons/apple-touch-icon.png'];

const CLOUD_SCRIPTS = '<script src="./supabase-config.js"></script><script src="./cloud-sync.js"></script>';

async function withCloudScripts(response) {
  if (!response) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const html = await response.text();
  if (html.includes('cloud-sync.js')) {
    return new Response(html, {status: response.status, statusText: response.statusText, headers: response.headers});
  }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  const next = html.includes('</body>') ? html.replace('</body>', `${CLOUD_SCRIPTS}</body>`) : html + CLOUD_SCRIPTS;
  return new Response(next, {status: response.status, statusText: response.statusText, headers});
}

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

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return withCloudScripts(response);
      }).catch(async () => {
        const cached = await caches.match(event.request) || await caches.match('./index.html');
        return withCloudScripts(cached);
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
