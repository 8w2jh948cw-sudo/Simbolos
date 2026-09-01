const CACHE_PREFIX="simbolos-";
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
  try{const keys=await caches.keys();await Promise.allSettled(keys.filter(k=>k.startsWith(CACHE_PREFIX)).map(k=>caches.delete(k)));}catch{}
  try{await self.registration.unregister();}catch{}
  try{await self.clients.claim();}catch{}
})()));
