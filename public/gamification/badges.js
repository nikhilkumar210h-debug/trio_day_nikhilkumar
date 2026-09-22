import { db } from '../firebase-init.js';
import { setDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { SYSTEM_BADGES } from './constants.js';
import { trioCache } from '../trio-cache.js';
import { escapeHtml as escapeAttr } from '../utils.js';

export async function ensureBadgeCatalog() {
  const cached = trioCache.get('badge_catalog');
  if (cached) return cached;
  await Promise.all(SYSTEM_BADGES.map(b =>
    setDoc(doc(db, 'badges', b.id), { ...b, createdAt: serverTimestamp() }, { merge: true })
  ));
  trioCache.set('badge_catalog', SYSTEM_BADGES, trioCache.TTL.LONG);
  return SYSTEM_BADGES;
}

export function renderBadgesHtml(badges = []) {
  const allowed = new Map(SYSTEM_BADGES.map(b => [b.id, b]));
  const clean = badges
    .filter(b => allowed.has(b?.id))
    .map(b => ({ ...allowed.get(b.id), ...b }));
  if (!clean.length) {
    return '<p class="badges-empty">No badges yet — complete Challenges to earn some.</p>';
  }
  return `<div class="badges-grid">${clean.map(b =>
    `<div class="badge-chip" title="${escapeAttr(b.name || b.id)}"><span class="badge-icon">${b.icon || '🏅'}</span><span class="badge-name">${escapeAttr(b.name || b.id)}</span></div>`
  ).join('')}</div>`;
}
