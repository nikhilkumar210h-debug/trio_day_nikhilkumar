import { auth, db } from './firebase-init.js';
import { notifyUser } from './services/notificationHelpers.js';
import { uploadProfileImage } from './image-upload.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { trioCache } from './trio-cache.js';
import { renderBadgesHtml } from './gamification/badges.js';
import { xpIntoLevel, XP_PER_LEVEL, levelFromXp } from './gamification/constants.js';
import { SoundManager } from './sound-manager.js';
import { createSheet } from './ui/sheet.js';
import { getCachedUser } from './services/userCache.js';
import { getMyGlobalRank } from './gamification/leaderboards.js';
import { getCommunityTask } from './gamification/community-tasks.js';
import { normalizeActivityType, activityTypeInfo } from './activity-ui.js';
import { activeCatalogActivities } from './activity-catalog.js?v=20260920-audit2';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  doc, getDoc, collection, collectionGroup, getDocs, query, where, orderBy,
  setDoc, deleteDoc, serverTimestamp, updateDoc, limit
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { makeUserId, escapeHtml as esc } from './utils.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let me = null, current = null;
function avatar(el, u) {
  el.innerHTML = '';
  if (u?.photoURL) { const i = document.createElement('img'); i.src = u.photoURL; i.alt = 'Profile photo'; i.width = 96; i.height = 96; i.decoding = 'async'; i.loading = 'lazy'; i.style.aspectRatio = '1 / 1'; el.appendChild(i); }
  else el.textContent = (u?.name || 'U').charAt(0).toUpperCase();
}

// ── Cached connections list ─────────────────────────────────────────────────
// followers/following counts don't change often — cache 2 min
async function getCachedFollowers(uid) {
  const key = `followers_${uid}`;
  const cached = trioCache.get(key);
  if (cached !== null) return cached;
  // Bound to 500 max (counts don't need exact beyond that for UI)
  const snap = await getDocs(query(collection(db, 'users', uid, 'followers'), limit(501))).catch(() => ({ size: 0, docs: [] }));
  const value = snap.size > 500 ? '500+' : snap.size;
  // Keep follower IDs cached as well; the Chat inbox reuses this cache.
  trioCache.set(key, value, trioCache.TTL.SHORT);
  trioCache.set(`followers_ids_${uid}`, snap.docs.map(d => d.id), trioCache.TTL.SHORT);
  return value;
}

async function getCachedFollowing(uid) {
  const key = `following_${uid}`;
  const cached = trioCache.get(key);
  if (cached !== null) return cached;
  // Bound to 500 max
  const snap = await getDocs(query(collection(db, 'users', uid, 'following'), limit(501))).catch(() => ({ size: 0, docs: [] }));
  const value = snap.size > 500 ? '500+' : snap.size;
  // Also cache the list of IDs (used by connections panel)
  trioCache.set(key, value, trioCache.TTL.SHORT);
  trioCache.set(`following_ids_${uid}`, snap.docs.map(d => d.id), trioCache.TTL.SHORT);
  return value;
}

async function getCachedFollowingIds(uid) {
  const key = `following_ids_${uid}`;
  const cached = trioCache.get(key);
  if (cached) return cached;
  // Bound to 500 max
  const snap = await getDocs(query(collection(db, 'users', uid, 'following'), limit(500))).catch(() => ({ docs: [] }));
  const ids = snap.docs.map(d => d.id);
  trioCache.set(key, ids, trioCache.TTL.SHORT);
  trioCache.set(`following_${uid}`, ids.length, trioCache.TTL.SHORT);
  return ids;
}

// ── Cached connection state check ───────────────────────────────────────────
async function isConnected(myUid, theirUid) {
  const key = `connstate_${myUid}_${theirUid}`;
  const cached = trioCache.get(key);
  if (cached !== null) return cached;
  const snap = await getDoc(doc(db, 'users', myUid, 'following', theirUid)).catch(() => null);
  const result = snap?.exists() ?? false;
  trioCache.set(key, result, trioCache.TTL.SHORT);
  return result;
}

