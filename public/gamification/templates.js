import { db } from '../firebase-init.js';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  query, where, serverTimestamp, limit
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { SYSTEM_TEMPLATES } from './constants.js';
import { trioCache } from '../trio-cache.js';

const CACHE_KEY = 'task_templates_active';

/**
 * FIX #1 — Seed ALL missing system templates, not just check the first one.
 * Never overwrites existing docs (merge:true is safe, but we skip docs
 * that already exist to avoid touching user-customised system templates).
 */
export async function ensureSystemTemplates() {
  const flag = trioCache.get('templates_seeded');
  if (flag) return;

  // Fetch all existing system template IDs in one query instead of
  // probing only the first template.
  let existingIds = new Set();
  try {
    const snap = await getDocs(
      query(collection(db, 'taskTemplates'), where('isSystem', '==', true), limit(200))
    );
    snap.forEach(d => existingIds.add(d.id));
  } catch (_) {
    // Rules may block the query on first install — fall through to per-doc check
  }

  const missing = SYSTEM_TEMPLATES.filter(t => !existingIds.has(t.id));

  if (!missing.length) {
    trioCache.set('templates_seeded', true, trioCache.TTL.LONG);
    return;
  }

  // Seed each missing template. Use merge:true so a partial existing doc
  // is completed without data loss.
  let seeded = 0;
  for (const t of missing) {
    try {
      // Double-check individual doc in case the query above was blocked
      const existing = await getDoc(doc(db, 'taskTemplates', t.id)).catch(() => null);
      if (existing?.exists()) continue;

      await setDoc(doc(db, 'taskTemplates', t.id), {
        ...t,
        createdBy: 'system',
        createdAt: serverTimestamp(),
        createdAtMs: Date.now()
      }, { merge: true });
      seeded++;
    } catch (err) {
      console.warn(`Template seed skipped for ${t.id} (rules?):`, err?.message || err);
    }
  }

  if (seeded) {
    console.log(`[templates] Seeded ${seeded} missing system template(s).`);
    trioCache.invalidatePrefix(CACHE_KEY);
  }
  trioCache.set('templates_seeded', true, trioCache.TTL.LONG);
}

export async function listActiveTemplates({ cadence = null, uid = null } = {}) {
  await ensureSystemTemplates();
  const cacheKey = uid ? `${CACHE_KEY}_${uid}` : CACHE_KEY;
  const cached = trioCache.get(cacheKey);
  let all = cached;
  if (!all) {
    const queries = [
      getDocs(query(
        collection(db, 'taskTemplates'),
        where('active', '==', true),
        where('isSystem', '==', true),
        limit(100)
      )).catch(() => null)
    ];
    if (uid) {
      queries.push(getDocs(query(
        collection(db, 'taskTemplates'),
        where('active', '==', true),
        where('createdBy', '==', uid),
        limit(100)
      )).catch(() => null));
    }
    const snaps = await Promise.all(queries);
    const map = new Map();
    snaps.forEach(snap => snap?.docs?.forEach(d => map.set(d.id, { id: d.id, ...d.data() })));
    all = map.size ? [...map.values()] : SYSTEM_TEMPLATES.map(t => ({ ...t }));
    trioCache.set(cacheKey, all, trioCache.TTL.LONG);
  }
  if (cadence) return all.filter(t => t.cadence === cadence);
  return all;
}

export async function getTemplate(id, uid = null) {
  const list = await listActiveTemplates({ uid });
  const hit = list.find(t => t.id === id);
  if (hit) return hit;
  const snap = await getDoc(doc(db, 'taskTemplates', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createTemplate(uid, data, { isAdmin = false } = {}) {
  const payload = {
    title:       String(data.title || 'Task').slice(0, 80),
    description: String(data.description || '').slice(0, 300),
    icon:        String(data.icon || '🎯').slice(0, 8),
    cadence:     data.cadence || 'daily',
    metric:      data.metric || 'manual',
    target:      Math.max(1, Number(data.target) || 1),
    xpReward:    Math.max(1, Math.min(500, Number(data.xpReward) || 25)),
    badgeId:     data.badgeId || null,
    active:      data.active !== false,
    isSystem:    false,
    createdBy:   uid,
    createdAt:   serverTimestamp(),
    createdAtMs: Date.now()
  };
  if (data.id && isAdmin) {
    await setDoc(doc(db, 'taskTemplates', data.id), payload, { merge: true });
    trioCache.invalidatePrefix(CACHE_KEY);
    return data.id;
  }
  const ref = await addDoc(collection(db, 'taskTemplates'), payload);
  trioCache.invalidatePrefix(CACHE_KEY);
  return ref.id;
}

export async function updateTemplate(id, patch, uid, isAdmin) {
  const ref = doc(db, 'taskTemplates', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Template not found');
  const cur = snap.data();
  if (cur.isSystem && !isAdmin) throw new Error('System templates are admin-only');
  if (!isAdmin && cur.createdBy !== uid) throw new Error('Not allowed');
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
  trioCache.invalidatePrefix(CACHE_KEY);
}

export async function isAdmin(uid) {
  if (!uid) return false;
  const key = `admin_${uid}`;
  const cached = trioCache.get(key);
  if (cached === true) return true;
  if (cached === false) return false;
  const snap = await getDoc(doc(db, 'config', 'admins')).catch(() => null);
  const uids = snap?.exists() ? (snap.data().uids || []) : [];
  const ok = Array.isArray(uids) && uids.includes(uid);
  trioCache.set(key, ok, trioCache.TTL.LONG);
  return ok;
}
