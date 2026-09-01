import { auth, db } from './firebase-init.js';
import { trioCache } from './trio-cache.js';
import { chatId } from './utils.js';
import { notificationText } from './services/notificationHelpers.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, doc, getDoc, onSnapshot,
  orderBy, query, limit, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { enableOneSignalPush } from './onesignal.js';
import { getMyGlobalRank } from './gamification/leaderboards.js';

const el = document.getElementById('authStatus');
let notificationUnsubs = [];

function clearNotificationListeners() { notificationUnsubs.forEach(u => u()); notificationUnsubs = []; }

function showAlert(title, body) {
  let stack = document.getElementById('appAlertStack');
  if (!stack) { stack = document.createElement('div'); stack.id = 'appAlertStack'; stack.className = 'app-alert-stack'; document.body.appendChild(stack); }
  const toast = document.createElement('div'); toast.className = 'app-alert';
  toast.innerHTML = `<strong>${title}</strong><span>${body}</span>`;
  stack.appendChild(toast); setTimeout(() => toast.remove(), 5000);
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden)
    new Notification(title, { body });
}



function renderNotificationRows(container, alerts, user) {
  container.innerHTML = '';
  if (!alerts.length) {
    const empty = document.createElement('p'); empty.className = 'notification-empty'; empty.textContent = 'No notifications yet.';
    container.appendChild(empty); return;
  }
  alerts.forEach(alert => {
    const row = document.createElement(alert.postId ? 'a' : 'button');
    row.className = `notification-item${alert.read ? '' : ' unread'}`;
    row.dataset.notificationId = alert.id;
    if (alert.postId) row.href = `view_post.html?postId=${encodeURIComponent(alert.postId)}`;
    else row.type = 'button';
    const title = document.createElement('strong'); title.textContent = notificationText(alert);
    const time = document.createElement('small'); time.textContent = new Date(alert.createdAtMs || Date.now()).toLocaleString();
    row.append(title, time);
    row.addEventListener('click', () => {
      if (!alert.read) updateDoc(doc(db, 'users', user.uid, 'notifications', alert.id), { read: true }).catch(() => { });
    });
    container.appendChild(row);
  });
}