// ── Cached posts list ────────────────────────────────────────────────────────
// Profile posts don't change that often — 2 min TTL
async function getCachedUserPosts(uid) {
  // Posts are intentionally not rendered on profiles; Trio Day profiles focus on identity,
  // progress, activities and connections. Keep this stub for compatibility with older callers.
  return [];
}

// ── Load connections panel ───────────────────────────────────────────────────
async function loadConnections(uid) {
  const box = $('connectionsList'); if (!box) return;
  box.innerHTML = '<div class="td-skeleton td-skeleton--card"></div><div class="td-skeleton td-skeleton--card"></div>';
  const ids = await getCachedFollowingIds(uid);
  const filtered = ids.filter(id => id !== uid);
  if (!filtered.length) { box.innerHTML = '<div class="connections-empty">No connections yet.</div>'; return; }
  // Use cached profile for each connection — no waterfall of getDoc calls
  const profiles = await Promise.all(filtered.map(id => getCachedUser(id)));
  profiles.filter(Boolean).forEach(u => {
    const a = document.createElement('a'); a.className = 'connection-row'; a.href = `profile.html?uid=${encodeURIComponent(u.uid)}`;
    const av = u.photoURL ? `<img src="${esc(u.photoURL)}" alt="">` : (u.name || 'U').charAt(0).toUpperCase();
    const publicUid = u.userId || makeUserId(u.uid || id);
    a.innerHTML = `<span class="user-avatar">${av}</span><span class="meta"><strong>${esc(u.name || 'User')}</strong><small class="muted">TRIO UID · ${esc(publicUid)}</small></span><span class="connection-arrow">›</span>`;
    box.appendChild(a);
  });
}

// ── Edit profile modal ───────────────────────────────────────────────────────
async function openEdit(u) {
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal edit-dialog">
    <div class="modal-head"><div><span class="eyebrow">Your profile</span><h2>Edit profile</h2></div><button class="icon-btn close-edit" type="button">×</button></div>
    <label class="field"><span class="label-text">Name</span><input id="editName" type="text" maxlength="50" value="${esc(u.name || '')}"></label>
    <div class="field"><span class="label-text">Trio UID</span><div class="field-readonly">${esc(u.userId || makeUserId(me.uid))}</div><small class="field-help">Permanent account ID used to sign in and connect with friends. It cannot be changed.</small></div>
    <label class="field"><span class="label-text">Bio</span><textarea id="editBio" maxlength="180" rows="4" placeholder="Tell people a little about you…">${esc(u.bio || '')}</textarea></label>
    <label class="field"><span class="label-text">Profile photo</span><input id="editPhoto" type="file" accept="image/*"></label>
    <p class="status" id="editStatus"></p>
    <div class="modal-actions"><button class="btn secondary cancel-edit" type="button">Cancel</button><button class="btn primary save-edit" type="button">Save profile</button></div>
  </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.close-edit').onclick = close;
  overlay.querySelector('.cancel-edit').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('.save-edit').onclick = async () => {
    const st = overlay.querySelector('#editStatus'), btn = overlay.querySelector('.save-edit'); btn.disabled = true;
    try {
      const name = overlay.querySelector('#editName').value.trim() || 'User';
      let photoURL = u.photoURL || null; const f = overlay.querySelector('#editPhoto').files?.[0];
      if (f) {
        if (!f.type.startsWith('image/')) throw Error('Only image files allowed.');
        if (f.size > 8 * 1024 * 1024) throw Error('Profile photo must be under 8MB.');
        st.textContent = 'Compressing & uploading photo…';
        const token = await me.getIdToken();
        photoURL = await uploadProfileImage(me.uid, f, token);
      }
      const bio = overlay.querySelector('#editBio').value.trim();
      await updateDoc(doc(db, 'users', me.uid), { name, bio, photoURL, updatedAt: serverTimestamp() });
      // Invalidate cached profile so the page re-fetches fresh data
      trioCache.invalidate(`user_${me.uid}`);
      await me.reload(); close(); await loadProfile(me.uid);
    } catch (err) { console.error(err); st.textContent = err.message || 'Save failed.'; }
    finally { btn.disabled = false; }
  };
}

