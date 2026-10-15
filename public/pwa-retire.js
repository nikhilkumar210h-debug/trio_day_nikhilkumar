// Trio Day is a web app now, not an installable PWA.
// Remove any service worker/caches left behind by older PWA builds.
// NEVER unregister OneSignal workers — push notifications depend on them.
(() => {
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations.map(r => {
          const sw = r.active || r.installing || r.waiting;
          const scriptUrl = String(sw?.scriptURL || '').toLowerCase();
          const scope = String(r.scope || '').toLowerCase();
          const isOneSignal =
            scriptUrl.includes('onesignal') || scope.includes('onesignal') ||
            scriptUrl.includes('onesignalsdkworker') || scope.includes('onesignalsdkworker');
          if (isOneSignal) return null; // keep push notification workers registered
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