function openNotificationOverlay(user) {
  document.getElementById('notificationOverlay')?.remove();
  const overlay = document.createElement('div'); overlay.id = 'notificationOverlay'; overlay.className = 'notification-overlay active';
  const panel = document.createElement('div'); panel.className = 'notification-modal'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
  panel.innerHTML = `<div class="notification-modal-head"><div><span class="eyebrow">Alerts</span><h2>Notifications</h2></div><button class="icon-btn notification-close" type="button" aria-label="Close notifications">×</button></div><div id="notificationModalList" class="notification-list"></div>`;
  overlay.appendChild(panel); document.body.appendChild(overlay);
  const close = () => overlay.remove();
  panel.querySelector('.notification-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const modalList = document.getElementById('notificationModalList');
  notificationUnsubs.push(onSnapshot(
    query(collection(db, 'users', user.uid, 'notifications'), orderBy('createdAtMs', 'desc'), limit(30)),
    snap => { const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderNotificationRows(modalList, alerts, user); },
    () => { renderNotificationRows(modalList, [], user); }
  ));
}

function listenForNotifications(user) {
  let initial = true;
  const button = document.getElementById('notificationButton'), badge = document.getElementById('notificationBadge'), menu = document.getElementById('notificationMenu');
  if (!button || !badge || !menu) return;
  notificationUnsubs.push(onSnapshot(
    query(collection(db, 'users', user.uid, 'notifications'), orderBy('createdAtMs', 'desc'), limit(30)),
    snap => {
      const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const unread = alerts.filter(a => !a.read).length;
      badge.hidden = !unread; badge.textContent = unread > 9 ? '9+' : String(unread);
      renderNotificationRows(menu, alerts, user);
      if (!initial) snap.docChanges().filter(c => c.type === 'added' && !c.doc.data().read).forEach(c => showAlert('New notification', notificationText(c.doc.data())));
      initial = false;
    }, () => { }
  ));
  button.addEventListener('click', async e => { e.preventDefault(); e.stopPropagation(); openNotificationOverlay(user); });
}

// ── Chat unread helpers ──────────────────────────────────────────────────────
function chatSeenKey(uid) { return `trio_chat_seen_${uid}`; }
function getChatSeenMap(uid) { try { return JSON.parse(localStorage.getItem(chatSeenKey(uid)) || '{}'); } catch { return {}; } }
function markChatSeen(uid, peerId, ms = Date.now()) {
  if (!uid || !peerId) return;
  const map = getChatSeenMap(uid);
  map[peerId] = Math.max(Number(map[peerId]) || 0, Number(ms) || Date.now());
  localStorage.setItem(chatSeenKey(uid), JSON.stringify(map));
  window.dispatchEvent(new CustomEvent('trio-chat-unread-change', { detail: { peerId } }));
}
function isChatUnread(uid, peerId, latest) {
  if (!uid || !peerId || !latest) return false;
  const map = getChatSeenMap(uid);
  if (!Object.prototype.hasOwnProperty.call(map, peerId)) {
    map[peerId] = Number(latest.createdAtMs) || Date.now();
    localStorage.setItem(chatSeenKey(uid), JSON.stringify(map)); return false;
  }
  if (latest.uid === uid) return false;
  return (Number(latest.createdAtMs) || 0) > (Number(map[peerId]) || 0);
}
function ensureChatNavDot() {
  const link = document.querySelector('.bottom-nav a.nav-btn[href="chat.html"]');
  if (!link) return null;
  let dot = link.querySelector('.nav-chat-dot');
  if (!dot) { link.classList.add('nav-btn-chat'); dot = document.createElement('span'); dot.className = 'nav-chat-dot'; dot.hidden = true; dot.title = 'Unread chats'; dot.setAttribute('aria-hidden', 'true'); link.appendChild(dot); }
  return dot;
}
function setChatNavUnread(hasUnread) { const dot = ensureChatNavDot(); if (dot) dot.hidden = !hasUnread; }
window.TrioChatUnread = { getChatSeenMap, markChatSeen, isChatUnread, setChatNavUnread };

function listenForAlerts(user) {
  clearNotificationListeners();
  let connectedReady = false;
  const peers = new Map(), unreadPeers = new Set();
  const refreshNavDot = () => setChatNavUnread(unreadPeers.size > 0);

  const attachChatListener = peerId => {
    if (!peerId || peers.has(peerId)) return;
    let ready = false;
    const messages = query(collection(db, 'privateChats', chatId(user.uid, peerId), 'messages'), orderBy('createdAtMs', 'desc'), limit(1));
    peers.set(peerId, onSnapshot(messages, snap => {
      const latest = snap.docs[0]?.data();
      if (isChatUnread(user.uid, peerId, latest)) unreadPeers.add(peerId); else unreadPeers.delete(peerId);
      refreshNavDot();
      if (!ready) { ready = true; return; }
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const msg = change.doc.data();
        if (msg.uid === user.uid) return;
        unreadPeers.add(peerId); refreshNavDot();
        showAlert(`Message from ${msg.name || 'User'}`, msg.sharedPostId ? 'Shared a post with you' : (msg.text || 'New message'));
      });
    }, () => { }));
  };

  const peerIds = new Set();
  const syncPeerListeners = () => {
    const ids = new Set([...peers.keys()]);
    ids.forEach(id => { if (!peerIds.has(id)) { peers.get(id)?.(); peers.delete(id); unreadPeers.delete(id); } });
    peerIds.forEach(attachChatListener); refreshNavDot();
  };

  notificationUnsubs.push(() => { peers.forEach(unsub => unsub()); peers.clear(); unreadPeers.clear(); setChatNavUnread(false); });
  const addPeers = snap => { snap.docs.forEach(d => peerIds.add(d.id)); syncPeerListeners(); };

  notificationUnsubs.push(onSnapshot(collection(db, 'users', user.uid, 'following'), snap => { connectedReady = true; addPeers(snap); }, () => { }));
  notificationUnsubs.push(onSnapshot(collection(db, 'users', user.uid, 'followers'), snap => { addPeers(snap); }, () => { }));

  const onUnreadEvent = e => { const peerId = e?.detail?.peerId; if (peerId) unreadPeers.delete(peerId); refreshNavDot(); };
  window.addEventListener('trio-chat-unread-change', onUnreadEvent);
  notificationUnsubs.push(() => window.removeEventListener('trio-chat-unread-change', onUnreadEvent));
}

