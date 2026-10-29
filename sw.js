const CACHE = 'soil-test-cache-v62';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./grain-delete-early.js','./sedimentation.js','./hydrometer-input.js','./sedimentation-cm-fix.js','./sedimentation-workbench.js','./sedimentation-workbench-focus-fix.js','./sedimentation-alarm.js','./sedimentation-auto-open.js','./grain-delete.js','./grain-charts.js','./fine-sieve.js','./dvalue-spline.js','./particle-density.js','./particle-density-common-temp.js','./pycnometer-master.js','./report-sheet.js','./report-ternary-fix.js','./atterberg-limits.js','./cone-index.js','./compaction.js','./mix-design.js','./mix-density-three.js','./mix-density-autofill.js','./mix-design-persist-fix.js','./report-extra-tests.js','./report-mix-design.js','./sample-manager.js','./atterberg-np.js','./review-all-tests.js','./mix-design-review.js','./mix-design-review-v2.js','./draft-save.js','./grain-wash-containers.js','./test-date.js','./numeric-input.js','./supabase-config.js','./cloud-share.js','./edit-lock.js','./project-test-plan.js','./input-usability.js','./project-completion.js','./project-workflow.js','./manifest.webmanifest','./icons/apple-touch-icon.png'];

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
        return response;
      }).catch(async () => {
        return await caches.match(event.request) || await caches.match('./index.html');
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

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async()=>{
    const all = await clients.matchAll({type:'window',includeUncontrolled:true});
    if(all.length){
      const client = all[0];
      await client.focus();
      if(event.notification?.data) client.postMessage({type:'soilnote-sed-alarm',...event.notification.data});
      return;
    }
    const client = await clients.openWindow('./');
    if(client && event.notification?.data) client.postMessage({type:'soilnote-sed-alarm',...event.notification.data});
  })());
});
