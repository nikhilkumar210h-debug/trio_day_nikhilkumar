import { db } from '../firebase-init.js';
import { doc, getDoc, setDoc, runTransaction } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { periodKey, CADENCE } from './constants.js';
import { listActiveTemplates } from './templates.js';
import { awardXp } from './xp-levels.js';
import { bumpStreakOnDailyComplete } from './streaks.js';
import { evaluateBadges } from './badges.js';
import { trioCache } from '../trio-cache.js';
import { showAchievement } from '../ui/achievements.js';

function progressRef(uid, key) {
  return doc(db, 'users', uid, 'progress', key);
}

export async function getProgress(uid, cadence, d = new Date()) {
  const key = periodKey(cadence, d);
  const cacheKey = `progress_${uid}_${key}`;
  const cached = trioCache.get(cacheKey);
  if (cached) return { key, cadence, ...(cached) };

  const snap = await getDoc(progressRef(uid, key));
  const data = snap.exists()
    ? snap.data()
    : { uid, cadence, completions: {}, updatedAtMs: 0 };
  trioCache.set(cacheKey, data, trioCache.TTL.SHORT);
  return { key, ...data };
}

/**
 * Merge templates + progress for UI.
 */
export async function getMergedTasks(uid, cadence) {
  const [templates, progress] = await Promise.all([
    listActiveTemplates({ cadence, uid }),
    getProgress(uid, cadence)
  ]);
  return templates.map(t => {
    const c = progress.completions?.[t.id] || { count: 0, done: false, xpAwarded: 0 };
    return {
      ...t,
      count: Number(c.count) || 0,
      done: !!c.done,
      xpAwarded: Number(c.xpAwarded) || 0,
      periodKey: progress.key
    };
  });
}

/**
 * Increment progress for a template (or metric-matched templates).
 * Awards XP once when crossing target.
 */
export async function bumpProgress(uid, { templateId = null, metric = null, amount = 1, profile = null } = {}) {
  if (!uid || amount <= 0) return [];
  const templates = await listActiveTemplates({ uid });
  const targets = templates.filter(t => {
    if (templateId) return t.id === templateId;
    if (metric) return t.metric === metric;
    return false;
  });
  if (!targets.length) return [];

  const results = [];
  for (const t of targets) {
    const key = periodKey(t.cadence);
    const ref = progressRef(uid, key);
    const cacheKey = `progress_${uid}_${key}`;

    let justCompleted = false;
    let newCount = 0;
    let xpToAward = 0;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : { uid, cadence: t.cadence, completions: {} };
      const completions = { ...(data.completions || {}) };
      const cur = completions[t.id] || { count: 0, done: false, xpAwarded: 0 };
      newCount = (Number(cur.count) || 0) + amount;
      const target = Math.max(1, Number(t.target) || 1);
      const done = newCount >= target;
      justCompleted = done && !cur.done;
      xpToAward = justCompleted ? (Number(t.xpReward) || 0) : 0;

      completions[t.id] = {
        count: newCount,
        done,
        xpAwarded: justCompleted ? xpToAward : (Number(cur.xpAwarded) || 0),
        atMs: done ? Date.now() : (cur.atMs || null)
      };
      tx.set(ref, {
        uid,
        cadence: t.cadence,
        completions,
        updatedAtMs: Date.now()
      }, { merge: true });
    });

    trioCache.invalidate(cacheKey);

    let award = null;
    let badgesEarned = [];
    if (justCompleted && xpToAward > 0) {
      award = await awardXp(uid, xpToAward, { templateId: t.id });
      badgesEarned = award?.badgesEarned || [];
      try {
        await evaluateBadges(uid, {
          xp: award?.xp,
          streakCurrent: award?.streakCurrent,
          extra: { firstComplete: true, templateId: t.id }
        });
      } catch (_) { /* ignore */ }

      if (t.cadence === CADENCE.daily) {
        try { await bumpStreakOnDailyComplete(uid); } catch (_) { /* ignore */ }
      }

      try {
        showAchievement({
          title: t.title,
          subtitle: `+${xpToAward} XP`,
          icon: t.icon || '✅',
          leveledUp: award?.leveledUp,
          level: award?.level,
          badges: badgesEarned
        });
      } catch (_) { /* ignore */ }
    }

    results.push({
      template: t,
      count: newCount,
      done: newCount >= (Number(t.target) || 1),
      justCompleted,
      award,
      badgesEarned
    });
  }
  return results;
}

/** Manual complete / increment button for manual & drink_water / read_minutes. */
export async function manualBump(uid, templateId, amount = 1) {
  return bumpProgress(uid, { templateId, amount });
}
