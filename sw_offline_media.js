/* sw_offline_media.js — on-demand media caching for Lunasonic Mobile Player (backdrop build) */
const CACHE_APP = "luna-mapp-backdrop-v1";
const CACHE_MEDIA = "luna-media-v1";
const APP_SHELL = ["./", "./lunasonic_mobile_player_backdrop.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_APP).then(c=>c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k===CACHE_APP || k===CACHE_MEDIA) ? null : caches.delete(k)));
    self.clients.claim();
  })());
});

function sameOrigin(req){ try{ return new URL(req.url).origin === self.location.origin; }catch(e){ return false; } }
function isAPI(req){ try{ return new URL(req.url).pathname.startsWith("/api/tree"); }catch(e){ return false; } }
function isMedia(req){ try{ return new URL(req.url).pathname.startsWith("/media/"); }catch(e){ return false; } }

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if(!sameOrigin(req)) return;

  if (isAPI(req)) {
    event.respondWith((async()=>{
      try{
        const fresh = await fetch(req, {cache:"no-store"});
        const cache = await caches.open(CACHE_APP);
        cache.put(req, fresh.clone());
        return fresh;
      }catch(e){
        const cached = await caches.match(req);
        if (cached) return cached;
        throw e;
      }
    })());
    return;
  }

  if (isMedia(req)) {
    event.respondWith((async()=>{
      const cached = await caches.match(req);
      if (cached) return cached;
      return fetch(req);
    })());
    return;
  }

  // App shell: cache-first
  event.respondWith((async()=>{
    const cached = await caches.match(req);
    if (cached) return cached;
    try{
      const res = await fetch(req);
      if (req.method==="GET" && res && res.ok) {
        const cache = await caches.open(CACHE_APP);
        cache.put(req, res.clone());
      }
      return res;
    }catch(e){
      if (req.mode==="navigate") return caches.match("./lunasonic_mobile_player_backdrop.html");
      throw e;
    }
  })());
});

self.addEventListener("message", async (event) => {
  const data = event.data || {};
  if (data.type === "CACHE_MEDIA" && data.url) {
    try{
      const res = await fetch(data.url, {cache:"no-store"});
      if (!res.ok) throw new Error("HTTP "+res.status);
      const cache = await caches.open(CACHE_MEDIA);
      await cache.put(new Request(data.url), res.clone());
      event.ports[0] && event.ports[0].postMessage({ok:true});
    }catch(err){
      event.ports[0] && event.ports[0].postMessage({ok:false, error:String(err)});
    }
  }
});
