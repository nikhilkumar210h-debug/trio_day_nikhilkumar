import { createNotificationViaWorker } from '../services/notificationWorker.js';

export async function pushSelfNotification(uid, { type, title, body, urlPath = 'tasks.html' }) {
  if (!uid || !type) return;
  return createNotificationViaWorker(uid, {
    type,
    title: String(title || '').slice(0, 100),
    text: String(body || '').slice(0, 200),
    urlPath: String(urlPath || 'tasks.html').slice(0, 160)
  });
}
