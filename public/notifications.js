import { db } from './firebase-init.js';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { APP_BASE, PUSH_API_URL } from './onesignal-config.js';

function pushCopy({ type, actorName, text, title }) {
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

function pushUrl({ type, actorUid, postId, urlPath }) {
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

async function sendOneSignalPush(recipientUid, payload) {
  if (!PUSH_API_URL) return;
  try {
    const snap = await getDoc(doc(db, 'users', recipientUid));
    const subscriptionId = snap.exists() ? snap.data()?.oneSignalId : null;
    if (!subscriptionId) return;

    const { title, body } = pushCopy(payload);
    const res = await fetch(PUSH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId,
        title,
        body,
        url: pushUrl(payload)
      })
    });
    if (!res.ok) {
      console.warn('OneSignal push HTTP', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.warn('OneSignal push failed', err);
  }
}

export async function notifyUser(recipientUid, { type, actorUid, actorName, postId = null, text = null, title = null, urlPath = null }) {
  if (!recipientUid || !actorUid) return;
  // Allow self notifications for system gamification types
  const selfOk = ['badge_earned', 'task_reminder', 'challenge_reminder', 'streak_warning', 'task_complete'].includes(type);
  if (!selfOk && recipientUid === actorUid) return;
  const payload = {
    type,
    actorUid,
    actorName: String(actorName || 'Someone').slice(0, 50),
    postId: postId || null,
    text: text ? String(text).slice(0, 200) : null,
    title: title ? String(title).slice(0, 100) : null,
    urlPath: urlPath || null
  };
  await addDoc(collection(db, 'users', recipientUid, 'notifications'), {
    ...payload,
    read: false,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now()
  });
  // Fire-and-forget; never block the UI on push delivery.
  sendOneSignalPush(recipientUid, payload);
}
