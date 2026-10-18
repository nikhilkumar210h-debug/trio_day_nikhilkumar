// ui/nav.js — Trio Day global navigation
// Canonical items: Today / Leaderboard / Chat / You / Admin (admin only shows for admin users)
// Mobile: 5-item bottom nav.
// Desktop: left rail (icons at tablet, expanded at wide).

const SVG = {
  today: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
  leaderboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 20V8"/><path d="M18 20V10"/><path d="M6 20V14"/><path d="M2 18h20"/></svg>`,
  chat: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-4-.9L4 20l1.4-3.1A7.3 7.3 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/></svg>`,
  you: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="8" r="4"/><path d="M4 19a8 8 0 0 1 16 0"/></svg>`,
  admin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>`,
};

// Base items (always visible)
const BASE_ITEMS = [
  { key: 'today', label: 'Today', href: 'index.html', icon: SVG.today },
  { key: 'leaderboard', label: 'Leaderboard', href: 'leaderboard.html', icon: SVG.leaderboard },
  { key: 'chat', label: 'Chat', href: 'chat.html', icon: SVG.chat },
  { key: 'you', label: 'You', href: 'profile.html', icon: SVG.you },
];

// Admin item (conditionally added)
const ADMIN_ITEM = { key: 'admin', label: 'Admin', href: 'admin-activity.html', icon: SVG.admin };

const AUTH_PAGES = new Set(['login.html', '404.html', 'offline.html']);

let isAdmin = false;

function pathKey() {
  const raw = (location.pathname || '/').replace(/\/+$/, '') || '/';
  const p = raw.split('/').pop().toLowerCase();
  if (p === '' || p === 'index' || p === 'index.html' || p === 'today') return 'today';
  if (p === 'leaderboard' || p === 'leaderboard.html') return 'leaderboard';
  if (p === 'chat' || p === 'chat.html' || p === 'private-chat' || p === 'private-chat.html') return 'chat';
  if (p === 'profile' || p === 'profile.html' || p === 'you') {
    // Check if viewing another user's profile via uid parameter
    const params = new URLSearchParams(location.search);
    const uid = params.get('uid');
    // If uid is present and different from current user, don't mark "You" as active
    // The current user's uid would need to be available globally or passed in
    // For now, we'll check if there's a uid param at all - if so, it's likely another user's profile
    if (uid) return '';
    return 'you';
  }
  if (p === 'admin-activity' || p === 'admin-activity.html' || p === 'admin-tasks' || p === 'admin-tasks.html' || p === 'admin') return 'admin';
  return '';
}

function getCurrentItems() {
  return isAdmin ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;
}

function linkMarkup(item, active, attrName = 'data-nav') {
  const isActive = item.key === active;
  const cls = 'nav-btn' + (isActive ? ' active' : '');
  const current = isActive ? ' aria-current="page"' : '';
  return `<a class="${cls}" href="${item.href}" ${attrName}="${item.key}" aria-label="${item.label}"${current}><span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span></a>`;
}

function applyActiveState(root, active) {
  root.querySelectorAll('.nav-btn[data-nav], .nav-btn[data-rail]').forEach(el => {
    const isActive = el.dataset.nav === active || el.dataset.rail === active;
    el.classList.toggle('active', isActive);
    el.dataset.active = isActive ? 'true' : 'false';
    if (isActive) {
      el.setAttribute('aria-current', 'page');
      el.style.setProperty('color', '#F5F3FF', 'important');
      el.style.setProperty('background', 'linear-gradient(135deg, rgba(139,92,246,.42), rgba(99,102,241,.30))', 'important');
      el.style.setProperty('border-color', 'rgba(196,181,253,.46)', 'important');
      el.style.setProperty('box-shadow', 'inset 0 0 0 1px rgba(237,233,254,.10), 0 0 0 1px rgba(139,92,246,.12), 0 8px 24px rgba(99,102,241,.22)', 'important');
    } else {
      el.removeAttribute('aria-current');
      el.style.removeProperty('color');
      el.style.removeProperty('background');
      el.style.removeProperty('border-color');
      el.style.removeProperty('box-shadow');
    }
  });
}

function forceNavVisibility(el) {
  if (!el) return;
  el.hidden = false;
  const desktop = window.matchMedia('(min-width: 840px)').matches;
  const isRail = el.classList.contains('nkm-rail');
  el.style.setProperty('display', isRail ? (desktop ? 'flex' : 'none') : (desktop ? 'none' : 'flex'), 'important');
  el.style.setProperty('visibility', 'visible', 'important');
  el.style.setProperty('opacity', '1', 'important');
  el.style.setProperty('pointer-events', 'auto', 'important');
}

export function setAdminFlag(flag) {
  isAdmin = !!flag;
  renderNav();
}

export function renderNav() {
  const p = (location.pathname.split('/').pop() || '').toLowerCase();
  if (AUTH_PAGES.has(p)) return;
  const active = pathKey();
  document.body.dataset.currentNav = active;

  const items = getCurrentItems();

  const bottom = document.querySelector('.bottom-nav');
  if (bottom) {
    const row = bottom.querySelector('.nav-row') || bottom;
    const existing = row.querySelectorAll('[data-nav]');
    const hasCorrectStructure = existing.length === items.length && [...existing].every((el, idx) => el.dataset.nav === items[idx].key);
    if (!hasCorrectStructure) {
      row.innerHTML = items.map(i => linkMarkup(i, active)).join('');
    } else {
      applyActiveState(row, active);
    }
  } else {
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('aria-label', 'Primary navigation');
    nav.innerHTML = `<div class="nav-row">${items.map(i => linkMarkup(i, active)).join('')}</div>`;
    document.body.appendChild(nav);
  }

  if (!document.querySelector('.nkm-rail')) {
    const rail = document.createElement('nav');
    rail.className = 'nkm-rail';
    rail.setAttribute('aria-label', 'Primary navigation');
    rail.innerHTML = items.map(i => linkMarkup(i, active, 'data-rail')).join('');
    document.body.appendChild(rail);
  }

  const bottomRoot = document.querySelector('.bottom-nav');
  const railRoot = document.querySelector('.nkm-rail');
  if (bottomRoot) { applyActiveState(bottomRoot, active); forceNavVisibility(bottomRoot); }
  if (railRoot) { applyActiveState(railRoot, active); forceNavVisibility(railRoot); }
}

export function navHtml(active = '') {
  const items = getCurrentItems();
  return `<nav class="bottom-nav" aria-label="Primary navigation"><div class="nav-row">${items.map(i => linkMarkup(i, active)).join('')}</div></nav>`;
}

function bootNav() {
  try { renderNav(); } catch (error) { console.warn('[Trio Nav] render failed', error); }
  window.setTimeout(() => { try { renderNav(); } catch (error) { console.warn('[Trio Nav] retry failed', error); } }, 0);
  window.setTimeout(() => { try { renderNav(); } catch (error) { console.warn('[Trio Nav] delayed retry failed', error); } }, 250);
  window.setTimeout(() => { try { renderNav(); } catch (error) { console.warn('[Trio Nav] recovery render failed', error); } }, 1000);
  window.addEventListener('resize', () => renderNav(), { passive: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootNav);
else bootNav();