// ── Connect / disconnect ─────────────────────────────────────────────────────
async function connect(uid) {
  if (!me || uid === me.uid) { alert('You cannot connect with yourself.'); return; }
  try {
    const a = doc(db, 'users', me.uid, 'following', uid);
    const b = doc(db, 'users', uid, 'followers', me.uid);
    const s = await getDoc(a);
    if (s.exists()) {
      await deleteDoc(a); await deleteDoc(b).catch(() => { });
    } else {
      const mine = await getCachedUser(me.uid);
      const myName = mine?.name || me.displayName || 'Someone';
      await setDoc(a, { uid, userId: current?.userId || makeUserId(uid), name: current?.name || 'User', createdAt: serverTimestamp() });
      await setDoc(b, { uid: me.uid, createdAt: serverTimestamp() });
      await notifyUser(uid, { type: 'connect', actorUid: me.uid, actorName: myName });
    }
    // Invalidate connection-related caches so counts + state refresh
    trioCache.invalidate(`connstate_${me.uid}_${uid}`);
    trioCache.invalidate(`following_${me.uid}`);
    trioCache.invalidate(`following_ids_${me.uid}`);
    trioCache.invalidate(`followers_${uid}`);
    await loadProfile(uid);
  } catch (err) { console.error(err); alert(err.message || 'Connection update failed.'); }
}

// ── Profile menu (three-dot) ───────────────────────────────────────────────────
async function openProfileMenu(userData) {
  const { sheet, open, close } = createSheet({
    title: 'Account',
    content: `
      <div class="profile-menu-list">
        <button type="button" class="profile-menu-item" data-action="edit">
          <span>✏️</span> Edit Profile
        </button>
        <button type="button" class="profile-menu-item" data-action="password">
          <span>🔐</span> Account Security
        </button>
        <button type="button" class="profile-menu-item" data-action="theme">
          <span>🎨</span> Theme
        </button>
        <a class="profile-menu-item" href="privacy.html">
          <span>🔒</span> Privacy Policy
        </a>
        <label class="profile-menu-item profile-menu-toggle" style="cursor:pointer">
          <span>🔊</span> Sound Effects
          <input type="checkbox" id="sheetSoundToggle" ${SoundManager.isEnabled() ? 'checked' : ''} style="margin-left:auto">
        </label>
        <button type="button" class="profile-menu-item" data-action="install">
          <span>📲</span> Install App
        </button>
        <button type="button" class="profile-menu-item profile-menu-danger" data-action="logout">
          <span>🚪</span> Logout
        </button>
      </div>
    `,
    actions: ''
  });

  const body = sheet.querySelector('.nkm-sheet-body');
  
  // Sound toggle handler
  const soundToggle = body.querySelector('#sheetSoundToggle');
  if (soundToggle) {
    soundToggle.addEventListener('change', e => {
      SoundManager.toggle(e.target.checked);
      if (e.target.checked) SoundManager.click();
    });
  }

  // Menu item handlers
  body.querySelectorAll('.profile-menu-item[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      close();
      
      if (action === 'edit') {
        await openEdit(userData);
      } else if (action === 'password') {
        // Inline forgot password flow
        try {
          const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
          const userEmail = me?.email || userData.email;
          if (!userEmail) {
            const { showToast } = await import('./ui/toast.js');
            showToast('Google account me password change Google se karo', 'error');
            return;
          }
          await sendPasswordResetEmail(auth, userEmail);
          const { showToast } = await import('./ui/toast.js');
          showToast('Reset link bhej diya! Email check karo ✉️');
        } catch (err) {
          console.error(err);
          const { showToast } = await import('./ui/toast.js');
          showToast(err.message, 'error');
        }
      } else if (action === 'theme') {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const { sheet: themeSheet, open: openTheme, close: closeTheme } = createSheet({
          title: 'Theme',
          content: `
            <div class="theme-choice-list">
              <button type="button" class="profile-menu-item theme-choice ${currentTheme === 'dark' ? 'is-selected' : ''}" data-theme-choice="dark"><span>🌙</span><span>Dark</span><small>Deep, focused UI</small></button>
              <button type="button" class="profile-menu-item theme-choice ${currentTheme === 'light' ? 'is-selected' : ''}" data-theme-choice="light"><span>☀️</span><span>Light</span><small>Bright, clean UI</small></button>
              <button type="button" class="profile-menu-item theme-choice ${!window.localStorage.getItem('trio-theme') ? 'is-selected' : ''}" data-theme-choice="system"><span>◐</span><span>System</span><small>Follow device setting</small></button>
            </div>`
        });
        openTheme();
        themeSheet.querySelectorAll('[data-theme-choice]').forEach(choice => {
          choice.addEventListener('click', () => {
            const value = choice.dataset.themeChoice;
            try {
              if (value === 'system') localStorage.removeItem('trio-theme');
              else window.TrioTheme?.applyTheme(value);
              if (value === 'system') window.TrioTheme?.initTheme();
            } catch {}
            closeTheme();
          });
        });
      } else if (action === 'install') {
        // Trigger install prompt
        const event = new CustomEvent('app-install-prompt');
        window.dispatchEvent(event);
      } else if (action === 'logout') {
        try {
          await signOut(auth);
          location.href = 'login.html';
        } catch (err) {
          console.error(err);
          alert('Logout failed');
        }
      }
    });
  });

  open();
}

