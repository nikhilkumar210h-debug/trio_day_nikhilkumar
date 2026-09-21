// ui/nav.js — Trio Day global navigation
// Canonical items: Today / Discover / Challenge / Chat / You
// Mobile: 5-item bottom nav.
// Desktop: left rail (icons at tablet, expanded at wide).

const SVG = {
  today: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
  discover: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>`,
  do: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>`,
  chat: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-4-.9L4 20l1.4-3.1A7.3 7.3 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/></svg>`,
  you: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="8" r="4"/><path d="M4 19a8 8 0 0 1 16 0"/></svg>`,
};

const ITEMS = [
  { key: 'today', label: 'Today', href: 'index.html', icon: SVG.today },
  { key: 'discover', label: 'Discover', href: 'all-users.html', icon: SVG.discover },
  { key: 'challenge', label: 'Challenge', href: 'challenge.html', icon: SVG.do },
  { key: 'chat', label: 'Chat', href: 'chat.html', icon: SVG.chat },
  { key: 'you', label: 'You', href: 'profile.html', icon: SVG.you }
];

function pathKey() {
  const p = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (p === '' || p === 'index.html' || p === 'view_post.html') return 'today';
  if (p === 'challenge.html' || p === 'task-create.html' || p === 'tasks.html' || p === 'task-detail.html') return 'challenge';
  if (p === 'all-users.html' || p === 'build.html' || p === 'learn.html' || p === 'puzzle.html' || p === 'activity.html' || p === 'rooms.html' || p === 'room.html') return 'discover';
  if (p === 'chat.html' || p === 'private-chat.html') return 'chat';
  if (p === 'profile.html') return 'you';
  return '';
}

const AUTH_PAGES = new Set(['login.html', '404.html', 'sitemap.html', 'offline.html']);

function linkMarkup(i, active, attrName = 'data-nav') {
  const isActive = i.key === active;
  const cls = 'nav-btn' + (isActive ? ' active' : '');
  const current = isActive ? ' aria-current="page"' : '';
  return `<a class="${cls}" href="${i.href}" ${attrName}="${i.key}" aria-label="${i.label}"${current}><span class="nav-icon">${i.icon}</span><span class="nav-label">${i.label}</span></a>`;
}

export function renderNav() {
  const p = (location.pathname.split('/').pop() || '').toLowerCase();
  if (AUTH_PAGES.has(p)) return;
  const active = pathKey();
  document.body.dataset.currentNav = active;

  const bottom = document.querySelector('.bottom-nav');
  if (bottom) {
    const row = bottom.querySelector('.nav-row') || bottom;
    const existing = row.querySelectorAll('[data-nav]');
    const hasCorrectStructure = existing.length === ITEMS.length && [...existing].every((el, idx) => el.dataset.nav === ITEMS[idx].key);
    if (!hasCorrectStructure) {
      row.innerHTML = ITEMS.map(i => linkMarkup(i, active)).join('');
    } else {
      row.querySelectorAll('.nav-btn').forEach(el => {
        const isActive = el.dataset.nav === active;
        el.classList.toggle('active', isActive);
        if (isActive) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
      });
    }
  } else {
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('aria-label', 'Primary navigation');
    nav.innerHTML = `<div class="nav-row">${ITEMS.map(i => linkMarkup(i, active)).join('')}</div>`;
    document.body.appendChild(nav);
  }

  if (!document.querySelector('.nkm-rail')) {
    const rail = document.createElement('nav');
    rail.className = 'nkm-rail';
    rail.setAttribute('aria-label', 'Primary navigation');
    rail.innerHTML = ITEMS.map(i => linkMarkup(i, active, 'data-rail')).join('');
    document.body.appendChild(rail);
  }
}

export function navHtml(active = '') {
  return `<nav class="bottom-nav" aria-label="Primary navigation"><div class="nav-row">${ITEMS.map(i => linkMarkup(i, active)).join('')}</div></nav>`;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderNav);
else renderNav();
