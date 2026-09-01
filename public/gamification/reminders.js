import { getMergedTasks } from './progress.js';
import { isStreakAtRisk } from './streaks.js';
import { pushSelfNotification } from './notify-self.js';
import { listCommunityTasks } from './community-tasks.js';
import { localDateKey } from './constants.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from '../firebase-init.js';

const LS_KEY = 'trio_reminder_day';

/**
 * App-open reminder engine (Spark-safe). Runs at most once per local day.
 */
export async function runAppOpenReminders(uid) {
  if (!uid) return;
  const today = localDateKey();
  try {
    if (localStorage.getItem(LS_KEY) === today) return;
  } catch (_) { /* ignore */ }

  const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
  const userData = userSnap?.exists() ? userSnap.data() : {};

  // Streak warning
  if (isStreakAtRisk(userData)) {
    await pushSelfNotification(uid, {
      type: 'streak_warning',
      title: 'Streak at risk!',
      body: `Your ${userData.streakCurrent || ''}-day streak breaks if you skip today.`,
      urlPath: 'tasks.html'
    }).catch(() => { });
  }

  // Incomplete daily tasks
  try {
    const daily = await getMergedTasks(uid, 'daily');
    const pending = daily.filter(t => !t.done);
    if (pending.length) {
      await pushSelfNotification(uid, {
        type: 'task_reminder',
        title: 'Daily tasks waiting',
        body: `${pending.length} task${pending.length > 1 ? 's' : ''} left today — keep your streak!`,
        urlPath: 'tasks.html'
      }).catch(() => { });
    }
  } catch (_) { /* ignore */ }

  // Active challenges ending soon (< 48h)
  try {
    const challenges = await listCommunityTasks({ kind: 'challenge', status: 'active', max: 10 });
    const soon = challenges.filter(c => c.endAtMs && c.endAtMs - Date.now() < 48 * 3600000 && c.endAtMs > Date.now());
    if (soon.length) {
      await pushSelfNotification(uid, {
        type: 'challenge_reminder',
        title: 'Challenge ending soon',
        body: `"${soon[0].title}" ends soon — finish it!`,
        urlPath: `task-detail.html?id=${encodeURIComponent(soon[0].id)}`
      }).catch(() => { });
    }
  } catch (_) { /* ignore */ }

  try { localStorage.setItem(LS_KEY, today); } catch (_) { /* ignore */ }
}
