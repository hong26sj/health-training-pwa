const CACHE='health-training-pwa-v3';
const SHELL=['./','./index.html','./styles.css','./charts.css','./js/app.js','./js/data-source.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  event.respondWith(caches.match(req).then(cached=>{
    const fresh=fetch(req).then(res=>{if(res&&res.ok)caches.open(CACHE).then(c=>c.put(req,res.clone()));return res;}).catch(()=>cached);
    return cached||fresh;
  }));
});