async function copyPublicUid(value, button) {
  const uid = String(value || '').trim();
  if (!uid) return;
  try {
    await navigator.clipboard.writeText(uid);
  } catch {
    const area = document.createElement('textarea');
    area.value = uid;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); } finally { area.remove(); }
  }
  if (button) {
    const old = button.textContent;
    button.textContent = 'Copied';
    button.classList.add('copied');
    setTimeout(() => { button.textContent = old || 'Copy'; button.classList.remove('copied'); }, 1400);
  }
}

// ── Main profile loader ──────────────────────────────────────────────────────
async function loadProfile(uid) {
  // 1. User document — cache first
  const userData = await getCachedUser(uid);
  if (!userData) { if ($('profileName')) $('profileName').textContent = 'User not found'; return; }
  current = { ...userData, uid: userData.uid || uid };

  const isOwnProfile = me && me.uid === uid;
  // Older accounts may not have the public Trio UID yet. Generate it once,
  // then persist that exact value; later logins always reuse the stored value.
  let publicUid = current.userId || makeUserId(current.uid);
  if (!/^TRIO-[A-Z0-9]{8}$/.test(publicUid)) publicUid = makeUserId(current.uid);
  if (isOwnProfile && !current.userId) {
    try {
      const clash = await getDocs(query(
        collection(db, 'users'),
        where('userId', '==', publicUid),
        limit(1)
      ));
      if (clash.docs.some(d => d.id !== uid)) publicUid = makeUserId(uid, 1);
      await setDoc(doc(db, 'users', uid), { uid, userId: publicUid, updatedAt: serverTimestamp() }, { merge: true });
      current.userId = publicUid;
      trioCache.invalidate(`user_${uid}`);
    } catch (err) {
      console.warn('[Profile] Could not persist permanent Trio UID:', err);
    }
  }

  // Render header
  avatar($('profileAvatar'), current);
  $('profileName').textContent = current.name || 'User';
  const uidBtn = $('profileUserId');
  const copyUidBtn = $('copyUidBtn');
  if (uidBtn) {
    uidBtn.textContent = current.userId || publicUid;
    uidBtn.onclick = () => copyPublicUid(current.userId || publicUid, copyUidBtn);
  }
  if (copyUidBtn) {
    copyUidBtn.onclick = () => copyPublicUid(current.userId || publicUid, copyUidBtn);
  }
  const ownEmail = isOwnProfile ? (me?.email || current.email || '') : '';
  $('profileEmail').textContent = isOwnProfile
    ? (ownEmail ? 'Email connected' : 'Email hidden')
    : '';
  $('profileBio').textContent = current.bio || 'No bio yet.';

  // 2. Follower / following counts — cached
  const [follCount, followingCount] = await Promise.all([
    getCachedFollowers(uid),
    getCachedFollowing(uid)
  ]);
  $('followersCount').textContent = `${follCount} Followers`;
  $('followingCount').textContent = `${followingCount} Following`;
  // Direct redirect on click — scroll to Connections
  ['followersCount','followingCount'].forEach(id=>{
    const e=$(id); if(e){ e.style.cursor='pointer'; e.title='View connections'; e.onclick=()=>document.getElementById('connectionsList')?.scrollIntoView({behavior:'smooth', block:'center'}); }
  });

  // Profile menu button — show only on own profile
  const menuBtn = $('profileMenuBtn');
  if (menuBtn) menuBtn.hidden = !isOwnProfile;
  if (menuBtn && isOwnProfile) {
    menuBtn.onclick = () => openProfileMenu(current);
  }

  // Gamification + activity journey — own profile only
  const game = $('profileGame');
  const activityPanel = $('profileActivityPanel');
  if (game) game.hidden = !isOwnProfile;
  if (activityPanel) activityPanel.hidden = !isOwnProfile;
  if (isOwnProfile) {
    const xp = Number(current.xp) || 0;
    const level = current.level || levelFromXp(xp);
    const into = xpIntoLevel(xp);
    if ($('pgLevel')) $('pgLevel').textContent = level;
    if ($('pgXp')) $('pgXp').textContent = xp;
    if ($('pgStreak')) $('pgStreak').textContent = Number(current.streakCurrent) || 0;
    if ($('pgBest')) $('pgBest').textContent = Number(current.streakBest) || 0;
    if ($('pgWeekly')) $('pgWeekly').textContent = Number(current.weeklyXp) || 0;
    if ($('pgMonthly')) $('pgMonthly').textContent = Number(current.monthlyXp) || 0;
    if ($('pgXpFill')) $('pgXpFill').style.width = ((into / XP_PER_LEVEL) * 100) + '%';
    if ($('pgXpInto')) $('pgXpInto').textContent = into + ' / ' + XP_PER_LEVEL + ' XP';
    if ($('pgNextLevel')) $('pgNextLevel').textContent = 'Next: Level ' + (level + 1);
    if ($('pgBadges')) $('pgBadges').innerHTML = renderBadgesHtml(current.badges || []);
    const rank = await getMyGlobalRank(me.uid);
    if ($('pgRank')) $('pgRank').textContent = rank ? ('#' + rank) : '—';
    await loadRecentActivities(uid);
  }

  async function loadRecentActivities(uid) {
  const list = $('recentActivities');
  const summary = $('profileActivitySummary');
  if (!list) return;
  list.innerHTML = '<div class="td-skeleton td-skeleton--card"></div><div class="td-skeleton td-skeleton--card"></div>';

  const rows = [];
  const seen = new Set();
  const catalogMap = new Map(activeCatalogActivities().map(a => [a.id, a]));

  try {
    const [catalogSnap, communitySnap] = await Promise.all([
      getDocs(query(collection(db, 'users', uid, 'activityCompletions'), orderBy('completedAtMs', 'desc'), limit(24))).catch(() => null),
      getDocs(query(collectionGroup(db, 'completions'), where('uid', '==', uid), limit(24))).catch(() => null)
    ]);

    if (catalogSnap) {
      catalogSnap.docs.forEach(d => {
        const v = d.data() || {};
        const activity = catalogMap.get(v.activityId);
        const key = 'catalog:' + (v.cycleKey || v.activityId || d.id);
        if (seen.has(key)) return;
        seen.add(key);
        const difficulty = String(activity?.difficulty || 'Medium');
        const xp = Number(activity?.xpReward) || (difficulty === 'Hard' ? 60 : difficulty === 'Medium' ? 40 : 25);
        rows.push({
          key, activityId: v.activityId || activity?.id || '', title: v.title || activity?.title || 'Activity',
          type: normalizeActivityType(activity || v),
          icon: v.icon || activity?.icon || '🎯', category: v.category || activity?.category || 'Trio Day',
          xp, atMs: Number(v.completedAtMs) || 0, source: 'catalog'
        });
      });
    }

    if (communitySnap) {
      const docs = communitySnap.docs.slice(0, 24);
      const tasks = await Promise.all(docs.map(async d => {
        const taskId = d.ref.parent?.parent?.id;
        if (!taskId) return null;
        const task = await getCommunityTask(taskId).catch(() => null);
        if (!task) return null;
        const key = 'community:' + taskId;
        return {
          key, title: task.title || 'Community activity',
          type: normalizeActivityType(task), icon: task.icon || activityTypeInfo(task).icon,
          category: task.category || 'Community', xp: Number(task.xpReward) || 0,
          atMs: Number(d.data()?.atMs) || 0, source: 'community'
        };
      }));
      tasks.filter(Boolean).forEach(v => {
        if (!seen.has(v.key)) { seen.add(v.key); rows.push(v); }
      });
    }
  } catch (e) {
    console.warn('[Profile] Recent activity history unavailable:', e);
  }

  rows.sort((a, b) => b.atMs - a.atMs);
  const items = rows.slice(0, 10);
  if (summary) summary.textContent = items.length ? (items.length + ' recent') : 'No completions';
  if (!items.length) {
    list.innerHTML = '<div class="profile-activity-empty"><span>✦</span><strong>Your activity history starts here.</strong><p>Complete a puzzle, build, lesson, challenge or game to see it here.</p><a href="all-users.html" class="nkm-btn nkm-btn--primary nkm-btn--sm">Explore activities</a></div>';
    return;
  }

  list.innerHTML = items.map(item => {
    const type = activityTypeInfo(item);
    const when = item.atMs ? new Date(item.atMs).toLocaleDateString(undefined, { day:'numeric', month:'short' }) : 'Recently';
    return '<a class="profile-activity-item" href="' +
      (item.source === 'community' ? 'task-detail.html?id=' : 'activity.html?id=') + encodeURIComponent(item.source === 'community' ? item.key.replace('community:','') : (item.activityId || item.key.replace('catalog:','').split('_')[0])) +
      '" aria-label="' + esc(item.title) + '">' +
      '<span class="profile-activity-icon">' + (item.icon || type.icon) + '</span>' +
      '<span class="profile-achievement-badge">✓</span>' +
      '<span class="profile-activity-copy"><strong>' + esc(item.title) + '</strong><small>' + esc(type.label) + ' · ' + esc(when) + '</small></span>' +
      '<span class="profile-activity-xp">+' + item.xp + '</span>' +
      '</a>';
  }).join('');
}

// 3. Action buttons (only for other profiles)
  const actions = $('profileActions'); actions.innerHTML = '';
  if (!isOwnProfile) {
    const connected = await isConnected(me.uid, uid);
    const b = document.createElement('button'); b.className = 'btn primary'; b.type = 'button'; b.textContent = connected ? 'Connected' : 'Connect';
    b.onclick = () => connect(uid);
    const chat = document.createElement('a'); chat.className = 'btn secondary'; chat.href = `private-chat.html?uid=${encodeURIComponent(uid)}`; chat.textContent = 'Message';
    actions.append(b, chat);
  }

  // 4. Connections panel — cached
  await loadConnections(uid);


}

// ── Auth ─────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async u => {
  if (!u) { location.href = 'login.html?redirect=profile.html'; return; }
  SoundManager.init();
  const soundToggle = $('soundToggle');
  if (soundToggle) {
    soundToggle.checked = SoundManager.isEnabled();
    soundToggle.addEventListener('change', e => {
      SoundManager.toggle(e.target.checked);
      if (e.target.checked) SoundManager.click();
    });
  }
  me = u;
  const uid = params.get('uid') || u.uid;
  await loadProfile(uid);
});
