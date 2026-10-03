// Central authentication gate for protected Trio Day pages.
import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const PUBLIC_PAGES = new Set([
  '404',
  'sitemap',
  'offline',
  'privacy',
  'privacy-policy',
  'terms',
  'index',
  'login'
]);

function normalizePage(path) {
  return (path.split('/').pop() || 'index').replace(/\.html$/i, '').toLowerCase();
}

onAuthStateChanged(auth, (user) => {
  const page = normalizePage(location.pathname);
  if (!user) {
    if (!PUBLIC_PAGES.has(page)) {
      const fullPage = (location.pathname.split('/').pop() || 'index') + (location.search || '');
      window.location.href = 'login.html?redirect=' + encodeURIComponent(fullPage);
      return;
    }
  }
  document.documentElement.classList.add('auth-ok');
  document.documentElement.classList.remove('auth-pending');
});


setTimeout(() => {
  if (!document.documentElement.classList.contains('auth-ok') && normalizePage(location.pathname) !== 'login') {
    const fullPage = (location.pathname.split('/').pop() || 'index') + (location.search || '');
    window.location.href = 'login.html?redirect=' + encodeURIComponent(fullPage);
  }
}, 15000);
