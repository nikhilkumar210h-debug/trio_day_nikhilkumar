// ui/header.js — compact global top-right controls.
// The old brand/search/help/theme header is intentionally removed.
// Authenticated pages show only notifications + profile avatar.

import { auth } from '../firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getCachedUser } from '../services/userCache.js';

const BELL = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
const PERSON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 19a8 8 0 0 1 16 0"/></svg>';

function ensureActions() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return null;
  const inner = topbar.querySelector('.topbar-inner') || topbar.appendChild(document.createElement('div'));
  inner.className = 'topbar-inner';

  // Remove legacy header controls/branding. Keep authStatus as a compatibility hook.
  inner.querySelectorAll('.brand,.nkm-header-search,.nkm-header-search-btn,.nkm-header-back,.nkm-help-btn,#headerThemeBtn').forEach(el => el.remove());

  let actions = inner.querySelector('.topbar-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'topbar-actions';
    inner.appendChild(actions);
  }
  actions.innerHTML = '';
  const authStatus = document.createElement('span');
  authStatus.id = 'authStatus';
  authStatus.hidden = true;
  actions.appendChild(authStatus);

  const notifWrap = document.createElement('div');
  notifWrap.className = 'nkm-top-action';
  notifWrap.innerHTML =
    '<button id="notificationButton" class="nkm-top-icon" type="button" aria-label="Notifications">' +
      BELL +
      '<span id="notificationBadge" class="notification-badge" hidden>0</span>' +
    '</button>' +
    '<div id="notificationMenu" hidden></div>';
  actions.appendChild(notifWrap);

  const profileLink = document.createElement('a');
  profileLink.className = 'nkm-top-profile';
  profileLink.href = 'profile.html';
  profileLink.setAttribute('aria-label', 'Open profile');
  profileLink.innerHTML = '<span class="nkm-top-avatar">' + PERSON + '</span>';
  actions.appendChild(profileLink);

  return { actions, avatar: profileLink.querySelector('.nkm-top-avatar') };
}

async function renderUser(user, avatarEl) {
  if (!user || !avatarEl) return;
  let profile = null;
  try { profile = await getCachedUser(user.uid); } catch {}
  const url = profile?.photoURL || user.photoURL;
  const name = profile?.name || user.displayName || user.email?.split('@')[0] || 'User';
  avatarEl.textContent = '';
  if (url) {
    const img = document.createElement('img');
    img.src = String(url);
    img.alt = name;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    avatarEl.appendChild(img);
  } else {
    avatarEl.textContent = name.trim().charAt(0).toUpperCase() || 'U';
  }
  avatarEl.parentElement.title = name + ' · Open profile';
}

function init() {
  const ui = ensureActions();
  if (!ui) return;
  onAuthStateChanged(auth, user => {
    ui.actions.hidden = !user;
    if (user) renderUser(user, ui.avatar);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
