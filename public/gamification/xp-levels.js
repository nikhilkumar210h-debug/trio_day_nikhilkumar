import { auth } from '../firebase-init.js';
import { levelFromXp, getUserTimeZone } from './constants.js';
import { workerPost } from './worker-config.js';
import { trioCache } from '../trio-cache.js';
import { announceBadgesEarned } from '../ui/achievements.js';

export { levelFromXp };

/**
 * Award XP to the currently signed-in user via the secure Worker backend.
 *
 * All Firestore writes (xp, level, weeklyXp, monthlyXp, leaderboards, badges)
 * happen server-side. The client never touches protected fields directly.
 * The user's timezone is included so period/streak keys follow the user's
 * real local day instead of the Worker's UTC clock.
 *
 * Returns { xp, level, leveledUp, awarded, badgesEarned } or null on failure.
 */
export async function awardXp(uid, amount, meta = {}) {
  if (!uid || !amount || amount <= 0) return null;

  const user = auth.currentUser;
  if (!user || user.uid !== uid) return null;

  let result;
  try {
    result = await workerPost(
      '/gamification/award-xp',
      { amount, meta, timeZone: getUserTimeZone() },
      user
    );
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

  // Present any badges the Worker just unlocked as an achievement popup + sound
  const badgesEarned = result.badgesEarned || [];
  if (badgesEarned.length > 0) announceBadgesEarned(badgesEarned);

  return {
    xp:          result.xp,
    level:       result.level,
    leveledUp:   result.leveledUp,
    awarded:     result.awarded,
    badgesEarned
  };
}
