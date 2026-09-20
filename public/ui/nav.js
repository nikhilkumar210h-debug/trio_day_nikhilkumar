// ui/nav.js — Trio Day global navigation
// Desktop/tablet: fixed left rail, collapsed by default.
// Click ⋯ to expand/collapse; choice is persisted locally.
// Mobile: compact bottom navigation remains for touch ergonomics.

const SVG = {
  today: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
  discover: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>`,
  do: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>`,
  chat: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  rooms: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="3"/><path d="M2.5 19c.7-3 2.6-4.5 5.5-4.5S12.8 16 13.5 19M13 15c2.7-1.1 6.6.1 8 4"/></svg>`,
  build: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M4 18l9-9 4 4-9 9H4z"/><path d="M13 5l2-2 6 6-2 2z"/><path d="M3 21h18"/></svg>`,
  learn: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/></svg>`,
  puzzle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M9 3h3a2 2 0 1 1 4 0h2a2 2 0 0 1 2 2v3a2 2 0 1 0 0 4v4a2 2 0 0 1-2 2h-3a2 2 0 1 0-4 0H8a2 2 0 0 1-2-2v-3a2 2 0 1 0 0-4V5a2 2 0 0 1 2-2h1z"/></svg>`,
  challenge: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M6 3v18M6 5h11l-2 4 2 4H6"/></svg>`,
  create: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`
};

const ITEMS = [
  { key: 'today', label: 'Today', href: 'index.html', icon: SVG.today },
  { key: 'discover', label: 'Discover', href: 'all-users.html', icon: SVG.discover },
  { key: 'do', label: 'Do', href: 'tasks.html', icon: SVG.do },
  { key: 'chat', label: 'Chat', href: 'chat.html', icon: SVG.chat },
  { key: 'rooms', label: 'Live Rooms', href: 'rooms.html', icon: SVG.rooms },
  { key: 'build', label: 'Build', href: 'build.html', icon: SVG.build },
  { key: 'learn', label: 'Learn', href: 'learn.html', icon: SVG.learn },
  { key: 'puzzle', label: 'Puzzle', href: 'puzzle.html', icon: SVG.puzzle },
  { key: 'challenge', label: 'Challenges', href: 'challenge.html', icon: SVG.challenge }
];

function pathKey() {
  const p = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (!p || p === 'index.html' || p === 'view_post.html') return 'today';
  if (p === 'all-users.html') return 'discover';
  if (p === 'tasks.html' || p === 'task-create.html' || p === 'leaderboard.html' || p === 'admin-tasks.html') return 'do';
  if (p === 'chat.html' || p === 'private-chat.html') return 'chat';
  if (p === 'rooms.html' || p === 'room.html') return 'rooms';
  if (p === 'build.html') return 'build';
  if (p === 'learn.html') return 'learn';
  if (p === 'puzzle.html' || p === 'activity.html') return 'puzzle';
  if (p === 'challenge.html' || p === 'game.html') return 'challenge';
  if (p === 'profile.html') return 'profile';
  return 'today';
}

const AUTH_PAGES = new Set(['login.html','404.html','sitemap.html','offline.html']);

function createHandler() {
  const chooser = document.getElementById('createChooser');
  if (chooser) {
    chooser.hidden = false;
    document.body.style.overflow = 'hidden';
    return;
  }
  location.href = 'task-create.html';
}

function isExpanded() {
  return localStorage.getItem('trio_nav_expanded') === '1';
}

function setExpanded(expanded, rail, button) {
  document.body.classList.toggle('nkm-nav-expanded', expanded);
  localStorage.setItem('trio_nav_expanded', expanded ? '1' : '0');
  rail?.setAttribute('data-expanded', expanded ? 'true' : 'false');
  button?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  if (button) button.title = expanded ? 'Collapse navigation' : 'Expand navigation';
}

function renderBottomNav(active) {
  let bottom = document.querySelector('.bottom-nav');
  if (!bottom) {
    bottom = document.createElement('nav');
    bottom.className = 'bottom-nav';
    bottom.setAttribute('aria-label','Primary navigation');
    bottom.innerHTML = '<div class="nav-row"></div>';
    document.body.appendChild(bottom);
  }
  const row = bottom.querySelector('.nav-row') || bottom;
  row.innerHTML = ITEMS.slice(0, 5).map(i => {
    const cls = 'nav-btn' + (i.key === active ? ' active' : '');
    return '<a class="' + cls + '" href="' + i.href + '" data-nav="' + i.key + '" aria-label="' + i.label + '"><span class="nav-icon">' + i.icon + '</span><span class="nav-label">' + i.label + '</span></a>';
  }).join('');
}

function renderRail(active) {
  let rail = document.querySelector('.nkm-rail');
  if (!rail) {
    rail = document.createElement('nav');
    rail.className = 'nkm-rail';
    rail.setAttribute('aria-label','Primary navigation');
    rail.innerHTML =
      '<div class="nkm-rail-brand-row">' +
        '<a class="nkm-rail-brand" href="index.html" aria-label="Trio home" title="Trio">' +
          '<img src="icons/icon-192.png" alt="Trio">' +
          '<span class="nkm-rail-brand-copy"><strong>Trio</strong><small>Play · Learn · Grow</small></span>' +
        '</a>' +
        '<button class="nkm-rail-toggle" type="button" aria-label="Expand navigation" aria-expanded="false" title="Expand navigation">⋯</button>' +
      '</div>' +
      '<div class="nkm-rail-items"></div>' +
      '<div class="nkm-rail-footer"><button type="button" class="nav-btn nav-btn--create" data-rail="create" aria-label="Create"><span class="nav-icon">' + SVG.create + '</span><span class="nav-label">Create</span></button></div>';
    document.body.appendChild(rail);
    const toggle = rail.querySelector('.nkm-rail-toggle');
    toggle.addEventListener('click', () => setExpanded(!document.body.classList.contains('nkm-nav-expanded'), rail, toggle));
    rail.querySelector('[data-rail="create"]')?.addEventListener('click', e => { e.preventDefault(); createHandler(); });
  }

  const itemsHost = rail.querySelector('.nkm-rail-items');
  itemsHost.innerHTML = ITEMS.map(i => {
    const cls = 'nav-btn' + (i.key === active ? ' active' : '');
    return '<a class="' + cls + '" href="' + i.href + '" data-rail="' + i.key + '" title="' + i.label + '">' +
      '<span class="nav-icon">' + i.icon + '</span><span class="nav-label">' + i.label + '</span></a>';
  }).join('');

  const toggle = rail.querySelector('.nkm-rail-toggle');
  setExpanded(isExpanded(), rail, toggle);
}

export function renderNav() {
  const p = (location.pathname.split('/').pop() || '').toLowerCase();
  if (AUTH_PAGES.has(p)) return;
  const active = pathKey();
  renderRail(active);
  document.querySelector('.bottom-nav')?.remove();
}
export function navHtml(active = '') {
  return '<nav class="bottom-nav" aria-label="Primary navigation"><div class="nav-row">' +
    ITEMS.slice(0, 5).map(i => '<a class="nav-btn' + (i.key === active ? ' active' : '') + '" href="' + i.href + '"><span class="nav-icon">' + i.icon + '</span><span class="nav-label">' + i.label + '</span></a>').join('') +
    '</div></nav>';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderNav);
else renderNav();
