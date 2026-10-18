// ui/subnav.js — Unified sub-navigation bar (Phase 3)
// Renders: Activities | Progress | Leaderboard | Profile | Admin (admin only)
// Sits directly below <header class="topbar"> on all authenticated pages

const SVG = {
  activities: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
  progress: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V8"/><path d="M18 20V10"/><path d="M6 20V14"/><path d="M2 18h20"/></svg>`,
  leaderboard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V8"/><path d="M18 20V10"/><path d="M6 20V14"/><path d="M2 18h20"/></svg>`,
  profile: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 19a8 8 0 0 1 16 0"/></svg>`,
  admin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>`,
};

const BASE_ITEMS = [
  { key: 'activities', label: 'Activities', href: 'index.html', icon: SVG.activities },
  { key: 'progress', label: 'Progress', href: 'profile.html', icon: SVG.progress },
  { key: 'leaderboard', label: 'Leaderboard', href: 'leaderboard.html', icon: SVG.leaderboard },
  { key: 'profile', label: 'Profile', href: 'profile.html', icon: SVG.profile },
];

const ADMIN_ITEM = { key: 'admin', label: 'Admin', href: 'admin-activity.html', icon: SVG.admin };

const AUTH_PAGES = new Set(['login.html', '404.html', 'offline.html']);

let isAdmin = false;

function pathKey() {
  const raw = (location.pathname || '/').replace(/\/+$/, '') || '/';
  const p = raw.split('/').pop().toLowerCase();
  if (p === '' || p === 'index' || p === 'index.html' || p === 'today') return 'activities';
  if (p === 'profile' || p === 'profile.html' || p === 'you') {
    // Check if viewing another user's profile via uid parameter
    const params = new URLSearchParams(location.search);
    const uid = params.get('uid');
    if (uid) return '';
    return 'profile';
  }
  if (p === 'leaderboard' || p === 'leaderboard.html') return 'leaderboard';
  if (p === 'admin-activity' || p === 'admin-activity.html' || p === 'admin-tasks' || p === 'admin-tasks.html' || p === 'admin') return 'admin';
  return '';
}

function getCurrentItems() {
  return isAdmin ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;
}

function linkMarkup(item, active) {
  const isActive = item.key === active;
  const cls = 'subnav-btn' + (isActive ? ' active' : '');
  const current = isActive ? ' aria-current="page"' : '';
  return `<a class="${cls}" href="${item.href}" data-subnav="${item.key}" aria-label="${item.label}"${current}><span class="subnav-icon">${item.icon}</span><span class="subnav-label">${item.label}</span></a>`;
}

function applyActiveState(root, active) {
  root.querySelectorAll('.subnav-btn[data-subnav]').forEach(el => {
    const isActive = el.dataset.subnav === active;
    el.classList.toggle('active', isActive);
    el.dataset.active = isActive ? 'true' : 'false';
    if (isActive) {
      el.setAttribute('aria-current', 'page');
    } else {
      el.removeAttribute('aria-current');
    }
  });
}

export function setAdminFlag(flag) {
  isAdmin = !!flag;
  renderSubnav();
}

export function renderSubnav() {
  const p = (location.pathname.split('/').pop() || '').toLowerCase();
  if (AUTH_PAGES.has(p)) return;
  
  const active = pathKey();
  document.body.dataset.currentSubnav = active;

  const items = getCurrentItems();
  const existing = document.querySelector('.nkm-subnav');
  
  if (existing) {
    const row = existing.querySelector('.subnav-row') || existing;
    const existingBtns = row.querySelectorAll('[data-subnav]');
    const hasCorrectStructure = existingBtns.length === items.length && 
      [...existingBtns].every((el, idx) => el.dataset.subnav === items[idx].key);
    if (!hasCorrectStructure) {
      row.innerHTML = items.map(i => linkMarkup(i, active)).join('');
    } else {
      applyActiveState(row, active);
    }
  } else {
    const nav = document.createElement('nav');
    nav.className = 'nkm-subnav';
    nav.setAttribute('aria-label', 'Section navigation');
    nav.innerHTML = `<div class="subnav-row">${items.map(i => linkMarkup(i, active)).join('')}</div>`;
    
    // Insert directly after the topbar
    const topbar = document.querySelector('.topbar');
    if (topbar && topbar.parentNode) {
      topbar.parentNode.insertBefore(nav, topbar.nextSibling);
    } else {
      document.body.prepend(nav);
    }
  }
}

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderSubnav);
} else {
  renderSubnav();
}

// Re-render on auth state changes (admin flag)
window.addEventListener('trio-header-ready', () => {
  renderSubnav();
});