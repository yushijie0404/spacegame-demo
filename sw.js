const CACHE_NAME='spacegame-v1.45.10';
const MUSIC_CACHE_NAME='spacegame-music-runtime-v2';
const APP_SHELL=['./','./index.html','./game-loader.js','./runtime-performance.js','./game-audio.js','./game-missions.js','./game-orbit.js','./game-progression.js','./game-achievements.js','./game-i18n.js','./game-display.js','./game-layout.js','./game-ship-skins.js','./game-ship-skills.js','./game-special-worlds.js','./game-guides.js','./game-flight-physics.js','./game-objectives.js','./game-input.js','./game-art.js','./game-world-scenes.js','./game-hud.js','./manifest.webmanifest','./assets/ships/star-courier-overhead.png','./assets/ships/feitian-one-overhead.png','./assets/ships/hyperion-cartoon-overhead.png','./assets/ships/waterdrop-overhead.png','./icons/app-icon.svg','./icons/app-icon-180.png','./icons/app-icon-192.png','./icons/app-icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME&&key!==MUSIC_CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET' || new URL(event.request.url).origin!==self.location.origin) return;
  const url=new URL(event.request.url),isMusic=/\/music\/[^/]+\.mp3$/i.test(url.pathname);
  if(isMusic){
    // Mobile media engines request MP3 byte ranges. A cached 206 response is
    // only one fragment; reusing it as the complete file makes Safari/Chrome
    // report a MediaError. Keep range traffic on the network and cache only a
    // complete 200 response for offline fallback.
    if(event.request.headers.has('range')){event.respondWith(fetch(event.request));return;}
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          if(response.status===200){const copy=response.clone();caches.open(MUSIC_CACHE_NAME).then(cache=>cache.put(event.request,copy));}
          return response;
        })
        .catch(()=>caches.match(event.request).then(cached=>cached||Response.error()))
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then(response=>{
        if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
        return response;
      })
      .catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html')))
  );
});
