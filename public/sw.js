const CACHE_NAME = 'trio-day-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/challenge.html',
  '/challenge-create.html',
  '/all-users.html',
  '/daily-questions.html',
  '/topics.html',
  '/about.html',
  '/help.html',
  '/manifest.json',
  '/styles/tokens.css',
  '/styles/components-unified.css',
  '/styles/layout-unified.css',
  '/styles/home.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/trio-day-logo.svg'
];

const CACHE_STRATEGIES = {
  // Static assets - cache first
  static: ['/styles/', '/icons/', '/fonts.googleapis.com'],
  // HTML pages - network first with cache fallback
  pages: ['.html'],
  // JS modules - stale while revalidate
  scripts: ['.js'],
  // API/Firestore - network only
  api: ['firebase', 'firestore', 'identitytoolkit']
};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http schemes
  if (!url.protocol.startsWith('http')) return;
  
  // Skip Firebase API calls - never cache
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('firestore') ||
      url.hostname.includes('identitytoolkit') ||
      url.hostname.includes('googleapis.com') ||
      url.pathname.includes('/api/')) {
    return;
  }
  
  // Skip OneSignal
  if (url.hostname.includes('onesignal')) {
    return;
  }
  
  // Determine strategy
  const pathname = url.pathname;
  let strategy = 'networkFirst';
  
  if (STATIC_ASSETS.some(asset => pathname.startsWith(asset))) {
    strategy = 'cacheFirst';
  } else if (CACHE_STRATEGIES.static.some(s => pathname.includes(s))) {
    strategy = 'cacheFirst';
  } else if (pathname.endsWith('.html')) {
    strategy = 'networkFirst';
  } else if (pathname.endsWith('.js')) {
    strategy = 'staleWhileRevalidate';
  } else if (pathname.endsWith('.css')) {
    strategy = 'staleWhileRevalidate';
  }
  
  event.respondWith(handleRequest(event.request, strategy));
});

async function handleRequest(request, strategy) {
  const cache = await caches.open(CACHE_NAME);
  
  switch (strategy) {
    case 'cacheFirst': {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        return new Response('Offline', { status: 503 });
      }
    }
    case 'networkFirst': {
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response(await cache.match('/index.html').then(r => r.text()), {
          headers: { 'Content-Type': 'text/html' },
          status: 200
        });
      }
    }
    case 'staleWhileRevalidate': {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    }
    default: return fetch(request);
  }
}

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-answers') {
    event.waitUntil(syncAnswers());
  }
});

async function syncAnswers() {
  // Would sync pending challenge answers when online
  console.log('[SW] Syncing pending answers...');
}

// Push notification handling
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: true
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        for (const client of clients) {
          if (client.url === url && 'focus' in client) return client.focus();
        }
        return clients.openWindow(url);
      })
  );
});

// Offline fallback page
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
  }
});