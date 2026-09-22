import { auth } from '../firebase-init.js';
import { workerPost } from './worker-config.js';

/**
 * Increment the current Challenge streak through the secure Worker.
 * The Worker is idempotent per local calendar day.
 */
export async function bumpChallengeStreak(uid) {
  if (!uid) return null;
  const user = auth.currentUser;
  if (!user || user.uid !== uid) return null;

  try {
    const result = await workerPost('/gamification/bump-streak', {}, user);
    if (!result?.ok) return null;
    return {
      streakCurrent: result.streakCurrent,
      streakBest: result.streakBest,
      alreadyCounted: result.alreadyCounted
    };
  } catch (err) {
    console.error('[bumpChallengeStreak] Worker call failed:', err.message);
    return null;
  }
}
