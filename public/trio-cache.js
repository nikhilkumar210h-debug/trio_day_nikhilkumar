/**
 * trio-cache.js — Central in-memory + localStorage cache with TTL
 *
 * Usage:
 *   import { trioCache } from './trio-cache.js';
 *
 *   // Store something (TTL in ms, default 5 min)
 *   trioCache.set('user_abc123', data, 5 * 60 * 1000);
 *
 *   // Retrieve (returns null if missing or expired)
 *   const data = trioCache.get('user_abc123');
 *
 *   // Invalidate one key
 *   trioCache.invalidate('user_abc123');
 *
 *   // Invalidate all keys matching a prefix
 *   trioCache.invalidatePrefix('user_');
 */

const DEFAULT_TTL = 5 * 60 * 1000;   // 5 minutes
const SHORT_TTL   = 2 * 60 * 1000;   // 2 minutes  — connection states, counts
const LONG_TTL    = 10 * 60 * 1000;  // 10 minutes — static lists like all-users

// ── In-memory store (primary, fast) ─────────────────────────────────────────
// Structure: Map<key, { data, expiresAt }>
const memStore = new Map();

// ── localStorage store (secondary, survives page navigation) ────────────────
const LS_PREFIX = 'trio_cache_';

function lsGet(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) { localStorage.removeItem(LS_PREFIX + key); return null; }
    return data;
  } catch { return null; }
}

function lsSet(key, data, ttl) {
  try {
    // Only persist plain-serialisable data (skip Firestore Timestamp objects etc.)
    const serialised = JSON.stringify({ data, expiresAt: Date.now() + ttl });
    localStorage.setItem(LS_PREFIX + key, serialised);
  } catch {
    // localStorage quota exceeded or private mode — silently skip
  }
}

function lsDel(key) {
  try { localStorage.removeItem(LS_PREFIX + key); } catch { }
}

// ── Public API ───────────────────────────────────────────────────────────────
export const trioCache = {
  /**
   * Get a cached value.
   * Checks memory first (fast), then localStorage (survives navigation).
   * Returns null on cache miss or expired entry.
   */
  get(key) {
    // 1. Memory
    const mem = memStore.get(key);
    if (mem) {
      if (Date.now() < mem.expiresAt) return mem.data;
      memStore.delete(key);
    }
    // 2. localStorage (warm memory back up)
    const ls = lsGet(key);
    if (ls !== null) {
      // Restore to memory with remaining TTL — use SHORT_TTL as safe default
      memStore.set(key, { data: ls, expiresAt: Date.now() + SHORT_TTL });
      return ls;
    }
    return null;
  },

  /**
   * Store a value.
   * @param {string}  key
   * @param {*}       data   — must be JSON-serialisable for localStorage persistence
   * @param {number}  ttl    — milliseconds (default 5 min)
   * @param {boolean} lsPersist — set false to skip localStorage (e.g. auth-sensitive data)
   */
  set(key, data, ttl = DEFAULT_TTL, lsPersist = true) {
    const expiresAt = Date.now() + ttl;
    memStore.set(key, { data, expiresAt });
    if (lsPersist) lsSet(key, data, ttl);
  },

  /** Remove a single cache entry */
  invalidate(key) {
    memStore.delete(key);
    lsDel(key);
  },

  /** Remove all entries whose key starts with prefix */
  invalidatePrefix(prefix) {
    [...memStore.keys()].forEach(k => { if (k.startsWith(prefix)) memStore.delete(k); });
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(LS_PREFIX + prefix))
        .forEach(k => localStorage.removeItem(k));
    } catch { }
  },

  /** Clear everything (useful on logout) */
  clear() {
    memStore.clear();
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(LS_PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch { }
  },

  // Expose TTL constants so callers can use them without magic numbers
  TTL: {
    SHORT:   SHORT_TTL,
    DEFAULT: DEFAULT_TTL,
    LONG:    LONG_TTL,
  }
};

// ── Auto-clear on logout (auth state change) ────────────────────────────────
// Clears only non-public data (user-specific entries) when user signs out.
// Keyed entries that are safe to cache across sessions (like all-users list)
// use the "public_" prefix and are NOT cleared here.
import { auth } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

let previousUid = null;
onAuthStateChanged(auth, user => {
  if (!user && previousUid) {
    // User logged out — clear private cache but keep public
    trioCache.invalidatePrefix('user_');
    trioCache.invalidatePrefix('profile_');
    trioCache.invalidatePrefix('connections_');
    trioCache.invalidatePrefix('posts_');
    trioCache.invalidatePrefix('connstate_');
    trioCache.invalidatePrefix('notif_');
  }
  previousUid = user?.uid ?? null;
});
