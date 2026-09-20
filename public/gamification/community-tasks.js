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
async function bumpCounter(taskId, action, eventId) {
  const user = auth.currentUser;
  if (!user || !eventId) return;
  try {
    await workerPost('/gamification/counter', { taskId, action, eventId: String(eventId) }, user);
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

function normalizeBuildEvidenceState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  if (Array.isArray(raw.order)) out.order = raw.order.slice(0, 8).map(v => String(v || '').slice(0, 70));
  if (Array.isArray(raw.allocation)) out.allocation = raw.allocation.slice(0, 8).map(v => Math.max(0, Number(v) || 0));
  if (raw.positions && typeof raw.positions === 'object') {
    out.positions = Object.fromEntries(
      Object.entries(raw.positions).slice(0, 4).map(([k, v]) => [String(k).slice(0, 40), Number(v)])
    );
  }
  if (raw.assign && typeof raw.assign === 'object') {
    out.assign = Object.fromEntries(
      Object.entries(raw.assign).slice(0, 4).map(([k, v]) => [String(k).slice(0, 40), String(v || '').slice(0, 40)])
    );
  }
  return out;
}

function normalizeInteraction(data) {
  const type = data.activityType;
  const raw = data.interaction && typeof data.interaction === 'object' ? data.interaction : {};

  if (type === 'puzzle' || type === 'learn') {
    const options = Array.isArray(raw.options)
      ? raw.options.slice(0, 4).map(v => String(v || '').trim().slice(0, 180))
      : [];
    while (options.length < 4) options.push('Option ' + String.fromCharCode(65 + options.length));
    return {
      kind: 'quiz',
      question: String(raw.question || '').trim().slice(0, 500),
      options,
      correct: Math.max(0, Math.min(3, Number(raw.correct) || 0)),
      lesson: type === 'learn' ? String(raw.lesson || '').trim().slice(0, 900) : '',
      proofRequired: raw.proofRequired !== false,
      proofPrompt: String(raw.proofPrompt || (
        type === 'learn'
          ? 'Explain the idea in your own words or give a small example.'
          : 'Show your reasoning. What clue, rule or step led you to this answer?'
      )).trim().slice(0, 240)
    };
  }

  if (type === 'build') {
    const mechanic = String(raw.mechanic || data.mechanic || 'order').slice(0, 40);
    const out = { kind:'build', mechanic };
    if (mechanic === 'order') {
      out.items = Array.isArray(raw.items) ? raw.items.slice(0,8).map(v=>String(v||'').trim().slice(0,70)).filter(Boolean) : [];
    } else if (mechanic === 'allocate') {
      out.budget = Math.max(1, Math.min(100000, Number(raw.budget) || 100));
      out.items = Array.isArray(raw.items) ? raw.items.slice(0,8).map(v=>[
        String(v?.[0]||'').trim().slice(0,50),
        Math.max(0, Number(v?.[1]) || 0)
      ]) : [];
    } else if (mechanic === 'grid') {
      out.size=4;
      out.required=Array.isArray(raw.required) ? raw.required.slice(0,4).map(v=>String(v||'').trim().slice(0,40)).filter(Boolean) : [];
      out.blocked=Array.isArray(raw.blocked) ? raw.blocked.filter(v=>Number.isInteger(v)&&v>=0&&v<16).slice(0,8) : [];
      out.adjacentPairs=Array.isArray(raw.adjacentPairs) ? raw.adjacentPairs.slice(0,3).map(p=>Array.isArray(p)?p.slice(0,2).map(v=>String(v||'').slice(0,40)):[]).filter(p=>p.length===2) : [];
    } else if (mechanic === 'assign') {
      out.people=Array.isArray(raw.people) ? raw.people.slice(0,4).map(v=>String(v||'').trim().slice(0,40)) : [];
      out.roles=Array.isArray(raw.roles) ? raw.roles.slice(0,4).map(v=>String(v||'').trim().slice(0,40)) : [];
      out.correct=raw.correct && typeof raw.correct==='object' ? Object.fromEntries(Object.entries(raw.correct).slice(0,4).map(([k,v])=>[String(k).slice(0,40),String(v||'').slice(0,40)])) : {};
    }
    return out;
  }

  if (type === 'challenge') {
    const rounds=Array.isArray(raw.rounds)?raw.rounds.slice(0,5).map(r=>({
      q:String(r?.q||'').trim().slice(0,240),
      o:Array.isArray(r?.o)?r.o.slice(0,4).map(v=>String(v||'').trim().slice(0,160)):[],
      a:Math.max(0,Math.min(3,Number(r?.a)||0))
    })):[]; 
    return { kind:'challenge', rounds };
  }
  return { kind: 'room' };
}

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
    interaction:   normalizeInteraction(data),
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
  const joinedAtMs = Date.now();
  await setDoc(memberRef, {
    uid,
    name:       profile?.name     || 'User',
    photoURL:   profile?.photoURL || null,
    joinedAtMs
  });

  // Bump counter server-side via Worker
  await bumpCounter(taskId, 'join', joinedAtMs);

  trioCache.invalidatePrefix('ctasks_');
  trioCache.invalidatePrefix('communityTasks_');
  trioCache.invalidate(`joined_tasks_${uid}`);
  return true;
}

