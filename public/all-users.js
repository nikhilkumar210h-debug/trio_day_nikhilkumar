import { auth, db } from './firebase-init.js';
import { notifyUser } from './notifications.js';
import { trioCache } from './trio-cache.js';
import { escapeHtml as esc, avatarHtml } from './utils.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, getDocs, doc, getDoc,
  setDoc, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
let me = null, users = [];



// ── Cached connection state ──────────────────────────────────────────────────
async function getConnState(theirUid) {
  const key = `connstate_${me.uid}_${theirUid}`;
  const cached = trioCache.get(key);
  if (cached !== null) return cached;                    // true / false from cache
  const exists = (await getDoc(doc(db, 'users', me.uid, 'following', theirUid)).catch(() => null))?.exists() ?? false;
  trioCache.set(key, exists, trioCache.TTL.SHORT);
  return exists;
}

// ── Cached my profile ────────────────────────────────────────────────────────
async function getMyProfile() {
  const key = `user_${me.uid}`;
  const cached = trioCache.get(key);
  if (cached) return cached;
  const snap = await getDoc(doc(db, 'users', me.uid)).catch(() => null);
  const data = snap?.exists() ? snap.data() : null;
  if (data) trioCache.set(key, data, trioCache.TTL.DEFAULT);
  return data;
}

// ── Render user cards ────────────────────────────────────────────────────────
function render(filter = '') {
  const q = filter.toLowerCase().trim(), box = $('usersList');
  box.innerHTML = '';
  const list = users.filter(u =>
    u.uid && u.uid !== me.uid &&
    [u.name, u.userId, u.uid].some(x => (x || '').toLowerCase().includes(q))
  );
  if (!list.length) { box.innerHTML = '<p class="empty-hint">No user found.</p>'; return; }

  list.forEach(async u => {
    const card = document.createElement('article'); card.className = 'user-card';
    card.innerHTML = `
      <a class="user-avatar user-avatar-link" href="profile.html?uid=${encodeURIComponent(u.uid)}">${avatarHtml(u)}</a>
      <div class="user-main">
        <a class="user-name-link" href="profile.html?uid=${encodeURIComponent(u.uid)}"><div class="name">${esc(u.name || 'User')}</div></a>
        ${u.bio ? `<div class="user-bio">${esc(u.bio)}</div>` : ''}
        <div class="user-actions">
          <button class="mini-btn connect-btn" type="button" disabled>…</button>
          <a class="mini-btn message-btn" href="private-chat.html?uid=${encodeURIComponent(u.uid)}">Message</a>
        </div>
      </div>`;

    const connectBtn = card.querySelector('.connect-btn');

    // Use cached state — no Firestore read if already known
    const connected = await getConnState(u.uid);
    connectBtn.textContent = connected ? 'Connected' : 'Connect';
    connectBtn.disabled = false;

    connectBtn.addEventListener('click', async e => {
      e.preventDefault(); e.stopPropagation(); connectBtn.disabled = true;
      try {
        if (u.uid === me.uid) throw Error('You cannot connect with yourself.');
        const myRef = doc(db, 'users', me.uid, 'following', u.uid);
        const theirRef = doc(db, 'users', u.uid, 'followers', me.uid);
        const s = await getDoc(myRef);
        if (s.exists()) {
          await deleteDoc(myRef); await deleteDoc(theirRef).catch(() => { });
          connectBtn.textContent = 'Connect';
          trioCache.set(`connstate_${me.uid}_${u.uid}`, false, trioCache.TTL.SHORT);
        } else {
          const mine = await getMyProfile();
          const myName = mine?.name || me.displayName || 'Someone';
          await setDoc(myRef, { uid: u.uid, userId: u.userId || u.uid, name: u.name || 'User', createdAt: serverTimestamp() });
          await setDoc(theirRef, { uid: me.uid, createdAt: serverTimestamp() });
          await notifyUser(u.uid, { type: 'connect', actorUid: me.uid, actorName: myName });
          connectBtn.textContent = 'Connected';
          trioCache.set(`connstate_${me.uid}_${u.uid}`, true, trioCache.TTL.SHORT);
        }
        // Invalidate following list cache so share menu + profile counts refresh
        trioCache.invalidate(`following_${me.uid}`);
        trioCache.invalidate(`following_ids_${me.uid}`);
        trioCache.invalidate(`followers_${u.uid}`);
        trioCache.invalidate(`connections_${me.uid}`);
      } catch (err) { console.error(err); alert(err.message || 'Connect failed.'); }
      finally { connectBtn.disabled = false; }
    });

    box.appendChild(card);
  });
}

// ── Auth + initial load ──────────────────────────────────────────────────────
onAuthStateChanged(auth, async u => {
  if (!u) { location.href = 'login.html?redirect=all-users.html'; return; }
  me = u;

  // ── Cached users list — LONG TTL (10 min) ──
  // This is the most expensive query (full collection scan).
  // After first load it won't hit Firestore again for 10 minutes.
  const cacheKey = 'allUsers';
  const cachedList = trioCache.get(cacheKey);
  if (cachedList) {
    users = cachedList;
    // Ensure current user is in list
    if (!users.some(x => x.uid === u.uid))
      users.push({ uid: u.uid, name: u.displayName || 'User', userId: u.uid, photoURL: u.photoURL || null });
    render();
    return;
  }

  const snap = await getDocs(collection(db, 'users'));
  users = snap.docs.map(d => ({ ...d.data(), uid: d.data().uid || d.id }));
  if (!users.some(x => x.uid === u.uid))
    users.push({ uid: u.uid, name: u.displayName || 'User', userId: u.uid, photoURL: u.photoURL || null });

  // Cache the list — also warm up individual user caches
  trioCache.set(cacheKey, users, trioCache.TTL.LONG);
  users.forEach(user => {
    const key = `user_${user.uid}`;
    if (!trioCache.get(key)) trioCache.set(key, user, trioCache.TTL.LONG);
  });

  render();
});

$('usersSearch').addEventListener('input', e => render(e.target.value));
