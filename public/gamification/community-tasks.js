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
      const start = Number(t.startAtMs) || 0;
      const effectiveEnd = Number(t.endAtMs) || ((Number(t.createdAtMs) || now) + 30 * 86400000);
      if (start > now || effectiveEnd <= now) return false;
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
      const start = Number(t.startAtMs) || 0;
      const effectiveEnd = Number(t.endAtMs) || ((Number(t.createdAtMs) || now) + 30 * 86400000);
      if (start > now || effectiveEnd <= now) return false;
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

export async function getCommunityTask(id) {
  const snap = await getDoc(doc(db, 'communityTasks', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createCommunityTask(uid, profile, data) {
  if (!uid) throw new Error('Login required to create a challenge');
  const now = Date.now();
  const startAtMs = now;
  const requestedDays = Number(data.expiresInDays) || 14;
  const expiresInDays = [7,14,21,30,40].includes(requestedDays) ? requestedDays : 14;
  const minimumEnd = startAtMs + expiresInDays * 86400000;
  const requestedEnd = Number(data.endAtMs) || minimumEnd;
  const endAtMs = Math.min(Math.max(requestedEnd, minimumEnd), now + 40 * 86400000);
  const kind = ['community', 'challenge', 'seasonal'].includes(data.kind) ? data.kind : 'challenge';
  const payload = {
    title:        String(data.title       || 'Community challenge').slice(0, 100),
    description:  String(data.description || '').slice(0, 500),
    icon:         String(data.icon        || '🎯').slice(0, 8),
    kind,
    activityType: ['puzzle','build','learn','challenge','game'].includes(data.activityType) ? data.activityType : (kind === 'challenge' ? 'challenge' : 'game'),
    category: String(data.category || 'General').slice(0, 60),
    mechanic: String(data.mechanic || 'custom').slice(0, 40),
    durationMin: Math.max(5, Math.min(180, Number(data.durationMin) || 20)),
    difficulty: ['Easy','Medium','Hard'].includes(data.difficulty) ? data.difficulty : 'Medium',
    goal: String(data.goal || '').slice(0, 240),
    instructions: String(data.instructions || '').slice(0, 900),
    expiresInDays,
    templateId:   data.templateId || null,
    metric:       data.metric     || 'manual',
    target:       Math.max(1, Number(data.target)    || 1),
    xpReward:     Math.max(1, Math.min(500, Number(data.xpReward) || 50)),
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
  const memberRef = doc(db, 'communityTasks', taskId, 'members', uid);
  const existing  = await getDoc(memberRef);
  if (existing.exists()) return false;

  // Write subcollection doc (client rules allow create if owner)
  await setDoc(memberRef, {
    uid,
    name:       profile?.name     || 'User',
    photoURL:   profile?.photoURL || null,
    joinedAtMs: Date.now()
  });

  // Bump counter server-side via Worker
  await bumpCounter(taskId, 'join');

  trioCache.invalidatePrefix('ctasks_');
  trioCache.invalidatePrefix('communityTasks_');
  return true;
}

export async function leaveTask(taskId, uid) {
  await deleteDoc(doc(db, 'communityTasks', taskId, 'members', uid)).catch(() => {});

  // Decrement counter server-side via Worker
  await bumpCounter(taskId, 'leave');

  trioCache.invalidatePrefix('ctasks_');
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

export async function completeTask(taskId, uid, profile) {
  const task = await getCommunityTask(taskId);
  if (!task) throw new Error('Task not found');
  if (task.endAtMs && task.endAtMs < Date.now()) throw new Error('Task expired');

  const cref     = doc(db, 'communityTasks', taskId, 'completions', uid);
  const existing = await getDoc(cref);
  if (existing.exists()) return { already: true };

  // Write completion subcollection doc (client rules: owner create only)
  await setDoc(cref, {
    uid,
    name:  profile?.name || 'User',
    atMs:  Date.now()
  });

  // Bump completions counter server-side
  await bumpCounter(taskId, 'complete');

  // Auto-join if not already a member
  await joinTask(taskId, uid, profile).catch(() => {});

  // Award XP via Worker (xp-levels.js → Worker → Firestore)
  const xp    = Number(task.xpReward) || 50;
  const award = await awardXp(uid, xp, { communityTaskId: taskId, templateId: task.templateId });

  try {
    showAchievement({
      title:    task.title,
      subtitle: `+${xp} XP`,
      icon:     task.icon || '🎯',
      leveledUp: award?.leveledUp,
      level:     award?.level,
      badges:    award?.badgesEarned || []
    });
  } catch (_) { /* ignore */ }

  trioCache.invalidatePrefix('ctasks_');
  trioCache.invalidatePrefix('communityTasks_');
  trioCache.invalidatePrefix('tasks_');
  trioCache.invalidate(`communityTask_${taskId}`);
  return { already: false, award };
}
