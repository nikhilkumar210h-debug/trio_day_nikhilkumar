/** Shared constants for Challenge gamification. */

export const XP_PER_LEVEL = 100;
export const LEADERBOARD_TOP_N = 50;
export const PROGRESS_RETENTION = { weeklyWeeks: 8, monthlyMonths: 6 };

export const NOTIF_TYPES = [
  'like',
  'comment',
  'share',
  'connect',
  'message',
  'badge_earned',
  'challenge_reminder'
];

function pad(n) { return String(n).padStart(2, '0'); }

export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localWeekKey(d = new Date()) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day + 3);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNo = 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${date.getFullYear()}-W${pad(weekNo)}`;
}

export function localMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function yesterdayDateKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
}

export function levelFromXp(xp) {
  return Math.floor(Math.max(0, Number(xp) || 0) / XP_PER_LEVEL) + 1;
}

export function xpIntoLevel(xp) {
  return Math.max(0, Number(xp) || 0) % XP_PER_LEVEL;
}

export function xpForNextLevel(xp) {
  return XP_PER_LEVEL - xpIntoLevel(xp);
}

/**
 * Challenge progression badges. No Post/Activity/Task badges remain.
 */
export const SYSTEM_BADGES = [
  { id: 'badge_first_complete', name: 'First Challenge', icon: '🎯', desc: 'Complete your first Challenge', rule: 'first_complete' },
  { id: 'badge_streak_3', name: 'On Fire', icon: '🔥', desc: 'Reach a 3-day Challenge streak', rule: 'streak_3' },
  { id: 'badge_streak_7', name: 'Week Warrior', icon: '⚡', desc: 'Reach a 7-day Challenge streak', rule: 'streak_7' },
  { id: 'badge_streak_30', name: 'Unstoppable', icon: '💎', desc: 'Reach a 30-day Challenge streak', rule: 'streak_30' },
  { id: 'badge_xp_500', name: 'Rising Star', icon: '✨', desc: 'Reach 500 Challenge XP', rule: 'xp_500' },
  { id: 'badge_xp_1000', name: 'Legend', icon: '👑', desc: 'Reach 1000 Challenge XP', rule: 'xp_1000' }
];
