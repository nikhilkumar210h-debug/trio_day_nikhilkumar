// ui/header.js — Global header wiring (Phase 2)
// Enhances existing .topbar markup to 48/56px via header.css, adds search slot + sheet wiring.
// Adds theme toggle button.
// Reuses: utils.escapeHtml, sheet.js, search.js, trio-cache
import { attachSearch } from './search.js';
const BELL_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';


// Global first-paint loader: canonical Trio Day logo, then get out of the way.
(function ensureTrioLoader(){
  if (document.getElementById('trioPageLoader')) return;
  const loader=document.createElement('div');
  loader.id='trioPageLoader';
  loader.className='trio-page-loader';
  loader.innerHTML='<div class="trio-page-loader-card" aria-label="Loading Trio Day"><div class="trio-loader-orbit"><i></i><i></i><i></i></div><span>TRIO DAY</span><small>connecting</small></div>';
  document.documentElement.classList.add('trio-loading');
  if (document.body) document.body.prepend(loader);
  else document.addEventListener('DOMContentLoaded',()=>document.body.prepend(loader),{once:true});
  const hide=()=>{
    document.documentElement.classList.remove('trio-loading');
    loader.classList.add('is-done');
    setTimeout(()=>loader.remove(),260);
  };
  window.addEventListener('load',hide,{once:true});
  setTimeout(hide,1800);
})();

export function initHeader() {
  const topbar = document.querySelector('.topbar');
  const inner = document.querySelector('.topbar-inner');
  if (!topbar || !inner) return;

  // Normalize legacy glyph headers to the canonical Trio Day logo.
  const brand = inner.querySelector('.brand');
  const brandMark = brand?.querySelector('.brand-chakra');
  if (brandMark && !brandMark.querySelector('img')) {
    brandMark.textContent = '';
    const logo = document.createElement('img');
    logo.src = 'icons/trio-day-logo.svg';
    logo.alt = '';
    logo.width = 32;
    logo.height = 32;
    brandMark.appendChild(logo);
  }

  // Normalise legacy pages that put #authStatus directly in .topbar-inner.
  // The global header CSS expects .topbar-actions on every authenticated page.
  let actions = inner.querySelector('.topbar-actions');
  const authStatus = document.getElementById('authStatus');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'topbar-actions';
    inner.appendChild(actions);
  }
  if (authStatus && authStatus.parentElement !== actions) actions.appendChild(authStatus);

  // Canonical notifications control. auth-ui.js attaches the realtime badge/menu behavior.
  if (!document.querySelector('#notificationButton')) {
    const wrap = document.createElement('div');
    wrap.className = 'notification-wrap';
    wrap.innerHTML = '<button id="notificationButton" class="notification-btn" type="button" aria-label="Notifications" title="Notifications">' +
      BELL_SVG +
      '<span id="notificationBadge" class="notification-badge" hidden>0</span>' +
      '</button>' +
      '<div id="notificationMenu" class="notification-menu" hidden></div>';
    actions.insertBefore(wrap, authStatus || null);
  }

  // Inject header search slot (desktop inline, mobile via sheet)
  if (!document.querySelector('.nkm-header-search')) {
    const searchSlot = document.createElement('div');
    searchSlot.className = 'nkm-header-search';
    searchSlot.innerHTML = `<div class="nkm-search-wrap"><input class="nkm-search" id="nkmHeaderSearch" placeholder="Search name, TRIO-ID…" aria-label="Search"></div><div id="nkmHeaderSearchResults" style="position:absolute; top:42px; left:0; right:0; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:8px; display:none; max-height:60vh; overflow:auto; z-index:70"></div>`;
    searchSlot.style.position = 'relative';
    // Insert before actions
    inner.insertBefore(searchSlot, actions);

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
    if (actions && authStatus) actions.insertBefore(themeBtn, authStatus); else if (actions) actions.prepend(themeBtn);
  }

  // Help is a first-class global destination; keep it reachable on every page.
  if (!document.querySelector('#headerHelpBtn')) {
    const help = document.createElement('a');
    help.id = 'headerHelpBtn';
    help.className = 'header-help-btn';
    help.href = 'help.html';
    help.setAttribute('aria-label', 'Help Center');
    help.title = 'Help Center';
    help.textContent = '?';
    if (actions) actions.insertBefore(help, actions.querySelector('#headerThemeBtn') || actions.firstChild);
  }

  // Mobile search button (opens search page)
  if (!document.querySelector('.nkm-header-search-btn')) {
    const btn = document.createElement('button');
    btn.className = 'nkm-header-search-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Search');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21L16.65 16.65"/></svg>`;
    btn.addEventListener('click', () => { location.href = 'search.html'; });
    if (actions) actions.prepend(btn);
  }
  if (!document.querySelector('link[data-trio-experience-v3]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'styles/experience-v3.css?v=20260923-v3';
    link.dataset.trioExperienceV3 = '1';
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[data-trio-experience-v2]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'styles/experience-v2.css?v=20260923-v2';
    link.dataset.trioExperienceV2 = '1';
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[data-trio-experience-v2]')) {
    const script = document.createElement('script');
    script.src = 'experience-v2.js?v=20260923-v2';
    script.dataset.trioExperienceV2 = '1';
    document.body.appendChild(script);
  }

  if (!document.querySelector('script[data-trio-core-loop]')) {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'core-loop.js?v=20260923-core-loop1';
    script.dataset.trioCoreLoop = '1';
    document.body.appendChild(script);
  }
  if (!document.querySelector('script[data-trio-webmcp]')) {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'webmcp.js?v=20260923-webmcp1';
    script.dataset.trioWebmcp = '1';
    document.body.appendChild(script);
  }

  window.dispatchEvent(new CustomEvent('trio-header-ready'));
}

// Auto-init on DOM ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHeader);
else initHeader();
