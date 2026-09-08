// ui/nav-new.js — NKM Navigation foundation (Phase 1)
// Mobile: Home | Community | Create (center FAB) | Activity | You (4+1)
// Desktop: left rail 72→240px + top header (header.js)
// Icon strategy: outline SVG (no emoji) — consistent set
// Reuses existing .bottom-nav markup; enhances via DOM patch + creates .nkm-rail

const SVG = {
  home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
  community: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="9" cy="8" r="4"/><path d="M15 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/><path d="M3 19a6 6 0 0 1 12 0"/><path d="M15 19a5 5 0 0 1 5 0"/></svg>`,
  create: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>`,
  activity: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>`,
  you: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="8" r="4"/><path d="M4 19a8 8 0 0 1 16 0"/></svg>`
};

const ITEMS = [
  { key: 'home', label: 'Home', href: 'index.html', icon: SVG.home, mobile: true },
  { key: 'community', label: 'Community', href: 'all-users.html', icon: SVG.community, mobile: true },
  { key: 'create', label: 'Create', href: '#', icon: SVG.create, mobile: true, isCreate: true },
  { key: 'activity', label: 'Activity', href: 'tasks.html', icon: SVG.activity, mobile: true },
  { key: 'you', label: 'You', href: 'profile.html', icon: SVG.you, mobile: true }
];

function pathKey() {
  const p = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (p === '' || p === 'index.html') return 'home';
  if (p === 'all-users.html') return 'community';
  if (p === 'tasks.html' || p === 'task-create.html' || p === 'task-detail.html' || p === 'leaderboard.html') return 'activity';
  if (p === 'profile.html') return 'you';
  if (p === 'chat.html' || p === 'private-chat.html') return 'community'; // chat accessible via Community on mobile, rail on desktop
  return 'home';
}

const AUTH_PAGES = new Set(['login.html', '404.html', 'sitemap.html']);

export function renderNav() {
  const p = (location.pathname.split('/').pop() || '').toLowerCase();
  if (AUTH_PAGES.has(p)) return;
  const active = pathKey();
  const bottom = document.querySelector('.bottom-nav');
  // Patch bottom nav to 4+1 if exists — avoid full innerHTML swap flash if already correct
  if (bottom) {
    const row = bottom.querySelector('.nav-row') || bottom;
    const existing = row.querySelectorAll('[data-nav]');
    const hasCorrectStructure = existing.length === ITEMS.length && [...existing].every((el, idx) => el.dataset.nav === ITEMS[idx].key);
    if (!hasCorrectStructure) {
      row.innerHTML = ITEMS.map(i => {
        const isActive = i.key === active ? ' active' : '';
        const cls = i.isCreate ? 'nav-btn nav-btn--create' + isActive : 'nav-btn' + isActive;
        return `<a class="${cls}" href="${i.href}" data-nav="${i.key}" aria-label="${i.label}"><span class="nav-icon">${i.icon}</span><span>${i.isCreate ? '' : i.label}</span></a>`;
      }).join('');
    } else {
      row.querySelectorAll('.nav-btn').forEach(el => {
        el.classList.toggle('active', el.dataset.nav === active);
      });
    }
    // Ensure single handler for Create (avoid duplicates on re-render)
    const createBtn = row.querySelector('[data-nav="create"]');
    if (createBtn && !createBtn.dataset.bound) {
      createBtn.dataset.bound = '1';
      createBtn.addEventListener('click', e => {
        e.preventDefault();
        const chooser = document.getElementById('createChooser');
        const fab = document.getElementById('fabBtn');
        const headerPlus = document.getElementById('headerPlus');
        if (chooser && !chooser.hidden) return;
        if (fab) fab.click();
        else if (headerPlus) headerPlus.click();
        else if (chooser) { chooser.hidden = false; document.body.style.overflow = 'hidden'; }
      });
    }
  }

  // Create desktop rail if not exists
  if (!document.querySelector('.nkm-rail')) {
    const rail = document.createElement('nav');
    rail.className = 'nkm-rail';
    rail.setAttribute('aria-label', 'Primary navigation');
    rail.innerHTML = ITEMS.map(i => {
      const isActive = i.key === active ? ' active' : '';
      const cls = i.isCreate ? 'nav-btn nav-btn--create' + isActive : 'nav-btn' + isActive;
      return `<a class="${cls}" href="${i.href}" data-rail="${i.key}"><span class="nav-icon">${i.icon}</span><span>${i.label}</span></a>`;
    }).join('') + `<div style="margin-top:auto; padding:8px 0 4px; border-top:1px solid rgba(148,163,184,.10)"><a class="nav-btn" href="chat.html" data-rail="chat"><span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span><span>Chat</span></a></div>`;
    document.body.appendChild(rail);
    rail.querySelector('[data-rail="create"]')?.addEventListener('click', e => {
      e.preventDefault();
      const fab = document.getElementById('fabBtn');
      const headerPlus = document.getElementById('headerPlus');
      if (fab) fab.click();
      else if (headerPlus) headerPlus.click();
    });
  }
}

// Legacy helper kept for compatibility (unused pages may import)
export function navHtml(active = '') {
  return `<nav class="bottom-nav" aria-label="Primary navigation"><div class="nav-row">${ITEMS.map(i => `<a class="nav-btn${i.key===active?' active':''}${i.isCreate?' nav-btn--create':''}" href="${i.href}"><span class="nav-icon">${i.icon}</span><span>${i.label}</span></a>`).join('')}</div></nav>`;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderNav);
else renderNav();
