import { db } from '../firebase-init.js';
import { setDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { SYSTEM_BADGES } from './constants.js';
import { trioCache } from '../trio-cache.js';
import { escapeHtml as escapeAttr } from '../utils.js';

// Bump this version whenever SYSTEM_BADGES changes so the catalog re-seeds once.
const BADGE_CATALOG_VERSION = 'v1';
const BADGE_CATALOG_SEED_KEY = 'trio_badge_catalog_seeded_' + BADGE_CATALOG_VERSION;

function badgeCatalogSeeded() {
  try { return localStorage.getItem(BADGE_CATALOG_SEED_KEY) === '1'; } catch { return false; }
}

function markBadgeCatalogSeeded() {
  try { localStorage.setItem(BADGE_CATALOG_SEED_KEY, '1'); } catch { /* private mode */ }
}

/**
 * Ensure the badge catalog documents exist in Firestore. Seeding writes 6
 * documents, so it is gated by a localStorage version key and only runs once
 * per browser (pass { force: true } to re-seed, e.g. from the admin panel).
 * @param {{ force?: boolean }} [options]
 */
export async function ensureBadgeCatalog({ force = false } = {}) {
  const cached = trioCache.get('badge_catalog');
  if (cached) return cached;
  if (force || !badgeCatalogSeeded()) {
    try {
      await Promise.all(SYSTEM_BADGES.map(b =>
        setDoc(doc(db, 'badges', b.id), { ...b, createdAt: serverTimestamp() }, { merge: true })
      ));
    } catch (_) {
      // Best-effort seeding only: the catalog is code-defined and renders fine
      // even when the Firestore write is unavailable (e.g. non-admin users).
    }
    markBadgeCatalogSeeded();
  }
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
