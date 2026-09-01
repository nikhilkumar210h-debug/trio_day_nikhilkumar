import { db } from './firebase-init.js';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { PUSH_API_URL } from './onesignal-config.js';
import { pushCopy, pushUrl } from './services/notificationHelpers.js';

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
