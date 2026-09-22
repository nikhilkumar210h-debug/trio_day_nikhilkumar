// Shared notification helpers for current Story, Challenge, Chat and connection flows.
import { createNotificationViaWorker } from './notificationWorker.js';
import { APP_BASE } from '../onesignal-config.js';

export async function notifyUser(targetUid, data) {
  if (!targetUid) return;
  return createNotificationViaWorker(targetUid, data);
}

export function pushCopy({ type, actorName, text, title }) {
  const who = actorName || 'Someone';
  const map = {
    like: { title: 'New like', body: `${who} liked your story` },
    comment: { title: 'New comment', body: `${who} commented on your story` },
    share: { title: 'Story shared', body: `${who} shared your story` },
    connect: { title: 'New connection', body: `${who} connected with you` },
    message: { title: 'New message', body: `${who}: ${text || 'New message'}` },
    badge_earned: { title: title || 'Badge unlocked!', body: text || 'You earned a new badge' },
    challenge_reminder: { title: title || 'Challenge reminder', body: text || 'A challenge is waiting for you' }
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
  if (type === 'challenge_reminder') return `${APP_BASE}/challenge.html`;
  if (type === 'badge_earned') return `${APP_BASE}/profile.html`;
  // postId is retained as the legacy story identifier in existing notifications.
  // Stories are now opened from Today, never through the retired Post viewer.
  if (postId) return `${APP_BASE}/index.html`;
  return `${APP_BASE}/index.html`;
}

export function notificationText(notification) {
  const who = notification.actorName || 'Someone';
  if (notification.title && ['badge_earned', 'challenge_reminder'].includes(notification.type)) {
    return notification.title + (notification.text ? ` — ${notification.text}` : '');
  }
  return {
    like: `${who} liked your story`,
    comment: `${who} commented on your story`,
    share: `${who} shared your story`,
    connect: `${who} connected with you`,
    message: `${who}: ${notification.text || 'New message'}`,
    badge_earned: notification.title || 'New badge unlocked!',
    challenge_reminder: notification.title || 'Challenge reminder'
  }[notification.type] || `${who} sent you an update`;
}
