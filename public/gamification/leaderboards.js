import { db } from '../firebase-init.js';
import { doc, getDoc, getDocs, collection, query, where, documentId } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { localMonthKey, localWeekKey } from './constants.js';
import { trioCache } from '../trio-cache.js';

/**
 * leaderboards.js — READ-ONLY client module.
 *
 * All leaderboard WRITES now happen exclusively in the Cloudflare Worker
 * (workers/gamification.js) via the service account.  The client may only:
 *   - read leaderboard documents (getLeaderboard, getMyGlobalRank)
 *   - read user docs for the friends leaderboard (friendsLeaderboard)
 *
 * upsertLeaderboards is intentionally removed. It is called by the Worker
 * internally after every awardXp / bumpStreak request.
 */

// ── Board ID helpers (kept here so leaderboard.js page can call currentBoardIds) ──

function boardIds() {
  return {
    global:  'global',
    weekly:  `weekly_${localWeekKey()}`,
    monthly: `monthly_${localMonthKey()}`,
    streak:  'streak'
  };
}

export function currentBoardIds() { return boardIds(); }

// ── Read helpers ──────────────────────────────────────────────────────────────

/**
 * Fetch a leaderboard document by ID.
 * Returns { entries: [...] } (cached with SHORT TTL).
 */
export async function getLeaderboard(boardId) {
  const cacheKey = `lb_${boardId}`;
  const cached = trioCache.get(cacheKey);
  if (cached) return cached;

  const snap = await getDoc(doc(db, 'leaderboards', boardId));
  const data = snap.exists() ? snap.data() : { entries: [] };
  trioCache.set(cacheKey, data, trioCache.TTL.SHORT);
  return data;
}

/**
 * Get the current user's rank on the global leaderboard (1-indexed).
 * Returns null if the user is not in the top-N list.
 * Cached with SHORT TTL; invalidated by the trio-xp-changed event in xp-levels.js.
 */
export async function getMyGlobalRank(uid) {
  if (!uid) return null;
  const cacheKey = `my_rank_${uid}`;
  const cached = trioCache.get(cacheKey);
  if (cached !== null) return cached;

  try {
    const data = await getLeaderboard('global');
    const entries = data.entries || [];
    const idx = entries.findIndex(e => e.uid === uid);
    const rank = idx >= 0 ? idx + 1 : null;
    trioCache.set(cacheKey, rank, trioCache.TTL.SHORT);
    return rank;
  } catch (_) { return null; }
}

/**
 * Friends leaderboard: fetch following users' profiles and sort client-side.
 * Values come from users/{uid} docs (read-only for the client), so they are
 * always authoritative — the client cannot inflate them here because it is only
 * reading, not writing.
 */
export async function friendsLeaderboard(myUid, followingIds, valueKey = 'xp') {
  if (!followingIds?.length) return [];

  // Firestore 'in' limit 10 → batch
  const chunks = [];
  for (let i = 0; i < followingIds.length; i += 10)
    chunks.push(followingIds.slice(i, i + 10));

  const users = [];
  for (const chunk of chunks) {
    const q = query(
      collection(db, 'users'),
      where(documentId(), 'in', chunk)
    );
    const snap = await getDocs(q).catch(() => null);
    if (!snap) continue;
    snap.forEach(d => users.push({ uid: d.id, ...d.data() }));
  }

  // Include self
  const me = await getDoc(doc(db, 'users', myUid)).catch(() => null);
  if (me?.exists()) users.push({ uid: myUid, ...me.data() });

  return users
    .map(u => ({
      uid:      u.uid,
      name:     u.name      || 'User',
      photoURL: u.photoURL  || null,
      level:    u.level     || levelGuess(u.xp),
      value:    Number(u[valueKey]) || 0
    }))
    .sort((a, b) => b.value - a.value);
}

function levelGuess(xp) {
  return Math.floor(Math.max(0, Number(xp) || 0) / 100) + 1;
}
