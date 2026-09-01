import { auth, db } from './firebase-init.js';
import { notifyUser } from './notifications.js';
import { uploadProfileImage } from './image-upload.js';
import { trioCache } from './trio-cache.js';
import { renderBadgesHtml } from './gamification/badges.js';
import { xpIntoLevel, XP_PER_LEVEL, levelFromXp } from './gamification/constants.js';
import { SoundManager } from './sound-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  doc, getDoc, collection, getDocs, query, where,
  setDoc, deleteDoc, serverTimestamp, updateDoc
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

// ── Cached single-user fetch ─────────────────────────────────────────────────
async function getCachedUser(uid) {
  const key = `user_${uid}`;
  const cached = trioCache.get(key);
  if (cached) return cached;
  const snap = await getDoc(doc(db, 'users', uid)).catch(() => null);
  if (!snap?.exists()) return null;
  const data = snap.data();
  trioCache.set(key, data, trioCache.TTL.DEFAULT);
  return data;
}

// ── Cached connections list ─────────────────────────────────────────────────
// followers/following counts don't change often — cache 2 min
async function getCachedFollowers(uid) {
  const key = `followers_${uid}`;
  const cached = trioCache.get(key);
  if (cached !== null) return cached;
  const snap = await getDocs(collection(db, 'users', uid, 'followers')).catch(() => ({ size: 0, docs: [] }));
  trioCache.set(key, snap.size, trioCache.TTL.SHORT);
  return snap.size;
}

async function getCachedFollowing(uid) {
  const key = `following_${uid}`;
  const cached = trioCache.get(key);
  if (cached !== null) return cached;
  const snap = await getDocs(collection(db, 'users', uid, 'following')).catch(() => ({ size: 0, docs: [] }));
  // Also cache the list of IDs (used by connections panel)
  trioCache.set(key, snap.size, trioCache.TTL.SHORT);
  trioCache.set(`following_ids_${uid}`, snap.docs.map(d => d.id), trioCache.TTL.SHORT);
  return snap.size;
}

async function getCachedFollowingIds(uid) {
  const key = `following_ids_${uid}`;
  const cached = trioCache.get(key);
  if (cached) return cached;
  const snap = await getDocs(collection(db, 'users', uid, 'following')).catch(() => ({ docs: [] }));
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
  const key = `posts_${uid}`;
  const cached = trioCache.get(key);
  if (cached) return cached;
  const snap = await getDocs(query(collection(db, 'posts'), where('uid', '==', uid)))
    .catch(() => ({ empty: true, docs: [] }));
  // Don't show stories (short-term 24h) in profile — only permanent posts
  const posts = snap.docs.map(d => ({ ...d.data(), _id: d.id })).filter(p => !p.isStory && p.type !== 'story');
  trioCache.set(key, posts, trioCache.TTL.SHORT);
  return posts;
}

// ── Load connections panel ───────────────────────────────────────────────────
async function loadConnections(uid) {
  const box = $('connectionsList'); if (!box) return;
  box.innerHTML = '';
  const ids = await getCachedFollowingIds(uid);
  const filtered = ids.filter(id => id !== uid);
  if (!filtered.length) { box.innerHTML = '<div class="connections-empty">No connections yet.</div>'; return; }
  // Use cached profile for each connection — no waterfall of getDoc calls
  const profiles = await Promise.all(filtered.map(id => getCachedUser(id)));
  profiles.filter(Boolean).forEach(u => {
    const a = document.createElement('a'); a.className = 'connection-row'; a.href = `profile.html?uid=${encodeURIComponent(u.uid)}`;
    const av = u.photoURL ? `<img src="${esc(u.photoURL)}" alt="">` : (u.name || 'U').charAt(0).toUpperCase();
    a.innerHTML = `<span class="user-avatar">${av}</span><span class="meta"><strong>${esc(u.name || 'User')}</strong><small class="muted">${esc(u.userId || u.uid)}</small></span><span class="connection-arrow">›</span>`;
    box.appendChild(a);
  });
}

