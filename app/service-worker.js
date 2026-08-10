const CACHE='vipoap-app-v13';
const ASSETS=['/app/','/app/index.html','/app/account','/app/booking-payment.js','/app/booking-help.js','/app/payment-checkout.js','/app/account-link.js','/app/account-help.js','/app/account-home.js','/app/manifest.webmanifest','/assets/connectivity.js','/assets/fonts.css','/assets/fonts/quicksand-latin.woff2','/assets/vipoap-heart-transparent.png','/assets/icon-192.png?v=3','/assets/icon-512.png?v=3'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(new URL(event.request.url).pathname.startsWith('/api/'))return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(r=>r||caches.match('/app/'))));
});
