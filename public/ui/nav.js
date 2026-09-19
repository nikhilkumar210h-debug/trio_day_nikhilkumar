// ui/nav.js — Trio Day global navigation
// Canonical items: Today / Discover / Chat / You.
// Challenges live in Discover; the old Do surface is no longer a primary destination.

const SVG = {
  today: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  discover: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>',
  chat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  you: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="8" r="4"/><path d="M4 19a8 8 0 0 1 16 0"/></svg>',
  create: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>'
};

const ITEMS = [
  { key: 'today', label: 'Today', href: 'index.html', icon: SVG.today },
  { key: 'discover', label: 'Discover', href: 'all-users.html', icon: SVG.discover },
  { key: 'chat', label: 'Chat', href: 'chat.html', icon: SVG.chat },
  { key: 'you', label: 'You', href: 'profile.html', icon: SVG.you }
];

function pathKey() {
  const p = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (p === '' || p === 'index.html' || p === 'view_post.html') return 'today';
  if (p === 'all-users.html' || p === 'tasks.html' || p === 'task-create.html' || p === 'task-detail.html' || p === 'leaderboard.html' || p === 'admin-tasks.html') return 'discover';
  if (p === 'chat.html' || p === 'private-chat.html') return 'chat';
  if (p === 'profile.html') return 'you';
  return 'today';
}

const AUTH_PAGES = new Set(['login.html', '404.html', 'sitemap.html', 'offline.html']);

function createHandler() {
  const chooser = document.getElementById('createChooser');
  const headerPlus = document.getElementById('headerPlus');
  if (chooser && !chooser.hidden) return;
  if (headerPlus) {
    headerPlus.click();
    return;
  }
  location.href = 'task-create.html';
}

export function renderNav() {
  const p = (location.pathname.split('/').pop() || '').toLowerCase();
  if (AUTH_PAGES.has(p)) return;

  const active = pathKey();
  const bottom = document.querySelector('.bottom-nav');

  if (bottom) {
    const row = bottom.querySelector('.nav-row') || bottom;
    row.innerHTML = ITEMS.map(item => {
      const cls = 'nav-btn' + (item.key === active ? ' active' : '');
      return '<a class="' + cls + '" href="' + item.href + '" data-nav="' + item.key + '" aria-label="' + item.label + '">' +
        '<span class="nav-icon">' + item.icon + '</span><span class="nav-label">' + item.label + '</span></a>';
    }).join('');
    row.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
  }

  if (!document.querySelector('.nkm-create-fab')) {
    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'nkm-create-fab';
    fab.setAttribute('aria-label', 'Create challenge');
    fab.innerHTML = SVG.create;
    fab.addEventListener('click', createHandler);
    document.body.appendChild(fab);
  }

  if (!document.querySelector('.nkm-rail')) {
    const rail = document.createElement('nav');
    rail.className = 'nkm-rail';
    rail.setAttribute('aria-label', 'Primary navigation');

    const itemsHtml = ITEMS.map(item => {
      const cls = 'nav-btn' + (item.key === active ? ' active' : '');
      return '<a class="' + cls + '" href="' + item.href + '" data-rail="' + item.key + '">' +
        '<span class="nav-icon">' + item.icon + '</span><span class="nav-label">' + item.label + '</span></a>';
    }).join('');

    const createHtml = '<button type="button" class="nav-btn nav-btn--create" data-rail="create" aria-label="Create challenge">' +
      '<span class="nav-icon">' + SVG.create + '</span><span class="nav-label">Create</span></button>';

    rail.innerHTML = itemsHtml + '<div style="margin-top:auto;padding:8px 0 4px;border-top:1px solid var(--color-border)">' + createHtml + '</div>';
    document.body.appendChild(rail);

    rail.querySelector('[data-rail="create"]')?.addEventListener('click', event => {
      event.preventDefault();
      createHandler();
    });
  }
}

export function navHtml(active = '') {
  return '<nav class="bottom-nav" aria-label="Primary navigation"><div class="nav-row">' +
    ITEMS.map(item => '<a class="nav-btn' + (item.key === active ? ' active' : '') + '" href="' + item.href + '"><span class="nav-icon">' +
      item.icon + '</span><span class="nav-label">' + item.label + '</span></a>').join('') +
    '</div></nav>';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderNav);
else renderNav();
