// ui/header.js — Global header wiring (Phase 2)
// Enhances existing .topbar markup to 48/56px via header.css, adds search slot + sheet wiring.
// Adds theme toggle button.
// Reuses: utils.escapeHtml, sheet.js, search.js, trio-cache
import { attachSearch } from './search.js';

export function initHeader() {
  const topbar = document.querySelector('.topbar');
  const inner = document.querySelector('.topbar-inner');
  if (!topbar || !inner) return;

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

  // Notification bell with unread dot (presence only, not count)
  if (!document.querySelector('#headerNotifBtn')) {
    const notifBtn = document.createElement('a');
    notifBtn.id = 'headerNotifBtn';
    notifBtn.className = 'nkm-header-chat notification-bell';
    notifBtn.href = 'notifications.html';
    notifBtn.setAttribute('aria-label', 'Notifications');
    notifBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span class="nav-dot" id="headerNotifDot" hidden aria-hidden="true"></span>`;
    const actions = inner.querySelector('.topbar-actions');
    const authEl = document.getElementById('authStatus');
    if (actions) {
      if (authEl) actions.insertBefore(notifBtn, authEl);
      else actions.prepend(notifBtn);
    }
  }

  // Mobile Chat — single intentional access point near Notification (mobile only, desktop uses rail)
  if (!document.querySelector('#headerChatBtn')) {
    const chatBtn = document.createElement('a');
    chatBtn.id = 'headerChatBtn';
    chatBtn.className = 'nkm-header-chat';
    chatBtn.href = 'chat.html';
    chatBtn.setAttribute('aria-label', 'Chat');
    chatBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="nav-chat-dot" id="headerChatDot" hidden aria-hidden="true"></span>`;
    const actions = inner.querySelector('.topbar-actions');
    const authEl = document.getElementById('authStatus');
    if (actions) {
      if (authEl) actions.insertBefore(chatBtn, authEl);
      else actions.prepend(chatBtn);
    }
  }

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
