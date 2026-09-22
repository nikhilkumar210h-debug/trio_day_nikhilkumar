// Trio Day is a web app now, not an installable PWA.
// Remove any service worker/caches left behind by older PWA builds.
(() => {
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations.map(r => r.unregister())))
        .catch(() => {});
    }
    if ('caches' in window) {
      caches.keys()
        .then(keys => Promise.all(keys.map(key => caches.delete(key))))
        .catch(() => {});
    }
  } catch (_) {}
})();
