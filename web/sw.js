/* PV Modül Tasarım service worker: çevrimdışı çalışma */
const VERSION='pvm-v2';
const CORE=['/','/app/','/manifest.webmanifest','/assets/css/app.css','/assets/css/site.css',
  '/assets/js/library.js','/assets/js/engine.js','/assets/js/app.js','/assets/js/libview.js','/assets/js/pwa.js','/assets/js/drawing.js','/assets/js/site.js',
  '/assets/vendor/xlsx.full.min.js','/assets/icons/icon.svg','/assets/icons/icon-192.png','/assets/icons/icon-512.png','/assets/icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION&&!k.startsWith('fonts')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.host==='fonts.googleapis.com'||url.host==='fonts.gstatic.com'){
    e.respondWith(caches.open('fonts').then(async c=>{const hit=await c.match(req);const net=fetch(req).then(r=>{c.put(req,r.clone());return r;}).catch(()=>hit);return hit||net;}));return;}
  if(url.origin!==location.origin)return;
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(VERSION).then(c=>c.put(req,cp));return r;}).catch(async()=>(await caches.match(req))||(await caches.match(url.pathname.startsWith('/app')?'/app/':'/'))));return;}
  // stale-while-revalidate: önbellekten hızlı aç, arka planda güncelle
  e.respondWith(caches.open(VERSION).then(async c=>{const hit=await c.match(req);
    const net=fetch(req).then(r=>{if(r.ok)c.put(req,r.clone());return r;}).catch(()=>hit);
    if(hit){e.waitUntil(net);return hit;}return net;}));
});
