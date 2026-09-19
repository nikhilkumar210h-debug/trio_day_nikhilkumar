import { db, auth } from '../firebase-init.js';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { awardXp } from './xp-levels.js';
import { showAchievement } from '../ui/achievements.js';
import { trioCache } from '../trio-cache.js';
import { workerPost } from './worker-config.js';

// ── Counter helper ────────────────────────────────────────────────────────────

/**
 * Send a counter bump to the Worker (server-side atomic increment).
 * action: 'join' | 'leave' | 'like' | 'unlike' | 'comment' | 'complete'
 * Fails silently — counter is best-effort; subcollection doc is the source of truth.
 */
async function bumpCounter(taskId, action) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await workerPost('/gamification/counter', { taskId, action }, user);
  } catch (err) {
    console.warn(`[counter] ${action} on ${taskId} failed:`, err.message);
  }
}

// ── List / read ───────────────────────────────────────────────────────────────

export async function listCommunityTasks({ kind = null, status = 'active', max = 40, includeHidden = false } = {}) {
  const cacheKey = `ctasks_${kind || 'all'}_${status}_${includeHidden ? 'all' : 'pub'}`;
  const cached = trioCache.get(cacheKey);
  if (cached) return cached;

  let q;
  try {
    if (kind) {
      q = query(
        collection(db, 'communityTasks'),
        where('status', '==', status),
        where('kind', '==', kind),
        orderBy('createdAtMs', 'desc'),
        limit(max)
      );
    } else {
      q = query(
        collection(db, 'communityTasks'),
        where('status', '==', status),
        orderBy('createdAtMs', 'desc'),
        limit(max)
      );
    }
    const snap = await getDocs(q);
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const now = Date.now();
    list = list.filter(t => {
      if (t.endAtMs && t.endAtMs <= now) return false;
      if (!includeHidden && t.hidden) return false;
      return true;
    });
    list.sort((a, b) => {
      const af = a.featured ? 1 : 0;
      const bf = b.featured ? 1 : 0;
      if (bf !== af) return bf - af;
      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
    });
    trioCache.set(cacheKey, list, trioCache.TTL.SHORT);
    return list;
  } catch (err) {
    console.warn('listCommunityTasks query failed', err);
    const snap = await getDocs(query(collection(db, 'communityTasks'), limit(max))).catch(() => null);
    let list = snap ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
    const now = Date.now();
    list = list.filter(t => {
      if (t.status !== status) return false;
      if (t.endAtMs && t.endAtMs <= now) return false;
      if (!includeHidden && t.hidden) return false;
      if (kind && t.kind !== kind) return false;
      return true;
    });
    list.sort((a, b) =>
      ((b.featured ? 1 : 0) - (a.featured ? 1 : 0)) ||
      ((b.createdAtMs || 0) - (a.createdAtMs || 0))
    );
    return list;
  }
}

export async function createMysteryCommunityTask(uid, profile, data) {
  if (!uid) throw new Error('Login required to create a challenge');
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('Not authenticated');

  const result = await workerPost('/gamification/create-mystery', {
    title: String(data.title || '').trim(),
    category: data.category,
    difficulty: data.difficulty,
    durationMinutes: Number(data.durationMinutes) || 30,
    xpReward: Number(data.xpReward) || 100,
    startAtMs: Number(data.startAtMs) || Date.now(),
    endAtMs: Number(data.endAtMs) || (Date.now() + 7 * 86400000),
    creatorName: profile?.name || 'User',
    creatorPhoto: profile?.photoURL || null,
    caseData: data.caseData,
    solution: data.solution
  }, user);

  const taskId = result.taskId;
  if (!taskId) throw new Error('Mystery challenge was not created');
  trioCache.invalidatePrefix('ctasks_');
  trioCache.invalidatePrefix('communityTasks_');

  // Creator is automatically accepted so the new case can be previewed immediately.
  await joinTask(taskId, uid, profile).catch(() => {});
  return taskId;
}

