import { auth } from '../firebase-init.js';
import { localDateKey, yesterdayDateKey } from './constants.js';
import { workerPost } from './worker-config.js';

/**
 * Bump the streak for the currently signed-in user via the secure Worker.
 *
 * Idempotent: if the user has already been bumped today, the Worker returns
 * alreadyCounted: true and no write occurs.
 *
 * Returns { streakCurrent, streakBest, alreadyCounted } or null on failure.
 */
export async function bumpStreakOnDailyComplete(uid) {
  if (!uid) return null;

  const user = auth.currentUser;
  if (!user || user.uid !== uid) return null;

  let result;
  try {
    result = await workerPost('/gamification/bump-streak', {}, user);
  } catch (err) {
    console.error('[bumpStreak] Worker call failed:', err.message);
    return null;
  }

  if (!result?.ok) {
    console.warn('[bumpStreak] Worker returned error:', result);
    return null;
  }

  return {
    streakCurrent:  result.streakCurrent,
    streakBest:     result.streakBest,
    alreadyCounted: result.alreadyCounted
  };
}

/**
 * True if the streak is at risk (had streak yesterday, nothing yet today).
 * Pure client-side calculation from the cached user profile — no Worker call needed.
 */
export function isStreakAtRisk(userData) {
  if (!userData) return false;
  const streak = Number(userData.streakCurrent) || 0;
  if (streak <= 0) return false;
  const last      = userData.streakLastDate;
  const today     = localDateKey();
  const yesterday = yesterdayDateKey();
  return (
    last === yesterday ||
    (last && last !== today && last !== yesterday && streak > 0 && last < today)
  );
}
