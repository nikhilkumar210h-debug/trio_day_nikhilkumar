// ui/nav.js — Trio Day global navigation (Phase 3)
// Canonical items: Today / Discover / Do / You
// Mobile: 5-item bottom nav.
// Desktop: left rail (icons at tablet, expanded at wide).
// Reuses existing .bottom-nav markup; enhances via DOM patch + creates .nkm-rail.

const SVG = {
  today: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
  discover: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>`,
  do: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>`,
  you: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="8" r="4"/><path d="M4 19a8 8 0 0 1 16 0"/></svg>`,
};

const ITEMS = [
  { key: 'today', label: 'Today', href: 'index.html', icon: SVG.today },
  { key: 'discover', label: 'Discover', href: 'all-users.html', icon: SVG.discover },
  { key: 'do', label: 'Do', href: 'tasks.html', icon: SVG.do },
  { key: 'you', label: 'You', href: 'profile.html', icon: SVG.you }
];

function pathKey() {
  const p = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (p === '' || p === 'index.html' || p === 'view_post.html') return 'today';
  if (p === 'all-users.html') return 'discover';
  if (p === 'tasks.html' || p === 'task-create.html' || p === 'task-detail.html' || p === 'leaderboard.html' || p === 'admin-tasks.html') return 'do';
  if (p === 'chat.html' || p === 'private-chat.html') return '';
  if (p === 'profile.html') return 'you';
  return 'today';
}

const AUTH_PAGES = new Set(['login.html', '404.html', 'sitemap.html', 'offline.html']);

export function renderNav() {
  const p = (location.pathname.split('/').pop() || '').toLowerCase();
  if (AUTH_PAGES.has(p)) return;
  const active = pathKey();

  // ── Bottom nav (mobile) — 5-item, no Create inside grid ──
  const bottom = document.querySelector('.bottom-nav');
  if (bottom) {
    const row = bottom.querySelector('.nav-row') || bottom;
    const existing = row.querySelectorAll('[data-nav]');
    const hasCorrectStructure = existing.length === ITEMS.length && [...existing].every((el, idx) => el.dataset.nav === ITEMS[idx].key);
    if (!hasCorrectStructure) {
      row.innerHTML = ITEMS.map(i => {
        const cls = 'nav-btn' + (i.key === active ? ' active' : '');
        return `<a class="${cls}" href="${i.href}" data-nav="${i.key}" aria-label="${i.label}"><span class="nav-icon">${i.icon}</span><span class="nav-label">${i.label}</span></a>`;
      }).join('');
    } else {
      row.querySelectorAll('.nav-btn').forEach(el => el.classList.toggle('active', el.dataset.nav === active));
    }
  } else if (!document.querySelector('.bottom-nav')) {
    // Page is missing bottom-nav markup (e.g., Forge lanes) — inject it
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('aria-label', 'Primary navigation');
    nav.innerHTML = `<div class="nav-row">${ITEMS.map(i => {
      const cls = 'nav-btn' + (i.key === active ? ' active' : '');
      return `<a class="${cls}" href="${i.href}" data-nav="${i.key}" aria-label="${i.label}"><span class="nav-icon">${i.icon}</span><span class="nav-label">${i.label}</span></a>`;
    }).join('')}</div>`;
    document.body.appendChild(nav);
  }

  // ── Desktop rail ──
  if (!document.querySelector('.nkm-rail')) {
    const rail = document.createElement('nav');
    rail.className = 'nkm-rail';
    rail.setAttribute('aria-label', 'Primary navigation');
    const itemsHtml = ITEMS.map(i => {
      const cls = 'nav-btn' + (i.key === active ? ' active' : '');
      return `<a class="${cls}" href="${i.href}" data-rail="${i.key}"><span class="nav-icon">${i.icon}</span><span class="nav-label">${i.label}</span></a>`;
    }).join('');
    rail.innerHTML = itemsHtml;
    document.body.appendChild(rail);
  }
}

// Legacy helper kept for compatibility (unused pages may import)
export function navHtml(active = '') {
  return `<nav class="bottom-nav" aria-label="Primary navigation"><div class="nav-row">${ITEMS.map(i => `<a class="nav-btn${i.key===active?' active':''}" href="${i.href}"><span class="nav-icon">${i.icon}</span><span class="nav-label">${i.label}</span></a>`).join('')}</div></nav>`;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderNav);
else renderNav();