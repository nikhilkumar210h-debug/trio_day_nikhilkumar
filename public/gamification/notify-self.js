import { db } from '../firebase-init.js';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { APP_BASE, PUSH_API_URL } from '../onesignal-config.js';

/**
 * System/self notification + optional OneSignal push (for reminders & badges).
 */
export async function pushSelfNotification(uid, { type, title, body, urlPath = 'tasks.html' }) {
  if (!uid || !type) return;
  await addDoc(collection(db, 'users', uid, 'notifications'), {
    type,
    actorUid: uid,
    actorName: 'Trio Day',
    title: String(title || '').slice(0, 100),
    text: String(body || '').slice(0, 200),
    read: false,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now()
  }).catch(() => { });

  if (!PUSH_API_URL) return;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const subscriptionId = snap.exists() ? snap.data()?.oneSignalId : null;
    if (!subscriptionId) return;
    const url = `${APP_BASE}/${urlPath.replace(/^\//, '')}`;
    await fetch(PUSH_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId,
        title: title || 'Trio Day',
        body: body || '',
        url
      })
    });
  } catch (err) {
    console.warn('self push failed', err);
  }
}
