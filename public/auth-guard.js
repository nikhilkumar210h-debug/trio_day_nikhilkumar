// Central authentication gate for protected Trio Day pages.
//
// Production serves pretty URLs (Cloudflare Workers static assets rewrite
// `/terms` → `/terms.html`), so the page name must be compared WITHOUT its
// extension. Comparing raw `pathname` against `terms.html` was why public pages
// such as /terms, /privacy, / and /activity-player redirected guests to login.
import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Pages reachable without an account. Names are extension-less and lower-case.
const PUBLIC_PAGES = new Set([
  '',                 // site root
  'index',            // Today (/) and the legacy `/today` pretty route
  'activity-player',  // guest trial: play a starter activity before signing in
  '404',
  'sitemap',
  'offline',
  'privacy',
  'privacy-policy',
  'terms',
  'help',             // Help Center: linked from every header, readable by guests
  'login'
]);

function pageName() {
  const last = (location.pathname.split('/').pop() || '').toLowerCase();
  return last.replace(/\.html$/, '');
}

let authResolved = false;

onAuthStateChanged(auth, (user) => {
  authResolved = true;
  const page = pageName();
  if (!user) {
    if (!PUBLIC_PAGES.has(page)) {
      const fullPage = (location.pathname.split('/').pop() || 'index.html') + (location.search || '');
      window.location.href = 'login.html?redirect=' + encodeURIComponent(fullPage);
      return;
    }
  }
  document.documentElement.classList.add('auth-ok');
  document.documentElement.classList.remove('auth-pending');

  // Session-wide self-heal (Phase 1): guarantee users/{uid} exists on every
  // authenticated session. Fire-and-forget — never blocks or diverts the gate.
  if (user) {
    void (async () => {
      try {
        const { ensureUserProfile } = await import('./services/userCache.js');
        await ensureUserProfile(user);
      } catch (_) { /* never blocks auth */ }
    })();
  }
});


// Fallback redirect ONLY if Firebase Auth never resolved (genuine init failure).
// If the listener already fired, it made the decision — never bounce a slow
// network session into a login redirect loop.
setTimeout(() => {
  if (authResolved) return;
  if (auth.currentUser) return;
  if (document.documentElement.classList.contains('auth-ok')) return;
  if (PUBLIC_PAGES.has(pageName())) return;
  window.location.href = 'login.html?redirect=' + encodeURIComponent((location.pathname.split('/').pop() || 'index.html') + location.search);
}, 15000);
