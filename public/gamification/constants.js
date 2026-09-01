/** Shared constants & period-key helpers for gamification. */

export const XP_PER_LEVEL = 100; // level = floor(xp / 100) + 1
export const LEADERBOARD_TOP_N = 50;
export const PROGRESS_RETENTION = { dailyDays: 14, weeklyWeeks: 8, monthlyMonths: 6 };

export const METRICS = {
  manual: 'manual',
  drink_water: 'drink_water',
  read_minutes: 'read_minutes',
  comment_posts: 'comment_posts',
  give_likes: 'give_likes',
  get_likes: 'get_likes',
  create_post: 'create_post',
  custom: 'custom',
  // Fun new metrics
  laugh_minutes: 'laugh_minutes',
  smile_shares: 'smile_shares',
  dance_breaks: 'dance_breaks',
  good_vibes: 'good_vibes'
};

export const CADENCE = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
  once: 'once'
};

export const NOTIF_TYPES = [
  'like', 'comment', 'share', 'connect', 'message',
  'badge_earned', 'task_reminder', 'challenge_reminder', 'streak_warning', 'task_complete'
];

function pad(n) { return String(n).padStart(2, '0'); }

/** Local calendar date YYYY-MM-DD */
export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO-like week key: YYYY-Www (Mon-start) */
export function localWeekKey(d = new Date()) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (date.getDay() + 6) % 7; // Mon=0
  date.setDate(date.getDate() - day + 3);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNo = 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${date.getFullYear()}-W${pad(weekNo)}`;
}

export function localMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function periodKey(cadence, d = new Date()) {
  if (cadence === CADENCE.daily) return `d_${localDateKey(d)}`;
  if (cadence === CADENCE.weekly) return `w_${localWeekKey(d)}`;
  if (cadence === CADENCE.monthly) return `m_${localMonthKey(d)}`;
  return `o_${localDateKey(d)}`;
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

/** Default system templates (seeded once). */
export const SYSTEM_TEMPLATES = [
  {
    id: 'sys_water',
    title: 'Drink water',
    description: 'Log 8 glasses of water today',
    icon: '💧',
    cadence: 'daily',
    metric: 'drink_water',
    target: 8,
    xpReward: 40,
    badgeId: null,
    active: true,
    isSystem: true
  },
  {
    id: 'sys_read',
    title: 'Study 1 hour',
    description: 'Read or study for 60 minutes',
    icon: '📚',
    cadence: 'daily',
    metric: 'read_minutes',
    target: 60,
    xpReward: 60,
    badgeId: null,
    active: true,
    isSystem: true
  },
  {
    id: 'sys_comment',
    title: 'Comment on 5 posts',
    description: 'Leave thoughtful comments on 5 posts',
    icon: '💬',
    cadence: 'daily',
    metric: 'comment_posts',
    target: 5,
    xpReward: 50,
    badgeId: null,
    active: true,
    isSystem: true
  },
  {
    id: 'sys_give_likes',
    title: 'Give 10 likes',
    description: 'Like 10 community posts today',
    icon: '♡',
    cadence: 'daily',
    metric: 'give_likes',
    target: 10,
    xpReward: 40,
    badgeId: null,
    active: true,
    isSystem: true
  },
  {
    id: 'sys_get_likes',
    title: 'Get 10 likes',
    description: 'Receive 10 likes on your posts this week',
    icon: '⭐',
    cadence: 'weekly',
    metric: 'get_likes',
    target: 10,
    xpReward: 80,
    badgeId: null,
    active: true,
    isSystem: true
  },
  {
    id: 'sys_post',
    title: 'Share a post',
    description: 'Upload 1 new post today',
    icon: '📝',
    cadence: 'daily',
    metric: 'create_post',
    target: 1,
    xpReward: 50,
    badgeId: 'badge_first_post',
    active: true,
    isSystem: true
  },
  {
    id: 'sys_weekly_posts',
    title: 'Weekly creator',
    description: 'Create 5 posts this week',
    icon: '🔥',
    cadence: 'weekly',
    metric: 'create_post',
    target: 5,
    xpReward: 120,
    badgeId: null,
    active: true,
    isSystem: true
  },
  {
    id: 'sys_monthly_engage',
    title: 'Monthly engager',
    description: 'Comment on 30 posts this month',
    icon: '🏅',
    cadence: 'monthly',
    metric: 'comment_posts',
    target: 30,
    xpReward: 200,
    badgeId: 'badge_engager',
    active: true,
    isSystem: true
  }
];

// Fun system templates for new metrics
export const FUN_SYSTEM_TEMPLATES = [
  {
    id: 'fun_laughs',
    title: 'Laugh Out Loud',
    description: 'Laugh for 5 minutes today',
    icon: '😂',
    cadence: 'daily',
    metric: 'laugh_minutes',
    target: 5,
    xpReward: 30,
    badgeId: 'badge_first_laugh',
    active: true,
    isSystem: true
  },
  {
    id: 'fun_smiles',
    title: 'Spread Smiles',
    description: 'Share 5 smiles today',
    icon: '😊',
    cadence: 'daily',
    metric: 'smile_shares',
    target: 5,
    xpReward: 30,
    badgeId: 'badge_smile_spreader',
    active: true,
    isSystem: true
  },
  {
    id: 'fun_dance',
    title: 'Dance Break',
    description: 'Take a 5-minute dance break',
    icon: '💃',
    cadence: 'daily',
    metric: 'dance_breaks',
    target: 1,
    xpReward: 40,
    badgeId: 'badge_dancer',
    active: true,
    isSystem: true
  },
  {
    id: 'fun_goodvibes',
    title: 'Good Vibes Only',
    description: 'Send 3 positive comments today',
    icon: '✨',
    cadence: 'daily',
    metric: 'good_vibes',
    target: 3,
    xpReward: 35,
    badgeId: 'badge_positivity',
    active: true,
    isSystem: true
  }
];

export const SYSTEM_BADGES = [
  { id: 'badge_first_complete', name: 'First Win', icon: '🎯', desc: 'Complete your first task', rule: 'first_complete' },
  { id: 'badge_first_post', name: 'Storyteller', icon: '📝', desc: 'Share your first post task', rule: 'template_sys_post' },
  { id: 'badge_streak_3', name: 'On Fire', icon: '🔥', desc: '3-day streak', rule: 'streak_3' },
  { id: 'badge_streak_7', name: 'Week Warrior', icon: '⚡', desc: '7-day streak', rule: 'streak_7' },
  { id: 'badge_streak_30', name: 'Unstoppable', icon: '💎', desc: '30-day streak', rule: 'streak_30' },
  { id: 'badge_xp_500', name: 'Rising Star', icon: '✨', desc: 'Reach 500 XP', rule: 'xp_500' },
  { id: 'badge_xp_1000', name: 'Legend', icon: '👑', desc: 'Reach 1000 XP', rule: 'xp_1000' },
  { id: 'badge_engager', name: 'Community Voice', icon: '🗣️', desc: 'Complete monthly engager', rule: 'template_sys_monthly_engage' }
];
