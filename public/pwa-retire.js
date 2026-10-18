// Trio Day is a web app now, not an installable PWA.
// Remove any service worker/caches left behind by older PWA builds.
(() => {
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations.map(r => {
          // Preserve OneSignal's push service worker
          if (r.scope.includes('OneSignalSDKWorker') || r.scope.includes('/push/onesignal/')) {
            console.debug('[pwa-retire] Preserving OneSignal Service Worker:', r.scope);
            return Promise.resolve();
          }
          return r.unregister();
        })))
        .catch(() => {});
    }
    if ('caches' in window) {
      caches.keys()
        .then(keys => Promise.all(keys.map(key => caches.delete(key))))
        .catch(() => {});
    }
  } catch (_) {}
})();

