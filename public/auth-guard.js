// Central authentication gate for protected Trio Day pages.
import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const PUBLIC_PAGES = new Set([
  '404.html',
  'sitemap.html',
  'offline.html',
  'privacy.html',
  'privacy-policy.html'
]);

onAuthStateChanged(auth, (user) => {
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (!user) {
    if (!PUBLIC_PAGES.has(page)) {
      const fullPage = page + (location.search || '');
      window.location.href = 'login.html?redirect=' + encodeURIComponent(fullPage);
      return;
    }
  }
  document.documentElement.classList.add('auth-ok');
  document.documentElement.classList.remove('auth-pending');
});


setTimeout(() => {
  if (!document.documentElement.classList.contains('auth-ok') && location.pathname.split('/').pop() !== 'login.html') {
    window.location.href = 'login.html?redirect=' + encodeURIComponent((location.pathname.split('/').pop() || 'index.html') + location.search);
  }
}, 15000);
