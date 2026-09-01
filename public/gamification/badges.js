import { db } from '../firebase-init.js';
import { auth } from '../firebase-init.js';
import { collection, getDocs, setDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { SYSTEM_BADGES } from './constants.js';
import { trioCache } from '../trio-cache.js';
import { pushSelfNotification } from './notify-self.js';
import { workerPost } from './worker-config.js';
import { escapeHtml as escapeAttr } from '../utils.js';

/**
 * Ensure the badge catalog exists in Firestore (read-only seeding, client-safe).
 * The catalog lives at /badges/{badgeId} — these are definition docs, not user badges.
 * User badges live on users/{uid}.badges and are written only by the Worker.
 */
export async function ensureBadgeCatalog() {
  const cached = trioCache.get('badge_catalog');
  if (cached) return cached;

  const snap = await getDocs(collection(db, 'badges')).catch(() => null);
  if (snap && !snap.empty) {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    trioCache.set('badge_catalog', list, trioCache.TTL.LONG);
    return list;
  }

  // Seed catalog (badge definition docs only — not user badges)
  await Promise.all(SYSTEM_BADGES.map(b =>
    setDoc(doc(db, 'badges', b.id), { ...b, createdAt: serverTimestamp() }, { merge: true })
  ));
  trioCache.set('badge_catalog', SYSTEM_BADGES, trioCache.TTL.LONG);
  return SYSTEM_BADGES;
}

/**
 * Evaluate and award new badges to uid via the secure Worker.
 *
 * The Worker reads the authoritative user doc, computes which badges are newly
 * earned, and writes users/{uid}.badges — the client cannot write that field.
 *
 * Returns array of newly earned badge objects.
 */
export async function evaluateBadges(uid, { xp = 0, streakCurrent = 0, extra = {} } = {}) {
  if (!uid) return [];

  await ensureBadgeCatalog();

  const user = auth.currentUser;
  if (!user || user.uid !== uid) return [];

  let result;
  try {
    result = await workerPost(
      '/gamification/award-badges',
      { templateId: extra?.templateId || null },
      user
    );
  } catch (err) {
    console.warn('[evaluateBadges] Worker call failed:', err.message);
    return [];
  }

  if (!result?.ok) return [];

  const earned = result.badgesEarned || [];

  // Invalidate cached user profile so badge display refreshes
  trioCache.invalidate(`user_${uid}`);

  // Fire in-app notifications for each newly earned badge
  for (const b of earned) {
    try {
      await pushSelfNotification(uid, {
        type:    'badge_earned',
        title:   `Badge unlocked: ${b.name}`,
        body:    b.desc || 'New achievement!',
        urlPath: 'profile.html'
      });
    } catch (_) { /* ignore */ }
  }

  return earned;
}

/**
 * Render badge chips as HTML string — pure display helper, no Firestore writes.
 */
export function renderBadgesHtml(badges = []) {
  if (!badges.length) {
    return '<p class="badges-empty">No badges yet — complete tasks to earn some.</p>';
  }
  return `<div class="badges-grid">${badges.map(b =>
    `<div class="badge-chip" title="${escapeAttr(b.name || b.id)}"><span class="badge-icon">${b.icon || '🏅'}</span><span class="badge-name">${escapeAttr(b.name || b.id)}</span></div>`
  ).join('')}</div>`;
}


