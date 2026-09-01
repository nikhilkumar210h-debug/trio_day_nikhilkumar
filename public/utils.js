// Shared utilities — single source for makeUserId, escapeHtml, initials, formatTime, avatarHtml, chatId, nameOf, getFilterCSS
// Reuse-first Phase 0: all files must import from here, no local copies.
export function makeUserId(uid) {
  return 'TRIO-' + uid.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
}
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const esc = escapeHtml; // alias
export function initials(n) {
  return (n || 'U').trim().charAt(0).toUpperCase();
}
export function formatTime(p) {
  const d = Number.isFinite(p.createdAtMs) ? new Date(p.createdAtMs) : p.createdAt?.toDate ? p.createdAt.toDate() : null;
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'just now';
}
export function nameOf(u) {
  return u?.name || u?.email?.split('@')[0] || 'User';
}
export function timeOf(ms) {
  return ms ? new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
}
export function chatId(a, b) {
  return [a, b].sort().join('_');
}
export function avatarHtml(u) {
  const photo = u?.photoURL || u?.photoUrl || u?.avatarURL || u?.avatarUrl || null;
  const name = nameOf(u);
  if (photo) {
    return `<img src="${escapeHtml(photo)}" alt="${escapeHtml(name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent=(this.alt||'U').charAt(0).toUpperCase();this.parentElement.style.display='grid';this.parentElement.style.placeItems='center';">`;
  }
  return escapeHtml(name.charAt(0).toUpperCase());
}
export function getFilterCSS(filter, intensity) {
  switch (filter) {
    case 'vivid': return `saturate(${(1 + intensity) * 100}%) contrast(${(1 + intensity * 0.2) * 100}%)`;
    case 'warm': return `sepia(${(0.3 + intensity * 0.3) * 100}%) saturate(${(1 + intensity * 0.5) * 100}%)`;
    case 'cool': return `saturate(${(1 - intensity * 0.3) * 100}%) hue-rotate(${-10 * intensity}deg) contrast(${(1 + intensity * 0.1) * 100}%)`;
    case 'bw': return `grayscale(${(0.8 + intensity * 0.2) * 100}%) brightness(${(1 - intensity * 0.2) * 100}%) contrast(${(1 + intensity * 0.3) * 100}%)`;
    case 'retro': return `sepia(${(0.4 + intensity * 0.3) * 100}%) saturate(${(1 + intensity * 0.3) * 100}%) brightness(${(1 - intensity * 0.1) * 100}%) contrast(${(1 + intensity * 0.2) * 100}%)`;
    case 'cinematic': return `saturate(${(1 - intensity * 0.3) * 100}%) contrast(${(1 + intensity * 0.4) * 100}%) brightness(${(1 - intensity * 0.1) * 100}%) hue-rotate(${-5 * intensity}deg)`;
    default: return 'none';
  }
}
