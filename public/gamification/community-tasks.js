import { db, auth } from '../firebase-init.js';
import {
  collection, collectionGroup, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { trioCache } from '../trio-cache.js';

const COLLECTION = 'communityTasks';

export async function listCommunityTasks({ status = 'active', max = 40, includeHidden = false } = {}) {
  const cacheKey = `ctasks_challenge_${status}_${includeHidden ? 'all' : 'pub'}`;
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
      .filter(t => t.activityType === 'challenge' && (includeHidden || !t.hidden))
      .filter(t => (Number(t.startAtMs) || 0) <= now && (Number(t.endAtMs) || 0) > now);
    list.sort((a, b) =>
      ((b.featured ? 1 : 0) - (a.featured ? 1 : 0)) ||
      ((Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0))
    );
    trioCache.set(cacheKey, list, trioCache.TTL.SHORT);
    return list;
  } catch (err) {
    console.warn('[communityChallenges] query failed:', err);
    return [];
  }
}

export async function getCommunityTask(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.kind !== 'challenge' || data.activityType !== 'challenge') return null;
  return { id: snap.id, ...data };
}

export async function createCommunityTask(uid, profile, data) {
  if (!uid) throw new Error('Login required to create a Challenge');

  const now = Date.now();
  const requestedDays = Number(data.expiresInDays) || 14;
  const expiresInDays = [7, 14, 21, 30, 40].includes(requestedDays) ? requestedDays : 14;
  const startAtMs = now;
  const endAtMs = startAtMs + expiresInDays * 86400000;
  const options = Array.isArray(data.interaction?.options)
    ? data.interaction.options.map(v => String(v || '').trim().slice(0, 100)).filter(Boolean).slice(0, 5)
    : [];

  if (options.length < 2) throw new Error('A Challenge needs at least two choices.');

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
    metric: 'manual',
    target: 1,
    xpReward: 25,
    interaction: {
      kind: 'choice',
      question: String(data.interaction?.question || data.title || '').trim().slice(0, 240),
      options,
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
  await joinTask(ref.id, uid, profile);
  trioCache.invalidatePrefix('ctasks_');
  return ref.id;
}

export async function joinTask(taskId, uid, profile) {
  if (!taskId || !uid) return false;
  const memberRef = doc(db, COLLECTION, taskId, 'members', uid);
  const existing = await getDoc(memberRef);
  if (existing.exists()) return false;

  const joinedAtMs = Date.now();
  await setDoc(memberRef, {
    uid,
    name: profile?.name || 'User',
    photoURL: profile?.photoURL || null,
    joinedAtMs
  });
  trioCache.invalidate(`joined_challenges_${uid}`);
  return true;
}

export async function leaveTask(taskId, uid) {
  if (!taskId || !uid) return;
  await deleteDoc(doc(db, COLLECTION, taskId, 'members', uid));
  trioCache.invalidate(`joined_challenges_${uid}`);
}

export async function getMyJoinedTaskIds(uid, max = 100) {
  if (!uid) return new Set();
  const key = `joined_challenges_${uid}`;
  const cached = trioCache.get(key);
  if (cached instanceof Set) return cached;
  try {
    const snap = await getDocs(query(
      collectionGroup(db, 'members'),
      where('uid', '==', uid),
      limit(max)
    ));
    const ids = new Set();
    snap.docs.forEach(d => {
      const taskRef = d.ref.parent?.parent;
      if (taskRef?.parent?.id === COLLECTION) ids.add(taskRef.id);
    });
    trioCache.set(key, ids, trioCache.TTL.SHORT);
    return ids;
  } catch (err) {
    console.warn('[communityChallenges] joined query failed:', err);
    return new Set();
  }
}

export async function isMember(taskId, uid) {
  if (!taskId || !uid) return false;
  const snap = await getDoc(doc(db, COLLECTION, taskId, 'members', uid)).catch(() => null);
  return !!snap?.exists();
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
    where('kind', '==', 'challenge'),
    limit(50)
  )).catch(() => null);
  if (!snap) return 0;
  const now = Date.now();
  let n = 0;
  for (const d of snap.docs) {
    if ((Number(d.data().endAtMs) || 0) <= now) {
      await updateDoc(d.ref, { status: 'expired' }).catch(() => {});
      n++;
    }
  }
  if (n) trioCache.invalidatePrefix('ctasks_');
  return n;
}
