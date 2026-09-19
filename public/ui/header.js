// ui/header.js — Global header wiring (Phase 2)
// Enhances existing .topbar markup to 48/56px via header.css, adds search slot + sheet wiring.
// Adds theme toggle button.
// Reuses: utils.escapeHtml, sheet.js, search.js, trio-cache
import { attachSearch } from './search.js';

export function initHeader() {
  const topbar = document.querySelector('.topbar');
  const inner = document.querySelector('.topbar-inner');
  if (!topbar || !inner) return;

  // Shared page back button — keeps secondary pages easy to exit.
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const noBack = new Set(['index.html','login.html','signup.html','404.html','offline.html']);
  if (!noBack.has(page) && !inner.querySelector('.nkm-header-back')) {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'nkm-header-back';
    back.setAttribute('aria-label','Go back');
    back.innerHTML = '<span aria-hidden="true">←</span><span class="nkm-header-back-label">Back</span>';
    back.addEventListener('click', () => {
      const sameApp = document.referrer && (()=>{try{return new URL(document.referrer).origin===location.origin}catch{return false}})();
      if (history.length > 1 && sameApp) history.back();
      else location.href = page === 'activity.html' || page === 'task-detail.html' || page === 'task-create.html' || page === 'room.html' || page === 'rooms.html' ? 'all-users.html' : 'index.html';
    });
    inner.insertBefore(back, inner.firstChild);
  }

  // Inject header search slot (desktop inline, mobile via sheet)
  if (!document.querySelector('.nkm-header-search')) {
    const searchSlot = document.createElement('div');
    searchSlot.className = 'nkm-header-search';
    searchSlot.innerHTML = `<div class="nkm-search-wrap"><input class="nkm-search" id="nkmHeaderSearch" placeholder="Search name, TRIO-ID…" aria-label="Search"></div><div id="nkmHeaderSearchResults" style="position:absolute; top:42px; left:0; right:0; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:8px; display:none; max-height:60vh; overflow:auto; z-index:70"></div>`;
    searchSlot.style.position = 'relative';
    // Insert before actions
    const actions = inner.querySelector('.topbar-actions');
    if (actions) inner.insertBefore(searchSlot, actions);
    else inner.appendChild(searchSlot);

    const input = searchSlot.querySelector('#nkmHeaderSearch');
    const results = searchSlot.querySelector('#nkmHeaderSearchResults');
    if (input && results) {
      attachSearch(input, results, { onSelect: () => { results.style.display = 'none'; input.value = ''; } });
      input.addEventListener('focus', () => { if (input.value.trim()) results.style.display = 'block'; });
      input.addEventListener('input', () => { results.style.display = input.value.trim() ? 'block' : 'none'; });
      document.addEventListener('click', e => { if (!searchSlot.contains(e.target)) results.style.display = 'none'; });
    }
  }

  // Theme toggle button (desktop only, near notification)
  if (!document.querySelector('#headerThemeBtn') && window.TrioTheme) {
    const themeBtn = window.TrioTheme.createThemeToggle();
    themeBtn.id = 'headerThemeBtn';
    const actions = inner.querySelector('.topbar-actions');
    const authEl = document.getElementById('authStatus');
    if (actions && authEl) {
      actions.insertBefore(themeBtn, authEl);
    }
  }

  // Help is always one tap away from the top-right.
  if (!inner.querySelector('.nkm-help-btn')) {
    const helpBtn = document.createElement('a');
    helpBtn.className = 'nkm-help-btn';
    helpBtn.href = 'help.html';
    helpBtn.setAttribute('aria-label','Help Center');
    helpBtn.innerHTML = '<span class="nkm-help-mark">?</span><span class="nkm-help-label">Help</span>';
    const actions = inner.querySelector('.topbar-actions');
    const authEl = document.getElementById('authStatus');
    if (actions) actions.insertBefore(helpBtn, authEl || null);
    else if (authEl) inner.insertBefore(helpBtn, authEl);
    else inner.appendChild(helpBtn);
  }

  // Notifications/chat intentionally live in dedicated navigation now.
  // Keep the header visually quiet; bottom navigation already exposes Chat.
  
  // Mobile search button (opens search page)
  if (!document.querySelector('.nkm-header-search-btn')) {
    const btn = document.createElement('button');
    btn.className = 'nkm-header-search-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Search');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21L16.65 16.65"/></svg>`;
    btn.addEventListener('click', () => { location.href = 'search.html'; });
    const actions = inner.querySelector('.topbar-actions');
    if (actions) actions.prepend(btn);
  }
}

// Auto-init on DOM ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHeader);
else initHeader();
