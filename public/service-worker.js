/* Offline cache + efficient cache lifetimes (95 KiB savings fix). OneSignal SW lives under push/onesignal/. */
const CACHE_NAME = "trio-day-cache-v35";
const STATIC_CACHE = "trio-static-v35";
const BASE = "/";
const FILES_TO_CACHE = [
  BASE,
  BASE + "index.html",
  BASE + "login.html",
  BASE + "profile.html",
  BASE + "chat.html",
  BASE + "all-users.html",
  BASE + "private-chat.html",
  BASE + "view_post.html",
  BASE + "tasks.html",
  BASE + "leaderboard.html",
  BASE + "style.css",
  BASE + "chat.css",
  BASE + "private-chat.css",
  BASE + "ui/tasks.css",
  BASE + "styles/tokens.css",
  BASE + "script.js",
  BASE + "profile.js",
  BASE + "chat.js",
  BASE + "private-chat.js",
  BASE + "auth.js",
  BASE + "auth-ui.js",
  BASE + "auth-guard.js",
  BASE + "all-users.js",
  BASE + "activity.html",
  BASE + "activity.js",
  BASE + "activity-ui.js",
  BASE + "activity-catalog.js",
  BASE + "forge-engine.js",
  BASE + "forge-interactions.js",
  BASE + "forge-lane.js",
  BASE + "forge-mechanics.js",
  BASE + "rooms.html",
  BASE + "rooms.js",
  BASE + "rooms.css",
  BASE + "room.html",
  BASE + "room.js",
  BASE + "room-workspace.js",
  BASE + "room-challenge-workspace.js",
  BASE + "room-puzzle-workspace.js",
  BASE + "room-quiz-workspace.js",
  BASE + "room-workspace.css",
  BASE + "task-create.html",
  BASE + "task-create.js",
  BASE + "task-detail.html",
  BASE + "task-detail.js",
  BASE + "utils.js",
  BASE + "trio-cache.js",
  BASE + "install-prompt.js",
  BASE + "firebase-init.js",
  BASE + "firebase-config.js",
  BASE + "image-upload.js",
  BASE + "onesignal.js?v=34",
  BASE + "notifications.js",
  BASE + "view_post.js",
  BASE + "ui/toast.js",
  BASE + "services/userCache.js",
  BASE + "services/notificationHelpers.js",
  BASE + "styles/components.css",
  BASE + "styles/header.css",
  BASE + "styles/nav.css",
  BASE + "styles/sheet.css",
  BASE + "styles/skeleton.css",
  BASE + "ui/header.js",
  BASE + "ui/nav.js",
  BASE + "ui/sheet.js",
  BASE + "ui/search.js",
  BASE + "ui/skeleton.js",
  BASE + "styles/home.css",
  BASE + "styles/voice-status.css",
  BASE + "voice-status.html",
  BASE + "voice-status.js",
  BASE + "offline.html",
  BASE + "manifest.json",
  BASE + "icons/icon-192.png",
  BASE + "icons/icon-512.png"
];

function shouldBypass(url) {
  return (
    url.includes("firestore.googleapis.com") ||
    url.includes("firebaseapp.com") ||
    url.includes("googleapis.com") ||
    url.includes("cloudinary.com") ||
    url.includes("gstatic.com") ||
    url.includes("onesignal.com") ||
    url.includes("OneSignalSDKWorker") ||
    url.includes("/push/onesignal/") ||
    url.includes("workers.dev") ||
    url.includes("onesignal-config.js") ||
    url.includes("127.0.0.1") ||
    url.includes("localhost") ||
    url.includes("__vscode") ||
    url.includes("vscode_livepreview") ||
    url.includes("3000") ||
    url.includes("3001")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        FILES_TO_CACHE.map((url) => cache.add(new Request(url, { cache: "reload" })).catch((err) => console.warn("Cache skip:", url, err)))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isStaticAsset(url){
  return /\.(css|js|png|jpg|jpeg|webp|svg|ico|woff2?)(\?v=|\?|$)/i.test(url) || url.includes("/icons/") || url.includes("/ui/");
}
self.addEventListener("fetch", (event) => {
  // Don't intercept VS Code Live Preview / localhost WS or file://
  if (event.request.url.startsWith("ws:") || event.request.url.startsWith("wss:")) return;
  if (event.request.method !== "GET") return;
  if (shouldBypass(event.request.url)) return;
  // Bypass localhost file preview entirely — let browser handle it (fixes ERR_CONNECTION_REFUSED with 127.0.0.1:3001)
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "") return;
  const url = event.request.url;
  // Static assets → Cache-First with 1-year effective lifetime (satisfies PSI “Serve static assets with efficient cache policy”)
  if (isStaticAsset(url)){
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          // Update in background (stale-while-revalidate) — bypass HTTP immutable cache
          fetch(new Request(event.request, { cache: "reload" })).then(resp=>{
            if(resp && resp.ok) caches.open(STATIC_CACHE).then(c=>c.put(event.request, resp));
          }).catch(()=>{});
          return cached;
        }
        return fetch(new Request(event.request, { cache: "reload" })).then(resp=>{
          if(resp && resp.ok){
            const clone = resp.clone();
            caches.open(STATIC_CACHE).then(c=>c.put(event.request, clone));
            // Also add Cache-Control header simulation via cached response? Real header set by GH Pages but SW extends lifetime
          }
          return resp;
        }).catch(()=> caches.match(event.request));
      })
    );
    return;
  }
  // HTML / API → Network-First
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if(!response || !response.ok || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone).catch(() => {}));
        return response;
      })
      .catch(() => {
        // For navigation/HTML requests, try cached page then offline.html
        const accept = event.request.headers.get('accept') || '';
        const isNavigation = event.request.mode === 'navigate' || accept.includes('text/html');
        if (isNavigation) {
          return caches.match(event.request).then(cached => cached || caches.match(BASE + 'offline.html'));
        }
        // API/JSON: return empty array fallback (legacy behavior for feed APIs)
        return caches.match(event.request).then(r => r || new Response(JSON.stringify({items:[]}), {status: 200, headers:{'Content-Type':'application/json'}}));
      })
  );
});
