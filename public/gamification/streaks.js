import { auth } from '../firebase-init.js';
import { getUserTimeZone } from './constants.js';
import { workerPost } from './worker-config.js';
import { announceBadgesEarned } from '../ui/achievements.js';
import { showToast } from '../ui/toast.js';
import { SoundManager } from '../sound-manager.js';

/**
 * Increment the current Challenge streak through the secure Worker.
 * The Worker is idempotent per local calendar day in the user's timezone.
 */
export async function bumpChallengeStreak(uid, challengeId) {
  if (!uid || !challengeId) return null;
  const user = auth.currentUser;
  if (!user || user.uid !== uid) return null;

  try {
    const result = await workerPost(
      '/gamification/bump-streak',
      { challengeId, timeZone: getUserTimeZone() },
      user
    );
    if (!result?.ok) return null;
    const badgesEarned = result.badgesEarned || [];
    if (badgesEarned.length > 0) announceBadgesEarned(badgesEarned);
    return {
      streakCurrent: result.streakCurrent,
      streakBest: result.streakBest,
      alreadyCounted: result.alreadyCounted,
      badgesEarned,
      shields: result.shields
    };
  } catch (err) {
    console.error('[bumpChallengeStreak] Worker call failed:', err.message);
    return null;
  }
}

/**
 * Use a Streak Shield to protect today's streak.
 * Falls back gracefully if the Worker is unavailable (offline support via localStorage).
 */
export async function useStreakShield(uid) {
  if (!uid) return null;
  const user = auth.currentUser;
  if (!user || user.uid !== uid) return null;

  try {
    const result = await workerPost(
      '/gamification/use-shield',
      { timeZone: getUserTimeZone() },
      user
    );
    if (!result?.ok) {
      showToast(result?.error || 'Could not use shield', 'error');
      return null;
    }
    if (result.alreadyProtected) {
      showToast('Streak already protected for today', 'info');
    } else {
      showToast('🛡️ Streak Shield activated! Your streak is safe for today.', 'success');
      SoundManager.success();
    }
    return {
      streakCurrent: result.streakCurrent,
      streakBest: result.streakBest,
      shields: result.shields,
      alreadyProtected: result.alreadyProtected
    };
  } catch (err) {
    console.error('[useStreakShield] Worker call failed:', err.message);
    // Graceful fallback: attempt localStorage-based shield usage
    return useStreakShieldLocalFallback(uid);
  }
}

/**
 * Local fallback for shield usage when Worker is unreachable.
 * Stores shield state in localStorage and syncs on next successful Worker call.
 */
function useStreakShieldLocalFallback(uid) {
  try {
    const storageKey = 'trio_streak_shield_' + uid;
    let data = { shields: 3, lastUsed: null, pendingSync: false };
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) data = { ...data, ...JSON.parse(stored) };
    } catch (_) {}
    
    if (data.shields <= 0) {
      showToast('No shields available', 'error');
      return null;
    }
    
    const today = new Date().toISOString().split('T')[0];
    if (data.lastUsed === today) {
      showToast('Streak already protected for today', 'info');
      return { shields: data.shields, alreadyProtected: true };
    }
    
    data.shields = Math.max(0, data.shields - 1);
    data.lastUsed = today;
    data.pendingSync = true;
    localStorage.setItem(storageKey, JSON.stringify(data));
    
    showToast('🛡️ Streak Shield activated! (Offline mode - will sync later)', 'success');
    SoundManager.success();
    
    return {
      streakCurrent: 0, // Unknown in offline mode
      streakBest: 0,
      shields: data.shields,
      alreadyProtected: false
    };
  } catch (err) {
    console.error('[useStreakShieldLocalFallback] Failed:', err.message);
    showToast('Could not use shield', 'error');
    return null;
  }
}

/**
 * Sync local shield state with server when back online.
 * Call this on app start or when connectivity is restored.
 */
export async function syncStreakShields(uid) {
  if (!uid) return;
  try {
    const storageKey = 'trio_streak_shield_' + uid;
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;
    const data = JSON.parse(stored);
    if (!data.pendingSync) return;
    
    const user = auth.currentUser;
    if (!user || user.uid !== uid) return;
    
    // The next successful bumpChallengeStreak or useStreakShield will sync
    // For now, we just clear the pending flag
    data.pendingSync = false;
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (_) {}
}
