// services/notificationHelpers.js — Phase 0 dedupe: single source for pushCopy/pushUrl helpers
// Replaces 3 copies: notifications.js pushCopy/pushUrl + notify-self.js fetch block + auth-ui.js notificationText
import { APP_BASE } from '../onesignal-config.js';

export function pushCopy({ type, actorName, text, title }) {
  const who = actorName || 'Someone';
  const map = {
    like: { title: 'New like', body: `${who} liked your post` },
    comment: { title: 'New comment', body: `${who} commented on your post` },
    share: { title: 'Post shared', body: `${who} shared your post` },
    connect: { title: 'New connection', body: `${who} connected with you` },
    message: { title: 'New message', body: `${who}: ${text || 'New message'}` },
    badge_earned: { title: title || 'Badge unlocked!', body: text || 'You earned a new badge' },
    task_reminder: { title: title || 'Task reminder', body: text || 'You have tasks waiting' },
    challenge_reminder: { title: title || 'Challenge reminder', body: text || 'A challenge needs you' },
    streak_warning: { title: title || 'Streak at risk!', body: text || 'Complete a task today' },
    task_complete: { title: title || 'Task complete', body: text || 'Nice work!' }
  };
  return map[type] || { title: title || 'Trio Day', body: text || `${who} sent you an update` };
}

export function pushUrl({ type, actorUid, postId, urlPath }) {
  if (urlPath) return `${APP_BASE}/${String(urlPath).replace(/^\//, '')}`;
  if (type === 'message') return `${APP_BASE}/chat.html?uid=${encodeURIComponent(actorUid || '')}`;
  if (type === 'connect') {
    return actorUid
      ? `${APP_BASE}/profile.html?uid=${encodeURIComponent(actorUid)}`
      : `${APP_BASE}/all-users.html`;
  }
  if (['task_reminder', 'challenge_reminder', 'streak_warning', 'task_complete'].includes(type)) {
    return `${APP_BASE}/tasks.html`;
  }
  if (type === 'badge_earned') return `${APP_BASE}/profile.html`;
  if (postId) return `${APP_BASE}/view_post.html?postId=${encodeURIComponent(postId)}`;
  return `${APP_BASE}/index.html`;
}

export function notificationText(notification) {
  const who = notification.actorName || 'Someone';
  if (notification.title && ['badge_earned', 'task_reminder', 'challenge_reminder', 'streak_warning', 'task_complete'].includes(notification.type)) {
    return notification.title + (notification.text ? ` — ${notification.text}` : '');
  }
  return {
    like: `${who} liked your post`,
    comment: `${who} commented on your post`,
    share: `${who} shared your post`,
    connect: `${who} connected with you`,
    message: `${who}: ${notification.text || 'New message'}`,
    badge_earned: notification.title || 'New badge unlocked!',
    task_reminder: notification.title || 'Daily tasks waiting',
    challenge_reminder: notification.title || 'Challenge reminder',
    streak_warning: notification.title || 'Streak at risk!',
    task_complete: notification.title || 'Task completed'
  }[notification.type] || `${who} sent you an update`;
}
