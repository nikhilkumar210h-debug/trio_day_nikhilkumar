// services/userCache.js — Phase 0: single source for user/profile caching
// Replaces 6 duplicated getCachedUser* families across script.js, profile.js, all-users.js, auth-ui.js, chat.js
// Reuse-first: trio-cache TTL + Firestore single fetch
import { db } from '../firebase-init.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { trioCache } from '../trio-cache.js';

/**
 * Cached single-user fetch (TTL DEFAULT 5m).
 * Mirrors previous getCachedUserProfile / getCachedUser / findUser direct hits.
 */
export async function getCachedUser(uid) {
  if (!uid) return null;
  const key = `user_${uid}`;
  const cached = trioCache.get(key);
  if (cached) return cached;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    trioCache.set(key, data, trioCache.TTL.DEFAULT);
    return data;
  } catch { return null; }
}

/** Alias kept for script.js compatibility */
export const getCachedUserProfile = getCachedUser;

/**
 * Cached my profile (same as above, explicit for semantics).
 */
export async function getMyProfile(uid) {
  return getCachedUser(uid);
}

/**
 * Find user with fallback query on uid field if direct doc miss (legacy).
 * Previously private-chat.js findUser (uncached) — now cached wrapper.
 */
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
export async function findUserCached(uid) {
  const direct = await getCachedUser(uid);
  if (direct) return { ...direct, uid: direct.uid || uid };
  // Fallback only if direct miss — rare legacy path, also cached after
  try {
    const q = query(collection(db, 'users'), where('uid', '==', uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      const data = { ...d.data(), uid: d.data().uid || d.id };
      trioCache.set(`user_${uid}`, data, trioCache.TTL.DEFAULT);
      return data;
    }
  } catch {}
  return null;
}

// Gamification writes emit this event after XP changes. Invalidate the cached
// user document so profile/You never waits for the normal 5-minute TTL.
if (typeof window !== 'undefined') {
  window.addEventListener('trio-xp-changed', event => {
    const uid = event?.detail?.uid;
    if (uid) trioCache.invalidate(`user_${uid}`);
  });
}
