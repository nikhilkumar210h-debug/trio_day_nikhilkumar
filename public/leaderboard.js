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
import { collection, query, orderBy, limit, getDocs, onSnapshot, where } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { SoundManager } from './sound-manager.js';
import { escapeHtml as esc } from './utils.js';

let currentUser = null;
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

onAuthStateChanged(auth, user => {
  currentUser = user;
  loadLeaderboard();
});

// ─── LOAD LEADERBOARD ───────────────────────────────────────────────────────
async function loadLeaderboard() {
  // Clean up previous listener
  if (unsubscribe) unsubscribe();
  
  // Show loading
  rankingList.innerHTML = `
    <div class="nkm-skeleton-stack" style="width:100%;" aria-label="Loading rankings">
      ${Array(8).fill('<div class="nkm-skeleton-card" style="height:80px;"></div>').join('')}
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