// public/all-users.js — Discover: Trending Challenges + Categories + People Directory
// Real content replacing static promo page. All reads bounded & cached.
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  doc, getDoc, collection, query, orderBy, limit, getDocs, where
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { trioCache } from './trio-cache.js';
import { esc, cloudinaryAutoUrl } from './utils.js';

const DIR_KEY = 'trio_directory';
const TRENDING_KEY = 'trio_trending_challenges';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const $ = id => document.getElementById(id);

const CATEGORIES = [
  { key: 'Career', icon: '💼', color: '#8B5CF6', href: 'challenge.html?category=Career' },
  { key: 'Study', icon: '📚', color: '#6366F1', href: 'challenge.html?category=Study' },
  { key: 'College', icon: '🎓', color: '#06B6D4', href: 'challenge.html?category=College' },
  { key: 'Tech', icon: '💻', color: '#10B981', href: 'challenge.html?category=Tech' },
  { key: 'Life', icon: '🌱', color: '#F59E0B', href: 'challenge.html?category=Life' },
  { key: 'Fun', icon: '🎮', color: '#EC4899', href: 'challenge.html?category=Fun' },
];

async function fetchTrendingChallenges() {
  const cached = trioCache.get(TRENDING_KEY);
  if (cached) return cached;

  let entries = [];
  try {
    // Get active community challenges, ordered by creation (newest first)
    const snap = await getDocs(query(
      collection(db, 'communityTasks'),
      where('status', '==', 'active'),
      orderBy('createdAtMs', 'desc'),
      limit(10)
    ));
    entries = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || 'Untitled Challenge',
        description: data.description || '',
        q: data.interaction?.question || data.q || '',
        o: data.interaction?.options || data.o || [],
        category: data.category || 'Community',
        icon: data.icon || '✨',
        responses: data.completions || 0,
        xpReward: data.xpReward || 25,
        imageUrl: data.imageUrl || null,
        createdAtMs: data.createdAtMs || 0
      };
    });
  } catch (err) {
    console.warn('[Discover] Failed to fetch trending challenges:', err);
  }

  trioCache.set(TRENDING_KEY, entries, CACHE_TTL);
  return entries;
}

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

  trioCache.set(DIR_KEY, entries, CACHE_TTL);
  return entries;
}

function renderCategoryChips() {
  const container = $('categoryChips');
  if (!container) return;
  container.innerHTML = CATEGORIES.map(cat =>
    '<a href="' + cat.href + '" class="category-chip" style="--cat-color:' + cat.color + '">' +
      '<span class="category-icon">' + cat.icon + '</span>' +
      '<span class="category-label">' + cat.key + '</span>' +
    '</a>'
  ).join('');
}

function renderTrendingChallenges(challenges) {
  const container = $('trendingList');
  if (!container) return;

  if (!challenges.length) {
    container.innerHTML = '<div class="discover-empty">No trending challenges yet. Create one to get started!</div>';
    return;
  }

  container.innerHTML = challenges.map(c => {
    const img = c.imageUrl
      ? '<img src="' + cloudinaryAutoUrl(c.imageUrl) + '" alt="" class="trending-image" style="width:100%;height:140px;object-fit:cover;border-radius:12px 12px 0 0">'
      : '<div class="trending-placeholder" style="width:100%;height:140px;display:flex;align-items:center;justify-content:center;font-size:48px;background:var(--color-glass);border-radius:12px 12px 0 0">' + c.icon + '</div>';

    return '<a class="trending-card" href="challenge.html?challenge=' + encodeURIComponent(c.id) + '" aria-label="Open challenge: ' + esc(c.title) + '">' +
      img +
      '<div class="trending-content" style="padding:12px">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">' +
          '<span class="badge badge--neutral" style="font-size:9px;text-transform:uppercase">' + esc(c.category) + '</span>' +
          '<span style="font-size:9px;color:var(--color-ink-muted)">' + c.responses + ' responses</span>' +
        '</div>' +
        '<h3 class="trending-title" style="font-size:14px;font-weight:700;margin:4px 0;line-height:1.3">' + esc(c.title) + '</h3>' +
        '<p class="trending-desc" style="font-size:11px;color:var(--color-ink-muted);margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(c.q || c.description) + '</p>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">' +
          '<span style="font-size:10px;color:var(--color-primary-text);font-weight:700">+' + c.xpReward + ' XP</span>' +
          '<span style="font-size:9px;color:var(--color-ink-muted)">Tap to play</span>' +
        '</div>' +
      '</div>' +
    '</a>';
  }).join('');
}

async function renderDirectory() {
  const host = $('directoryList');
  if (!host) return;

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
      ? '<img src="' + cloudinaryAutoUrl(e.photoURL) + '" alt="" class="directory-avatar">'
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

// Search entry point handler
function setupSearchEntry() {
  const searchBtn = $('searchEntryBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      location.href = 'search.html';
    });
  }
}

async function init() {
  renderCategoryChips();
  setupSearchEntry();

  // Load trending challenges and directory in parallel
  const [trending, directory] = await Promise.allSettled([
    fetchTrendingChallenges(),
    fetchDirectory()
  ]);

  if (trending.status === 'fulfilled') {
    renderTrendingChallenges(trending.value);
  } else {
    $('trendingList').innerHTML = '<div class="discover-empty">Could not load trending challenges</div>';
  }

  if (directory.status === 'fulfilled') {
    renderDirectory();
  }
}

onAuthStateChanged(auth, () => {
  // Directory reads are allow-signedIn per firestore.rules; render regardless.
  init();
});