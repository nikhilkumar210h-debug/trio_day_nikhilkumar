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
    if (!q) { resultsEl.innerHTML = '<p class="nkm-empty" style="padding:12px">Type to search.</p>'; return; }
    const users = trioCache.get('allUsers') || [];
    const posts = trioCache.get('feed_recent') || [];
    const matchedUsers = users.filter(u => [u.name, u.userId, u.uid].some(v => String(v||'').toLowerCase().includes(q))).slice(0, 5);
    const matchedPosts = posts.filter(p => String(p.message||'').toLowerCase().includes(q)).slice(0, 5);
    resultsEl.innerHTML = `
      ${matchedUsers.length ? `<div style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:#64748b; margin:8px 0 6px">People</div>${matchedUsers.map(u => `<a href="profile.html?uid=${encodeURIComponent(u.uid)}" style="display:flex; align-items:center; gap:10px; padding:8px 6px; border-radius:10px; text-decoration:none; color:inherit"><span class="nkm-avatar nkm-avatar--sm">${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" alt="">` : escapeHtml((u.name||'U').charAt(0))}</span><span><strong style="font-size:13px">${escapeHtml(u.name||'User')}</strong><br><small style="color:#64748b">${escapeHtml(u.userId||u.uid)}</small></span></a>`).join('')}` : ''}
      ${matchedPosts.length ? `<div style="font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:#64748b; margin:12px 0 6px">Posts</div>${matchedPosts.map(p => `<a href="view_post.html?postId=${encodeURIComponent(p._id)}" style="display:block; padding:8px 6px; border-radius:10px; text-decoration:none; color:inherit; border:1px solid rgba(148,163,184,.08); margin-bottom:6px"><span style="font-size:13px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden">${escapeHtml(String(p.message||'').slice(0,120))}</span><small style="color:#64748b">${escapeHtml(p.name||'')}</small></a>`).join('')}` : ''}
      ${!matchedUsers.length && !matchedPosts.length ? '<p class="nkm-empty" style="padding:12px">No results.</p>' : ''}
    `;
    if (onSelect) resultsEl.querySelectorAll('a').forEach(a => a.addEventListener('click', onSelect));
  };
  inputEl.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, DEBOUNCE_MS);
  });
  render();

  // Keep the caller contract stable: header.js destructures the return value.
  // Return lifecycle helpers instead of undefined so search initialization can
  // safely be extended without crashing on pages that use the global header.
  return {
    render,
    destroy() {
      clearTimeout(timer);
      inputEl.replaceWith(inputEl.cloneNode(true));
    }
  };
}
