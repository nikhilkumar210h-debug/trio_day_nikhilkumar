/**
 * leaderboard.js — Trio Day Weekly XP Leaderboard
 * 
 * Features:
 * - Top 3 Podium (Gold/Silver/Bronze floating cards)
 * - Full ranking list with user highlight
 * - Weekly XP from Firebase (users/{uid}.weeklyXp)
 * - Real-time listener for live updates
 */

import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, query, orderBy, limit, getDocs, onSnapshot, where, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { SoundManager } from './sound-manager.js';
import { escapeHtml as esc } from './utils.js';
import { setAdminFlag } from './ui/nav.js';

const ADMIN_EMAILS = ['nikhilkumar210h@gmail.com', 'nikhilkumar45374@gmail.com'];

let currentUser = null;
let userProfile = null;
let isAdmin = false;
let unsubscribe = null;

// ─── DOM ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const podium = $('podium');
const rankingList = $('rankingList');
const emptyState = $('emptyState');

// Podium elements
const p1Name = $('p1Name'), p1Category = $('p1Category'), p1Xp = $('p1Xp');
const p2Name = $('p2Name'), p2Category = $('p2Category'), p2Xp = $('p2Xp');
const p3Name = $('p3Name'), p3Category = $('p3Category'), p3Xp = $('p3Xp');

// ─── INIT ───────────────────────────────────────────────────────────────────
SoundManager.init();

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      userProfile = userDoc.exists() ? userDoc.data() : null;
      isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase());
      setAdminFlag(isAdmin);
    } catch (err) {
      console.error('[Leaderboard] Auth error:', err);
    }
  } else {
    isAdmin = false;
    setAdminFlag(false);
    userProfile = null;
  }
  renderAuthStatus();
  loadLeaderboard();
});

// ─── AUTH STATUS ────────────────────────────────────────────────────────────
function renderAuthStatus() {
  const authStatus = $('authStatus');
  if (!authStatus) return;
  
  if (currentUser) {
    const name = userProfile?.displayName || userProfile?.name || currentUser.displayName || 'You';
    const initial = name.trim().charAt(0).toUpperCase();
    const photo = userProfile?.photoURL || currentUser.photoURL;
    
    authStatus.innerHTML = `
      <span class="streak-badge">🔥 ${userProfile?.streakCurrent || 0}d Streak</span>
      <a href="leaderboard.html" class="status-badge active" style="pointer-events:none">🏆 Leaderboard</a>
      <span class="xp-badge-nav">⚡ ${userProfile?.weeklyXp || 0} XP</span>
      <button id="langToggleBtn" class="lang-toggle" aria-label="Language">${localStorage.getItem('trio_language') || 'EN'}</button>
      <div style="position:relative">
        <button id="profileAvatarBtn" class="profile-pic-btn" aria-label="Profile" style="background:none;border:none;padding:0;cursor:pointer">
          ${photo ? `<img src="${esc(photo)}" alt="" style="width:42px;height:42px;border-radius:50%;border:2px solid #00FFCC;object-fit:cover">` : `<div class="profile-pic-placeholder" style="width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#8B5CF6,#00FFCC);color:#05070B;font-weight:900;font-size:16px;border:2px solid #00FFCC">${esc(initial)}</div>`}
        </button>
      </div>
    `;
    
    const avatarBtn = $('profileAvatarBtn');
    if (avatarBtn) avatarBtn.onclick = () => location.href = 'profile.html';
    
  } else {
    authStatus.innerHTML = `
      <span class="streak-badge">🔥 0d Streak</span>
      <a href="leaderboard.html" class="status-badge active" style="pointer-events:none">🏆 Leaderboard</a>
      <span class="xp-badge-nav">⚡ 0 XP</span>
      <button id="langToggleBtn" class="lang-toggle" aria-label="Language">${localStorage.getItem('trio_language') || 'EN'}</button>
      <a href="login.html" class="status-badge">🔑 Login</a>
      <a href="login.html"><img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80" alt="Profile" class="profile-pic" style="width:42px;height:42px;border-radius:50%;border:2px solid #00FFCC;object-fit:cover"></a>
    `;
  }
  
  const langBtn = $('langToggleBtn');
  if (langBtn) langBtn.onclick = () => {
    const lang = localStorage.getItem('trio_language') === 'EN' ? 'HI' : 'EN';
    localStorage.setItem('trio_language', lang);
    // Smooth language change - just update the button text and re-render if needed
    langBtn.textContent = lang;
    // Could add toast notification here if needed
  };
}

