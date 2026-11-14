const CACHE_NAME = "orbitwell-shell-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/images/orbit-companion.png",
  "/images/nasa-spacewalk.jpg",
  "/models/human/body.glb",
  "/mediapipe/pose_landmarker_lite.task",
  "/mediapipe/vision_bundle.mjs",
  "/mediapipe/wasm/vision_wasm_module_internal.wasm",
  "/mediapipe/wasm/vision_wasm_internal.wasm",
  "/mediapipe/wasm/vision_wasm_module_internal.js",
  "/mediapipe/wasm/vision_wasm_internal.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && (request.destination === "script" || request.destination === "style" || request.destination === "image" || request.destination === "font" || url.pathname.startsWith("/assets/"))) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => request.mode === "navigate" ? caches.match("/index.html") : Response.error());
    })
  );
});