export async function getCommunityTask(id) {
  const snap = await getDoc(doc(db, 'communityTasks', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createCommunityTask(uid, profile, data) {
  if (!uid) throw new Error('Login required to create a challenge');
  const now = Date.now();
  const startAtMs = Number(data.startAtMs) || now;
  const endAtMs   = Number(data.endAtMs)   || (now + 7 * 86400000);
  const kind = 'challenge';
  const category = ['Logic','Observation','Speed','Reasoning','Memory','Decision','Knowledge'].includes(data.category) ? data.category : 'Reasoning';
  const difficulty = ['Easy','Medium','Hard'].includes(data.difficulty) ? data.difficulty : 'Medium';
  const durationMinutes = Math.max(1, Math.min(180, Number(data.durationMinutes) || 15));
  const payload = {
    title:        String(data.title       || 'Community challenge').slice(0, 100),
    description:  String(data.description || '').slice(0, 500),
    icon:         String(data.icon        || '🎯').slice(0, 8),
    kind,
    category,
    difficulty,
    durationMinutes,
    objective: String(data.objective || data.description || '').slice(0, 180),
    templateId:   data.templateId || null,
    metric:       data.metric     || 'manual',
    target:       Math.max(1, Number(data.target)    || 1),
    xpReward:     Math.max(1, Math.min(500, Number(data.xpReward) || 50)),
    verificationType: data.verificationType === 'answer' ? 'answer' : 'proof',
    proofInstruction: String(data.proofInstruction || 'Explain what you did and provide enough evidence for the creator to verify it.').slice(0, 500),
    answerHash: String(data.answerHash || '').slice(0, 128),
    creatorUid:   uid,
    creatorName:  profile?.name     || 'User',
    creatorPhoto: profile?.photoURL || null,
    startAtMs,
    endAtMs,
    status:   'active',
    // Moderation flags — only admins may change; always false on create
    featured: false,
    hidden:   false,
    // Counters start at 0; Worker bumps these — no client increment here
    joins:       0,
    solvingNow:  0,
    ratingAverage: 0,
    ratingCount: 0,
    likes:       0,
    comments:    0,
    completions: 0,
    createdAt:   serverTimestamp(),
    createdAtMs: now
  };
  const ref = await addDoc(collection(db, 'communityTasks'), payload);
  trioCache.invalidatePrefix('ctasks_');
  // Auto-join creator
  await joinTask(ref.id, uid, profile);
  return ref.id;
}

// ── Admin moderation ──────────────────────────────────────────────────────────

export async function setChallengeFeature(taskId, featured) {
  await updateDoc(doc(db, 'communityTasks', taskId), { featured: !!featured });
  trioCache.invalidatePrefix('ctasks_');
  trioCache.invalidatePrefix('communityTasks_');
}
// Alias: admin-tasks.js and task-detail.js import this name
export const setChallengeFeatured = setChallengeFeature;

export async function setChallengeHidden(taskId, hidden) {
  await updateDoc(doc(db, 'communityTasks', taskId), { hidden: !!hidden });
  trioCache.invalidatePrefix('ctasks_');
  trioCache.invalidatePrefix('communityTasks_');
}

export async function removeChallenge(taskId) {
  await deleteDoc(doc(db, 'communityTasks', taskId));
  trioCache.invalidatePrefix('ctasks_');
  trioCache.invalidatePrefix('communityTasks_');
}

export async function archiveTask(taskId) {
  await updateDoc(doc(db, 'communityTasks', taskId), { status: 'archived' });
  trioCache.invalidatePrefix('ctasks_');
  trioCache.invalidatePrefix('communityTasks_');
}

export async function expireOldTasks() {
  const now = Date.now();
  const snap = await getDocs(
    query(collection(db, 'communityTasks'), where('status', '==', 'active'), limit(50))
  ).catch(() => null);
  if (!snap) return 0;
  let n = 0;
  for (const d of snap.docs) {
    const t = d.data();
    if (t.endAtMs && t.endAtMs < now) {
      // status update is admin-level — direct write allowed by Firestore rules for admin;
      // for non-admin contexts this will fail silently (server enforces it)
      await updateDoc(d.ref, { status: 'expired' }).catch(() => {});
      n++;
    }
  }
  if (n) trioCache.invalidatePrefix('ctasks_');
  return n;
}

// ── Participation ─────────────────────────────────────────────────────────────

export async function joinTask(taskId, uid, profile) {
  if (!uid) throw new Error('Login required');
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const result = await workerPost('/gamification/membership', { taskId, action: 'join' }, user);
    trioCache.invalidatePrefix('ctasks_');
    trioCache.invalidatePrefix('communityTasks_');
    return !result.already;
  } catch (err) {
    // Backward-compatible fallback while an older Worker is being deployed.
    console.warn('[membership] server join failed, using legacy path:', err.message);
    const memberRef = doc(db, 'communityTasks', taskId, 'members', uid);
    const existing = await getDoc(memberRef);
    if (existing.exists()) return false;
    await setDoc(memberRef, {
      uid,
      name: profile?.name || 'User',
      photoURL: profile?.photoURL || null,
      joinedAtMs: Date.now()
    });
    await bumpCounter(taskId, 'join');
    trioCache.invalidatePrefix('ctasks_');
    trioCache.invalidatePrefix('communityTasks_');
    return true;
  }
}

export async function leaveTask(taskId, uid) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const result = await workerPost('/gamification/membership', { taskId, action: 'leave' }, user);
    trioCache.invalidatePrefix('ctasks_');
    trioCache.invalidatePrefix('communityTasks_');
    return !result.already;
  } catch (err) {
    console.warn('[membership] server leave failed, using legacy path:', err.message);
    await deleteDoc(doc(db, 'communityTasks', taskId, 'members', uid)).catch(() => {});
    await bumpCounter(taskId, 'leave');
    trioCache.invalidatePrefix('ctasks_');
    return true;
  }
}