export async function leaveTask(taskId, uid) {
  const memberRef = doc(db, 'communityTasks', taskId, 'members', uid);
  const existing = await getDoc(memberRef);
  if (!existing.exists()) return;
  const joinedAtMs = existing.data()?.joinedAtMs;
  await deleteDoc(memberRef);
  await bumpCounter(taskId, 'leave', joinedAtMs);

  trioCache.invalidatePrefix('ctasks_');
  trioCache.invalidate(`joined_tasks_${uid}`);
}

export async function getMyJoinedTaskIds(uid, max = 100) {
  if (!uid) return new Set();
  const cacheKey = `joined_tasks_${uid}`;
  const cached = trioCache.get(cacheKey);
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
      if (taskRef?.parent?.id === 'communityTasks') ids.add(taskRef.id);
    });
    trioCache.set(cacheKey, ids, trioCache.TTL.SHORT);
    return ids;
  } catch (err) {
    console.warn('[communityTasks] joined-task query failed:', err);
    return new Set();
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
    const atMs = snap.data()?.atMs;
    await deleteDoc(ref);
    await bumpCounter(taskId, 'unlike', atMs);
    return false;
  }
  const atMs = Date.now();
  await setDoc(ref, { uid, atMs });
  await bumpCounter(taskId, 'like', atMs);
  return true;
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(taskId, uid, profile, text) {
  const txt = String(text || '').trim().slice(0, 199);
  if (!txt) throw new Error('Empty comment');
  const ref = await addDoc(collection(db, 'communityTasks', taskId, 'comments'), {
    uid,
    name:        profile?.name || 'User',
    txt,
    createdAt:   serverTimestamp(),
    createdAtMs: Date.now()
  });
  await bumpCounter(taskId, 'comment', ref.id);
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

export async function completeTask(taskId, uid, profile, evidence = null) {
  const task = await getCommunityTask(taskId);
  if (!task) throw new Error('Task not found');
  if (task.endAtMs && task.endAtMs < Date.now()) throw new Error('Task expired');

  const cref     = doc(db, 'communityTasks', taskId, 'completions', uid);
  const existing = await getDoc(cref);
  const alreadyCompleted = existing.exists();

  // Keep completion idempotent. A retry can still ask the Worker to award a
  // missing XP grant because the Worker itself de-duplicates the grant.
  const atMs = alreadyCompleted ? (Number(existing.data()?.atMs) || Date.now()) : Date.now();
  const safeEvidence = evidence && typeof evidence === 'object'
    ? {
        answerIndex: Number.isInteger(Number(evidence.answerIndex)) ? Number(evidence.answerIndex) : null,
        score: Number.isInteger(Number(evidence.score)) ? Math.max(0, Math.min(5, Number(evidence.score))) : null,
        answers: Array.isArray(evidence.answers)
          ? evidence.answers.slice(0,5).map(v=>Math.max(0,Math.min(3,Number(v)||0)))
          : null,
        proofText: String(evidence.proofText || '').trim().slice(0, 500),
        ...(evidence.buildEvidence && typeof evidence.buildEvidence === 'object'
          ? {
              buildEvidence: {
                mechanic: String(evidence.buildEvidence.mechanic || '').slice(0, 40),
                state: normalizeBuildEvidenceState(evidence.buildEvidence.state)
              }
            }
          : {})
      }
    : null;
  if (!alreadyCompleted) {
    await setDoc(cref, {
      uid,
      name:  profile?.name || 'User',
      atMs,
      ...(safeEvidence ? safeEvidence : {})
    });

    // Bump completions counter server-side
    await bumpCounter(taskId, 'complete', atMs);
    // Auto-join if not already a member
    await joinTask(taskId, uid, profile).catch(() => {});
  }

  // Award XP via Worker (xp-levels.js → Worker → Firestore). The grant key
  // is idempotent, so this also repairs a previous temporary XP failure.
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
  return { already: alreadyCompleted, award };
}
