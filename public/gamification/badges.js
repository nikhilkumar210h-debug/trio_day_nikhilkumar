import { db, auth } from '../firebase-init.js';
import { collection, getDocs, setDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { SYSTEM_BADGES } from './constants.js';
import { trioCache } from '../trio-cache.js';
import { pushSelfNotification } from './notify-self.js';
import { workerPost } from './worker-config.js';
import { escapeHtml as escapeAttr } from '../utils.js';

export async function ensureBadgeCatalog() {
  const cached = trioCache.get('badge_catalog');
  if (cached) return cached;

  const snap = await getDocs(collection(db, 'badges')).catch(() => null);
  if (snap && !snap.empty) {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    trioCache.set('badge_catalog', list, trioCache.TTL.LONG);
    return list;
  }

  await Promise.all(SYSTEM_BADGES.map(b =>
    setDoc(doc(db, 'badges', b.id), { ...b, createdAt: serverTimestamp() }, { merge: true })
  ));
  trioCache.set('badge_catalog', SYSTEM_BADGES, trioCache.TTL.LONG);
  return SYSTEM_BADGES;
}

/**
 * Ask the secure Worker to evaluate Challenge progression badges.
 */
export async function evaluateBadges(uid) {
  if (!uid) return [];
  await ensureBadgeCatalog();

  const user = auth.currentUser;
  if (!user || user.uid !== uid) return [];

  try {
    const result = await workerPost('/gamification/award-badges', {}, user);
    if (!result?.ok) return [];
    const earned = result.badgesEarned || [];
    trioCache.invalidate(`user_${uid}`);

    for (const b of earned) {
      try {
        await pushSelfNotification(uid, {
          type: 'badge_earned',
          title: `Badge unlocked: ${b.name}`,
          body: b.desc || 'New Challenge achievement',
          urlPath: 'profile.html'
        });
      } catch (_) {}
    }
    return earned;
  } catch (err) {
    console.warn('[evaluateBadges] Worker call failed:', err.message);
    return [];
  }
}

export function renderBadgesHtml(badges = []) {
  if (!badges.length) {
    return '<p class="badges-empty">No badges yet — complete Challenges to earn some.</p>';
  }
  return `<div class="badges-grid">${badges.map(b =>
    `<div class="badge-chip" title="${escapeAttr(b.name || b.id)}"><span class="badge-icon">${b.icon || '🏅'}</span><span class="badge-name">${escapeAttr(b.name || b.id)}</span></div>`
  ).join('')}</div>`;
}
