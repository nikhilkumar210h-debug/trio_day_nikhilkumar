// Shared utilities — deduped to fix PSI “Duplicated JavaScript” (2 KiB)
// Single source for makeUserId, escapeHtml, initials, formatTime used across auth.js, profile.js, script.js, chat.js
export function makeUserId(uid) {
  return 'TRIO-' + uid.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
}
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const esc = escapeHtml; // alias for chat/profile short name
export function initials(n) {
  return (n || 'U').trim().charAt(0).toUpperCase();
}
export function formatTime(p) {
  const d = Number.isFinite(p.createdAtMs) ? new Date(p.createdAtMs) : p.createdAt?.toDate ? p.createdAt.toDate() : null;
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'just now';
}
export function avatarHtml(u) {
  const name = u?.name || u?.email?.split('@')[0] || 'User';
  return u?.photoURL ? `<img src="${escapeHtml(u.photoURL)}" alt="">` : escapeHtml(name.charAt(0).toUpperCase());
}
