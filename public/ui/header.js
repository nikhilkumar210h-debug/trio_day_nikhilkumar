// ui/header.js — Minimal global header
// Keep the header intentionally quiet. Primary navigation already exposes
// Today / Discover / Do / Chat / You, so the header must not duplicate Chat,
// Notifications, Search, or other menu actions.

export function initHeader() {
  const inner = document.querySelector('.topbar-inner');
  if (!inner) return;

  // Remove legacy injected controls from older builds.
  inner.querySelectorAll('#headerChatBtn, #headerNotifBtn, #headerThemeBtn, .nkm-header-search, .nkm-header-search-btn').forEach(el => el.remove());

  // Keep only the brand and auth status in the topbar.
  const allowed = new Set(['.brand', '#authStatus']);
  [...inner.children].forEach(child => {
    if (![...allowed].some(selector => child.matches?.(selector))) child.remove();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHeader);
else initHeader();
