// ui/search.js — Global search foundation (Phase 1)
// Client-side only, debounced, uses trio-cache allUsers + feed_recent
// Reuses utils.escapeHtml, trio-cache, userCache
import { escapeHtml } from '../utils.js';
import { trioCache } from '../trio-cache.js';

const DEBOUNCE_MS = 180;
let timer = null;

export function attachSearch(inputEl, resultsEl, { onSelect } = {}) {
  if (!inputEl || !resultsEl) return;
  const render = () => {
    const q = inputEl.value.trim().toLowerCase();
    if (!q) {
      resultsEl.innerHTML = '<p class="nkm-empty" style="padding:12px">Type a name or Trio UID to search.</p>';
      return;
    }
    const users = trioCache.get('allUsers') || [];
    const matchedUsers = users
      .filter(u => [u.name, u.userId, u.uid].some(v => String(v || '').toLowerCase().includes(q)))
      .slice(0, 8);
    resultsEl.innerHTML = matchedUsers.length
      ? '<div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:8px 0 6px">People</div>' +
        matchedUsers.map(u => `
          <a href="profile.html?uid=${encodeURIComponent(u.uid)}" style="display:flex;align-items:center;gap:10px;padding:9px 6px;border-radius:10px;text-decoration:none;color:inherit">
            <span class="nkm-avatar nkm-avatar--sm">${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" alt="">` : escapeHtml((u.name || 'U').charAt(0))}</span>
            <span><strong style="font-size:13px">${escapeHtml(u.name || 'User')}</strong><br><small style="color:#64748b">${escapeHtml(u.userId || u.uid)}</small></span>
          </a>`).join('')
      : '<p class="nkm-empty" style="padding:12px">No people found.</p>';
    if (onSelect) resultsEl.querySelectorAll('a').forEach(a => a.addEventListener('click', onSelect));
  };
  inputEl.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, DEBOUNCE_MS);
  });
  render();
  return {
    render,
    destroy() {
      clearTimeout(timer);
      inputEl.replaceWith(inputEl.cloneNode(true));
    }
  };
}