// ── Edit profile modal ───────────────────────────────────────────────────────
async function openEdit(u) {
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal edit-dialog">
    <div class="modal-head"><div><span class="eyebrow">Your profile</span><h2>Edit profile</h2></div><button class="icon-btn close-edit" type="button">×</button></div>
    <label class="field"><span class="label-text">Name</span><input id="editName" type="text" maxlength="50" value="${esc(u.name || '')}"></label>
    <label class="field"><span class="label-text">Trio ID</span><input id="editUserId" type="text" maxlength="24" value="${esc(u.userId || makeUserId(me.uid))}" placeholder="TRIO-ABC123"><small class="field-help">3–24 characters: letters, numbers, _ or -</small></label>
    <label class="field"><span class="label-text">Bio</span><textarea id="editBio" maxlength="180" rows="4" placeholder="Tell people a little about you…">${esc(u.bio || '')}</textarea></label>
    <label class="field checkbox-field"><span class="label-text">Privacy</span><label class="check-row"><input id="editEmailHidden" type="checkbox" ${u.emailHidden ? 'checked' : ''}><strong>Hide email from profile</strong></label></label>
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
      let userId = overlay.querySelector('#editUserId').value.trim().toUpperCase().replace(/\s+/g, '-');
      if (!/^TRIO-[A-Z0-9_-]{2,20}$/.test(userId)) throw Error('Trio ID must look like TRIO-ABC123.');
      const dup = await getDocs(query(collection(db, 'users'), where('userId', '==', userId)));
      if (dup.docs.some(d => d.id !== me.uid)) throw Error('Ye Trio ID already kisi aur ne liya hai.');
      let photoURL = u.photoURL || null; const f = overlay.querySelector('#editPhoto').files?.[0];
      if (f) {
        if (!f.type.startsWith('image/')) throw Error('Only image files allowed.');
        if (f.size > 8 * 1024 * 1024) throw Error('Profile photo must be under 8MB.');
        st.textContent = 'Compressing & uploading photo…';
        photoURL = await uploadProfileImage(me.uid, f);
      }
      const bio = overlay.querySelector('#editBio').value.trim();
      const emailHidden = overlay.querySelector('#editEmailHidden').checked;
      await updateDoc(doc(db, 'users', me.uid), { name, userId, bio, photoURL, emailHidden, updatedAt: serverTimestamp() });
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
      await setDoc(a, { uid, userId: current?.userId || uid, name: current?.name || 'User', createdAt: serverTimestamp() });
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

// ── Main profile loader ──────────────────────────────────────────────────────
async function loadProfile(uid) {
  // 1. User document — cache first
  const userData = await getCachedUser(uid);
  if (!userData) { if ($('profileName')) $('profileName').textContent = 'User not found'; return; }
  current = { ...userData, uid: userData.uid || uid };

  // Render header
  avatar($('profileAvatar'), current);
  $('profileName').textContent = current.name || 'User';
  $('profileUserId').textContent = current.userId || makeUserId(uid);
  const isOwnProfile = me && me.uid === uid;
  const emailVisible = Boolean(current.email) && (!current.emailHidden || isOwnProfile);
  $('profileEmail').textContent = emailVisible ? current.email : (isOwnProfile ? 'Email hidden from public view' : 'Email hidden');
  $('profileBio').textContent = current.bio || 'No bio yet.';

  // 2. Follower / following counts — cached
  const [follCount, followingCount] = await Promise.all([
    getCachedFollowers(uid),
    getCachedFollowing(uid)
  ]);
  $('followersCount').textContent = `${follCount} Followers`;
  $('followingCount').textContent = `${followingCount} Following`;

  // Gamification panel
  const game = $('profileGame');
  if (game) {
    game.hidden = false;
    const xp = Number(current.xp) || 0;
    const level = current.level || levelFromXp(xp);
    const into = xpIntoLevel(xp);
    if ($('pgLevel')) $('pgLevel').textContent = level;
    if ($('pgXp')) $('pgXp').textContent = xp;
    if ($('pgStreak')) $('pgStreak').textContent = Number(current.streakCurrent) || 0;
    if ($('pgBest')) $('pgBest').textContent = Number(current.streakBest) || 0;
    if ($('pgXpFill')) $('pgXpFill').style.width = `${(into / XP_PER_LEVEL) * 100}%`;
    if ($('pgBadges')) $('pgBadges').innerHTML = renderBadgesHtml(current.badges || []);
  }

  // 3. Action buttons
  const actions = $('profileActions'); actions.innerHTML = '';
  if (me.uid === uid) {
    const b = document.createElement('button'); b.className = 'btn primary'; b.type = 'button'; b.textContent = 'Edit profile';
    b.onclick = () => openEdit(current); actions.appendChild(b);
  } else {
    const connected = await isConnected(me.uid, uid);
    const b = document.createElement('button'); b.className = 'btn primary'; b.type = 'button'; b.textContent = connected ? 'Connected' : 'Connect';
    b.onclick = () => connect(uid);
    const chat = document.createElement('a'); chat.className = 'btn secondary'; chat.href = `private-chat.html?uid=${encodeURIComponent(uid)}`; chat.textContent = 'Message';
    actions.append(b, chat);
  }

  // 4. Connections panel — cached
  await loadConnections(uid);

  // 5. Posts list — cached (story short-term, don't show in profile)
  const posts = $('postsList'); posts.innerHTML = '<div class="connections-empty">Loading posts…</div>';
  const userPosts = (await getCachedUserPosts(uid)).filter(p => !p.isStory && p.type !== 'story');
  posts.innerHTML = '';
  if (!userPosts.length) {
    posts.innerHTML = '<div class="connections-empty">No posts yet.</div>';
  } else {
    [...userPosts]
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      .forEach(p => {
        if (window.buildFeedItem) posts.appendChild(window.buildFeedItem(p));
        else { const el = document.createElement('div'); el.textContent = p.message || ''; posts.appendChild(el); }
      });
  }
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
