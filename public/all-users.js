// public/all-users.js — Live Trio Directory & Top Streak Leaderboard (Phase 3)
// Replaced static promo cards with real directory: users + leaderboards,
// cached via trio-cache.js (10 min) to minimize Firestore reads.
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  doc, getDoc, collection, query, orderBy, limit, getDocs
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { trioCache } from './trio-cache.js';
import { esc } from './utils.js';

const DIR_KEY = 'trio_directory';
const DIR_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchDirectory() {
  const cached = trioCache.get(DIR_KEY);
  if (cached) return cached;

  let entries = [];
  try {
    // Read leaderboard doc (read-only, client-safe per firestore.rules:404-410)
    const lbSnap = await getDoc(doc(db, 'leaderboards', 'global'));
    if (lbSnap.exists()) {
      entries = (lbSnap.data().entries || []).slice(0, 20).map(e => ({
        uid: e.uid, name: e.name || 'User', photoURL: e.photoURL || null, xp: Number(e.value || e.xp || 0)
      }));
    }
  } catch { /* leaderboard may not exist yet */ }

  // Fall back to a bounded users read if no leaderboard yet
  if (!entries.length) {
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(20)));
      entries = usersSnap.docs.map(d => {
        const data = d.data();
        return { uid: d.id, name: data.name || 'User', photoURL: data.photoURL || null, xp: Number(data.xp || 0) };
      }).sort((a, b) => b.xp - a.xp).slice(0, 20);
    } catch { entries = []; }
  }

  trioCache.set(DIR_KEY, entries, DIR_TTL);
  return entries;
}

async function renderDirectory() {
  const host = $('directoryList'); if (!host) return;
  let entries = [];
  try {
    entries = await fetchDirectory();
  } catch { entries = []; }

  if (!entries.length) {
    host.innerHTML = '<div class="discover-empty">No directory data yet. Complete a Challenge to appear on the leaderboard.</div>';
    return;
  }

  host.innerHTML = entries.map((e, i) => {
    const av = e.photoURL
      ? '<img src="' + esc(e.photoURL) + '" alt="" class="directory-avatar">'
      : '<span class="directory-avatar">' + esc((e.name || 'U').charAt(0).toUpperCase()) + '</span>';
    return '<a class="directory-row" href="profile.html?uid=' + encodeURIComponent(e.uid) + '" aria-label="Open profile of ' + esc(e.name || 'User') + '">' +
      '<span class="directory-rank">' + (i + 1) + '</span>' +
      av +
      '<div class="directory-copy">' +
      '<span class="directory-name">' + esc(e.name || 'User') + '</span>' +
      '<span class="directory-meta">' + (e.xp > 0 ? e.xp + ' XP' : 'New member') + ' · <a href="challenge.html" style="color:var(--color-primary-text)">Challenge them →</a></span>' +
      '</div>' +
      '</a>';
  }).join('');
}

function $(id) { return document.getElementById(id); }

onAuthStateChanged(auth, () => {
  // Directory reads are allow-signedIn per firestore.rules; render regardless.
  renderDirectory();
});
