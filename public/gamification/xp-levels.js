import { auth } from '../firebase-init.js';
import { levelFromXp } from './constants.js';
import { workerPost } from './worker-config.js';
import { trioCache } from '../trio-cache.js';

export { levelFromXp };

/**
 * Award XP to the currently signed-in user via the secure Worker backend.
 *
 * All Firestore writes (xp, level, weeklyXp, monthlyXp, leaderboards, badges)
 * happen server-side. The client never touches protected fields directly.
 *
 * Returns { xp, level, leveledUp, awarded, badgesEarned } or null on failure.
 */
export async function awardXp(uid, amount, meta = {}) {
  if (!uid || !amount || amount <= 0) return null;

  const user = auth.currentUser;
  if (!user || user.uid !== uid) return null;

  let result;
  try {
    result = await workerPost('/gamification/award-xp', { amount, meta }, user);
  } catch (err) {
    console.error('[awardXp] Worker call failed:', err.message);
    return null;
  }

  if (!result?.ok) {
    console.warn('[awardXp] Worker returned error:', result);
    return null;
  }

  // Invalidate local caches so rank badge and profile refresh immediately
  trioCache.invalidate(`my_rank_${uid}`);
  trioCache.invalidate(`user_${uid}`);

  // Dispatch event so auth-ui.js refreshes the 🏆 rank indicator in the nav
  try {
    window.dispatchEvent(new CustomEvent('trio-xp-changed', {
      detail: { uid, xp: result.xp }
    }));
  } catch (_) { /* non-browser context */ }

  return {
    xp:          result.xp,
    level:       result.level,
    leveledUp:   result.leveledUp,
    awarded:     result.awarded,
    badgesEarned: result.badgesEarned || []
  };
}
