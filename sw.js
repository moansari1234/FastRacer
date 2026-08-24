const CACHE = "nitroapex-v1";
/*PRECACHE_START*/
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./css/style.css",
  "./assets/fonts/orbitron-900.woff2",
  "./assets/fonts/orbitron-600.woff2",
  "./assets/fonts/rajdhani-500.woff2",
  "./assets/fonts/rajdhani-600.woff2",
  "./assets/fonts/rajdhani-700.woff2",
  "./vendor/three.module.js",
  "./src/main.js",
  "./src/utils.js",
  "./src/core/save.js",
  "./src/core/input.js",
  "./src/core/audio.js",
  "./src/data/cars.js",
  "./src/data/tracks.js",
  "./src/world/trackData.js",
  "./src/world/trackScene.js",
  "./src/world/environment.js",
  "./src/physics/vehicleCore.js",
  "./src/render/vehicleView.js",
  "./src/ai/driver.js",
  "./src/fx/particles.js",
  "./src/fx/cameraRig.js",
  "./src/game/race.js",
  "./src/ui/hud.js",
  "./src/ui/screens.js"
];
/*PRECACHE_END*/

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