// ─── LOAD LEADERBOARD ───────────────────────────────────────────────────────
async function loadLeaderboard() {
  // Clean up previous listener
  if (unsubscribe) unsubscribe();
  
  // Show loading
  rankingList.innerHTML = `
    <div class="skeleton-stack" style="width:100%;">
      ${Array(8).fill('<div class="skeleton-card" style="height:80px; aspect-ratio:auto; border-radius:12px; margin-bottom:12px; background:linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 100%); background-size:200% 100%; animation:shimmer 1.5s infinite linear;"></div>').join('')}
    </div>
  `;
  
  try {
    // Fetch top 50 by weeklyXp
    const q = query(
      collection(db, 'users'),
      where('weeklyXp', '>', 0),
      orderBy('weeklyXp', 'desc'),
      limit(50)
    );
    
    // Real-time listener
    unsubscribe = onSnapshot(q, (snapshot) => {
      const users = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        users.push({
          uid: doc.id,
          name: data.displayName || data.name || 'Anonymous',
          weeklyXp: data.weeklyXp || 0,
          category: data.selectedCategory || 'Starter',
          photoURL: data.photoURL || null,
          level: data.level || 1
        });
      });
      
      renderLeaderboard(users);
    }, (err) => {
      console.error('[Leaderboard] Listener error:', err);
      // Fallback to one-time fetch
      getDocs(q).then(snap => {
        const users = [];
        snap.forEach(doc => {
          const data = doc.data();
          users.push({
            uid: doc.id,
            name: data.displayName || data.name || 'Anonymous',
            weeklyXp: data.weeklyXp || 0,
            category: data.selectedCategory || 'Starter',
            photoURL: data.photoURL || null,
            level: data.level || 1
          });
        });
        renderLeaderboard(users);
      });
    });
    
  } catch (err) {
    console.error('[Leaderboard] Load error:', err);
    rankingList.innerHTML = `
      <div class="task-box" style="text-align:center">
        <p style="color:var(--color-danger)">Failed to load leaderboard</p>
        <button class="btn secondary" onclick="loadLeaderboard()">Retry</button>
      </div>
    `;
  }
}

// ─── RENDER LEADERBOARD ─────────────────────────────────────────────────────
function renderLeaderboard(users) {
  if (!users.length) {
    podium.hidden = true;
    rankingList.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  
  emptyState.hidden = true;
  podium.hidden = false;
  
  // Sort by weeklyXp descending
  users.sort((a, b) => b.weeklyXp - a.weeklyXp);
  
  // Render Podium (Top 3)
  if (users.length >= 1) renderPodiumCard(1, users[0], p1Name, p1Category, p1Xp, true);
  if (users.length >= 2) renderPodiumCard(2, users[1], p2Name, p2Category, p2Xp);
  if (users.length >= 3) renderPodiumCard(3, users[2], p3Name, p3Category, p3Xp);
  
  // Render Full Ranking
  rankingList.innerHTML = users.map((user, index) => renderRankRow(user, index + 1)).join('');
  
  // Scroll to current user if in list
  if (currentUser) {
    const myRank = users.findIndex(u => u.uid === currentUser.uid);
    if (myRank >= 0) {
      const myRow = rankingList.querySelector(`[data-uid="${currentUser.uid}"]`);
      if (myRow) {
        myRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
}

function renderPodiumCard(rank, user, nameEl, catEl, xpEl, isFirst = false) {
  const avatar = user.photoURL 
    ? `<img src="${esc(user.photoURL)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover">`
    : user.name.charAt(0).toUpperCase();
  
  nameEl.textContent = user.name;
  catEl.textContent = user.category;
  xpEl.textContent = `⚡ ${user.weeklyXp} XP`;
  
  // Add pulse animation to 1st place
  if (isFirst) {
    nameEl.parentElement.style.animation = 'floatCard 3s ease-in-out infinite';
  }
}

function renderRankRow(user, rank) {
  const isMe = currentUser && user.uid === currentUser.uid;
  const highlight = isMe ? 'border: 1.5px solid #00FFCC; background: rgba(0, 255, 204, 0.1);' : '';
  const rankIcon = rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
  const rankColor = rank === 1 ? '#FBBF24' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#94A3B8';
  
  return `
    <div class="rank-row" style="${highlight}" data-uid="${esc(user.uid)}">
      <div style="display:flex; align-items:center; gap:18px;">
        <span style="font-size: 20px; font-weight: 900; color: ${rankColor}; width: 40px; text-align:center;">${rankIcon}</span>
        <div>
          <div style="font-size: 18px; font-weight: 800; color: #fff;">${esc(user.name)}${isMe ? ' <span style="font-size:12px; color:#00FFCC; font-weight:700;">(You)</span>' : ''}</div>
          <div style="font-size: 12px; color: #94A3B8;">Goal: ${esc(user.category)} · Level ${user.level}</div>
        </div>
      </div>
      <div class="xp-badge">⚡ ${user.weeklyXp} XP</div>
    </div>
  `;
}

// ─── CLEANUP ────────────────────────────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  if (unsubscribe) unsubscribe();
});