import { db } from '../firebase-init.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { trioCache } from '../trio-cache.js';

const COLLECTION = 'communityTasks';

export async function listCommunityTasks({ kind = 'challenge', status = 'active', max = 40, includeHidden = false } = {}) {
  const cacheKey = `ctasks_${kind || 'challenge'}_${status}_${includeHidden ? 'all' : 'pub'}`;
  const cached = trioCache.get(cacheKey);
  if (cached) return cached;

  try {
    const snap = await getDocs(query(
      collection(db, COLLECTION),
      where('status', '==', status),
      where('kind', '==', 'challenge'),
      orderBy('createdAtMs', 'desc'),
      limit(max)
    ));
    const now = Date.now();
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => {
        const start = Number(t.startAtMs) || 0;
        const end = Number(t.endAtMs) || 0;
        return start <= now && end > now && (includeHidden || !t.hidden);
      });
    list.sort((a, b) =>
      ((b.featured ? 1 : 0) - (a.featured ? 1 : 0)) ||
      ((b.createdAtMs || 0) - (a.createdAtMs || 0))
    );
    trioCache.set(cacheKey, list, trioCache.TTL.SHORT);
    return list;
  } catch (err) {
    console.warn('[communityChallenges] query failed:', err);
    return [];
  }
}

export async function getCommunityChallenge(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.kind !== 'challenge' || data.activityType !== 'challenge') return null;
  return { id: snap.id, ...data };
}

// Backward-compatible name for current callers.
export const getCommunityTask = getCommunityChallenge;

export async function createCommunityTask(uid, profile, data) {
  if (!uid) throw new Error('Login required to create a Challenge');

  const now = Date.now();
  const requestedDays = Number(data.expiresInDays) || 14;
  const expiresInDays = [7, 14, 21, 30, 40].includes(requestedDays) ? requestedDays : 14;
  const startAtMs = now;
  const endAtMs = startAtMs + expiresInDays * 86400000;

  const rawOptions = Array.isArray(data.interaction?.options)
    ? data.interaction.options.map(v => String(v || '').trim().slice(0, 100)).filter(Boolean).slice(0, 5)
    : [];
  if (rawOptions.length < 2) throw new Error('A Challenge needs at least two choices.');

  const payload = {
    title: String(data.title || 'Community Challenge').trim().slice(0, 100),
    description: String(data.description || '').trim().slice(0, 500),
    icon: String(data.icon || '⚡').slice(0, 8),
    kind: 'challenge',
    activityType: 'challenge',
    category: String(data.category || 'Community').trim().slice(0, 60),
    mechanic: 'choice',
    durationMin: 2,
    difficulty: 'Easy',
    goal: 'Choose an answer and compare your thinking with other people.',
    instructions: 'Pick one choice, then join the public discussion.',
    expiresInDays,
    templateId: null,
    metric: 'manual',
    target: 1,
    xpReward: 25,
    interaction: {
      kind: 'choice',
      question: String(data.interaction?.question || data.title || '').trim().slice(0, 240),
      options: rawOptions,
      correct: null,
      proofRequired: false
    },
    creatorUid: uid,
    creatorName: profile?.name || 'User',
    creatorPhoto: profile?.photoURL || null,
    startAtMs,
    endAtMs,
    status: 'active',
    featured: false,
    hidden: false,
    joins: 0,
    likes: 0,
    comments: 0,
    completions: 0,
    createdAt: serverTimestamp(),
    createdAtMs: now
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  trioCache.invalidatePrefix('ctasks_');
  return ref.id;
}

export async function setChallengeFeature(taskId, featured) {
  await updateDoc(doc(db, COLLECTION, taskId), { featured: !!featured });
  trioCache.invalidatePrefix('ctasks_');
}
export const setChallengeFeatured = setChallengeFeature;

export async function setChallengeHidden(taskId, hidden) {
  await updateDoc(doc(db, COLLECTION, taskId), { hidden: !!hidden });
  trioCache.invalidatePrefix('ctasks_');
}

export async function removeChallenge(taskId) {
  await deleteDoc(doc(db, COLLECTION, taskId));
  trioCache.invalidatePrefix('ctasks_');
}

export async function archiveTask(taskId) {
  await updateDoc(doc(db, COLLECTION, taskId), { status: 'archived' });
  trioCache.invalidatePrefix('ctasks_');
}

export async function expireOldTasks() {
  const snap = await getDocs(query(
    collection(db, COLLECTION),
    where('status', '==', 'active'),
    limit(50)
  )).catch(() => null);
  if (!snap) return 0;

  const now = Date.now();
  let n = 0;
  for (const d of snap.docs) {
    const t = d.data();
    if ((Number(t.endAtMs) || 0) <= now) {
      await updateDoc(d.ref, { status: 'expired' }).catch(() => {});
      n++;
    }
  }
  if (n) trioCache.invalidatePrefix('ctasks_');
  return n;
}