export async function setChallengePresence(taskId, active) {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await workerPost('/gamification/presence', { taskId, active: !!active }, user);
  } catch (err) {
    console.warn('[presence] update failed:', err.message);
    return null;
  }
}

export async function isMember(taskId, uid) {
  if (!uid) return false;
  const snap = await getDoc(doc(db, 'communityTasks', taskId, 'members', uid));
  return snap.exists();
}

// ── Likes ─────────────────────────────────────────────────────────────────────

export async function toggleLike(taskId, uid) {
  const ref  = doc(db, 'communityTasks', taskId, 'likes', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await deleteDoc(ref);
    await bumpCounter(taskId, 'unlike');
    return false;
  }
  await setDoc(ref, { uid, atMs: Date.now() });
  await bumpCounter(taskId, 'like');
  return true;
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(taskId, uid, profile, text) {
  const txt = String(text || '').trim().slice(0, 199);
  if (!txt) throw new Error('Empty comment');
  await addDoc(collection(db, 'communityTasks', taskId, 'comments'), {
    uid,
    name:        profile?.name || 'User',
    txt,
    createdAt:   serverTimestamp(),
    createdAtMs: Date.now()
  });
  await bumpCounter(taskId, 'comment');
}

export async function listComments(taskId, max = 40) {
  const q = query(
    collection(db, 'communityTasks', taskId, 'comments'),
    orderBy('createdAtMs', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q).catch(() => null);
  return snap ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
}

// ── Complete ──────────────────────────────────────────────────────────────────

export async function completeTask(taskId, uid, profile, verification = {}) {
  const task = await getCommunityTask(taskId);
  if (!task) throw new Error('Task not found');
  if (task.endAtMs && task.endAtMs < Date.now()) throw new Error('Task expired');
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('Not authenticated');

  const result = await workerPost('/gamification/complete-challenge', {
    taskId,
    verificationType: task.verificationType || 'proof',
    answer: String(verification.answer || ''),
    submissionId: verification.submissionId || '',
    caseSolution: verification.caseSolution || null
  }, user);

  trioCache.invalidatePrefix('ctasks_');
  trioCache.invalidatePrefix('communityTasks_');
  trioCache.invalidatePrefix('tasks_');
  trioCache.invalidate(`communityTask_${taskId}`);
  return result;
}

export async function submitProof(taskId, uid, profile, proofText) {
  const task = await getCommunityTask(taskId);
  if (!task) throw new Error('Task not found');
  const text = String(proofText || '').trim().slice(0, 1000);
  if (text.length < 10) throw new Error('Proof should be at least 10 characters.');
  await setDoc(doc(db, 'communityTasks', taskId, 'submissions', uid), {
    uid,
    name: profile?.name || 'User',
    proofText: text,
    status: 'pending',
    createdAtMs: Date.now(),
    reviewedAtMs: null
  });
  return { pending: true };
}

export async function listSubmissions(taskId) {
  const snap = await getDocs(collection(db, 'communityTasks', taskId, 'submissions'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function rateChallenge(taskId, uid, rating, feedback = '') {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('Not authenticated');
  const result = await workerPost('/gamification/rate-challenge', {
    taskId, rating: Number(rating), feedback: String(feedback || '')
  }, user);
  trioCache.invalidatePrefix('ctasks_');
  trioCache.invalidatePrefix('communityTasks_');
  return result;
}

export async function reviewSubmission(taskId, uid, status) {
  const value = status === 'approved' ? 'approved' : 'rejected';
  await updateDoc(doc(db, 'communityTasks', taskId, 'submissions', uid), {
    status: value,
    reviewedAtMs: Date.now()
  });
  return value;
}