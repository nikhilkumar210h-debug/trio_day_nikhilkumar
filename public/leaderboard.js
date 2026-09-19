import { auth, db } from './firebase-init.js';
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getLeaderboard, currentBoardIds, friendsLeaderboard } from './gamification/leaderboards.js';
import { escapeHtml as esc } from './utils.js';

const $ = id => document.getElementById(id);
let me = null;
let board = 'global';

function renderRows(entries, unit = 'XP') {
  const list = $('lbList');
  if (!entries?.length) {
    list.innerHTML = '<div class="empty-state"><h3>No ranks yet</h3><p>Complete tasks to appear here.</p></div>';
    return;
  }
  list.innerHTML = entries.map((e, i) => {
    const av = e.photoURL
      ? `<img src="${esc(e.photoURL)}" alt="">`
      : esc((e.name || 'U').charAt(0).toUpperCase());
    return `<a class="lb-row" href="profile.html?uid=${encodeURIComponent(e.uid)}">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-avatar">${av}</span>
      <span><strong>${esc(e.name || 'User')}</strong><br><small>Lv ${esc(e.level || 1)}</small></span>
      <strong>${esc(e.value)} ${unit}</strong>
    </a>`;
  }).join('');
}

async function load() {
  $('lbStatus').textContent = 'Loading…';
  try {
    const ids = currentBoardIds();
    if (board === 'friends') {
      if (!me) { renderRows([]); return; }
      const snap = await getDocs(collection(db, 'users', me.uid, 'following'));
      const idsFollow = snap.docs.map(d => d.id);
      const valueKey = 'xp';
      const entries = await friendsLeaderboard(me.uid, idsFollow, valueKey);
      renderRows(entries, 'XP');
    } else {
      const map = {
        global: ids.global,
        weekly: ids.weekly,
        monthly: ids.monthly,
        streak: ids.streak
      };
      const data = await getLeaderboard(map[board]);
      const unit = board === 'streak' ? 'days' : 'XP';
      renderRows(data.entries || [], unit);
    }
    $('lbStatus').textContent = '';
  } catch (err) {
    console.error(err);
    $('lbStatus').textContent = err.message || 'Failed';
  }
}

document.querySelectorAll('[data-board]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-board]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    board = btn.dataset.board;
    load();
  });
});

onAuthStateChanged(auth, user => {
  me = user;
  load();
});