// ── Auth state → render header chip ─────────────────────────────────────────
// ── Global rank badge above bottom nav ───────────────────────────────────────
// Renders a compact "🏆 #12" pill above the existing 5-tab bottom nav.
// Clicking it navigates to leaderboard.html.
// Does NOT add a sixth nav item — it sits in its own thin strip above the nav.

function removeRankBadge() {
  document.getElementById('trioRankStrip')?.remove();
}

async function renderRankBadge(uid) {
  const rank = await getMyGlobalRank(uid).catch(() => null);

  // Remove stale badge if it exists
  removeRankBadge();

  // Don't show if not yet ranked
  if (!rank) return;

  const strip = document.createElement('div');
  strip.id = 'trioRankStrip';
  strip.innerHTML = `<a href="leaderboard.html" class="rank-strip-link" aria-label="Your global rank ${rank}">🏆 <strong>#${rank}</strong> Global</a>`;

  // Insert directly above the .bottom-nav element
  const nav = document.querySelector('.bottom-nav');
  if (nav) {
    nav.parentNode.insertBefore(strip, nav);
  } else {
    document.body.appendChild(strip);
  }
}

// Expose so XP-awarding pages can trigger a rank refresh
window.trioRefreshRank = (uid) => uid && renderRankBadge(uid).catch(() => {});

onAuthStateChanged(auth, async user => {
  clearNotificationListeners();
  if (!el) return;
  if (user) {
    // ── Cached profile fetch for header chip ──
    // Without cache: every page load → getDoc(users/uid) just to show name + photo in header.
    // With cache: first page sets it, every other page in same session hits memory instantly.
    const key = `user_${user.uid}`;
    let profileData = trioCache.get(key);
    if (!profileData) {
      const profile = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
      profileData = profile?.exists() ? profile.data() : null;
      if (profileData) trioCache.set(key, profileData, trioCache.TTL.DEFAULT);
    }

    const name = profileData?.name || user.displayName || user.email?.split('@')[0] || 'User';
    const photo = profileData?.photoURL || user.photoURL || '';
    const initial = name.trim().charAt(0).toUpperCase() || 'U';

    el.innerHTML = `
      <div class="notification-wrap">
        <button id="notificationButton" class="notification-btn" type="button" aria-label="Notifications" aria-haspopup="true">🔔<span id="notificationBadge" class="notification-badge" hidden></span></button>
        <div id="notificationMenu" class="notification-menu" hidden></div>
      </div>
      <a class="auth-chip" href="profile.html">
        <img class="auth-avatar" src="${photo}" alt="" onerror="this.style.display='none'">
        <span class="auth-avatar-fallback" style="${photo ? 'display:none' : ''}">${initial}</span>
        <span class="auth-name">${name}</span>
      </a>
      <button class="auth-logout" id="logoutBtn" title="Logout">⏻</button>`;

    document.getElementById('logoutBtn').onclick = async () => {
      trioCache.clear();   // wipe all cached data on explicit logout
      await signOut(auth);
      location.href = 'login.html';
    };

    listenForNotifications(user);
    listenForAlerts(user);
    enableOneSignalPush(user).catch(err => console.warn('OneSignal enable failed', err));

    // ── Rank indicator: inject 🏆 #N above the bottom nav ──────────────────
    // Cached with SHORT TTL; refreshed here on every page load after auth.
    // A global CustomEvent 'trio-xp-changed' can trigger a re-render from
    // any page that awards XP (e.g. tasks.js after manualBump).
    renderRankBadge(user.uid);
    window.addEventListener('trio-xp-changed', () => renderRankBadge(user.uid), { once: false });
  } else {
    el.innerHTML = '<a href="login.html" class="auth-login-btn">Login</a>';
    removeRankBadge();
  }
});

document.addEventListener('click', () => {
  const menu = document.getElementById('notificationMenu');
  if (menu) menu.hidden = true;
});
