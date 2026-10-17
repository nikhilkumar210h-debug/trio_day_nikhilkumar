// services/userCache.js — Phase 0: single source for user/profile caching
// Replaces 6 duplicated getCachedUser* families across script.js, profile.js, all-users.js, auth-ui.js, chat.js
// Reuse-first: trio-cache TTL + Firestore single fetch
import { db } from '../firebase-init.js';
import { doc, getDoc, setDoc, serverTimestamp, deleteField } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { trioCache } from '../trio-cache.js';
import { makeUserId } from '../utils.js';

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

/**
 * Self-heal the signed-in user's users/{uid} profile document (Phase 1).
 *
 * Called on sign-in (auth.js), on every authenticated session (auth-guard.js),
 * and when the owner opens /profile with a missing document (profile.js).
 * Idempotent: an existing (or cached) profile short-circuits to a no-op.
 *
 * Default document: displayName + name, userId/trioUid (TRIO-XXXXXXXX),
 * bio "", photoURL, emailHidden, createdAt, updatedAt. The user's email is
 * scrubbed from the public doc (it lives in usersPrivate, per auth.js).
 *
 * NOTE — gamification fields are intentionally NOT seeded: firestore.rules
 * `gamificationKeys()` rejects client writes to xp/level/streak*. The
 * gamification Worker owns them, and all readers already coerce missing
 * values (xp→0, level→1 via levelFromXp, streakCurrent→0).
 *
 * @returns {Promise<Object|null>} the (fresh or healed) profile data, or null when unavailable.
 */
export async function ensureUserProfile(authUser, chosenName = '') {
  if (!authUser?.uid) return null;
  const uid = authUser.uid;

  // Fast path: cache hit or existing document.
  const existing = await getCachedUser(uid);
  if (existing) return existing;

  // Canonical resolved name: doc → chosen → Firebase Auth profile → default.
  const displayName = String(chosenName || '').trim()
    || authUser.displayName
    || (authUser.email ? String(authUser.email).split('@')[0] : '')
    || 'Trio Member';
  const trioUid = makeUserId(uid);

  const profile = {
    uid,
    name: displayName,
    displayName,
    userId: trioUid,
    trioUid,
    bio: '',
    photoURL: authUser.photoURL || null,
    emailHidden: false,
    email: deleteField(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'users', uid), profile, { merge: true });
  } catch (err) {
    console.warn('[userCache] Profile self-heal failed:', err);
    return null;
  }

  // Re-fetch so callers get server-accurate data (serverTimestamp resolves).
  const fresh = await getDoc(doc(db, 'users', uid)).catch(() => null);
  const data = fresh?.exists()
    ? fresh.data()
    : { ...profile, createdAt: Date.now(), updatedAt: Date.now() };
  trioCache.set(`user_${uid}`, data, trioCache.TTL.DEFAULT);
  return data;
}
