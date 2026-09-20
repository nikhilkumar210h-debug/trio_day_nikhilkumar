import { auth, db } from './firebase-init.js';
import { trioCache } from './trio-cache.js';
import { chatId } from './utils.js';
import { notificationText } from './services/notificationHelpers.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, doc, getDoc, onSnapshot,
  orderBy, query, limit, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { enableOneSignalPush } from './onesignal.js?v=24';

const el = document.getElementById('authStatus');
let notificationUnsubs = [];

function clearNotificationListeners() { notificationUnsubs.forEach(u => u()); notificationUnsubs = []; }

function showAlert(title, body) {
  let stack = document.getElementById('appAlertStack');
  if (!stack) { stack = document.createElement('div'); stack.id = 'appAlertStack'; stack.className = 'app-alert-stack'; document.body.appendChild(stack); }
  const toast = document.createElement('div'); toast.className = 'app-alert';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const span = document.createElement('span');
  span.textContent = body;
  toast.append(strong, span);
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
  button.addEventListener('click', () => { location.href = 'notifications.html'; });
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
  const link = document.querySelector('.nkm-rail a.nav-btn[data-rail="chat"], .bottom-nav a.nav-btn[href="chat.html"]');
  if (!link) return null;
  let dot = link.querySelector('.nav-chat-dot');
  if (!dot) { link.classList.add('nav-btn-chat'); dot = document.createElement('span'); dot.className = 'nav-chat-dot'; dot.hidden = true; dot.title = 'Unread chats'; dot.setAttribute('aria-hidden', 'true'); link.appendChild(dot); }
  return dot;
}
function ensureHeaderChatDot() {
  const btn = document.getElementById('headerChatBtn');
  if (!btn) return null;
  let dot = document.getElementById('headerChatDot');
  if (!dot) { dot = document.createElement('span'); dot.id = 'headerChatDot'; dot.className = 'nav-chat-dot'; dot.hidden = true; dot.title = 'Unread chats'; dot.setAttribute('aria-hidden','true'); btn.appendChild(dot); }
  return dot;
}
function setChatNavUnread(hasUnread) {
  const dot = ensureChatNavDot(); if (dot) dot.hidden = !hasUnread;
  const hDot = ensureHeaderChatDot(); if (hDot) hDot.hidden = !hasUnread;
}
window.TrioChatUnread = { getChatSeenMap, markChatSeen, isChatUnread, setChatNavUnread };

function listenForAlerts(user) {
  clearNotificationListeners();
  const peers = new Map(), unreadPeers = new Set();
  const followingIds = new Set(), followerIds = new Set();

  const refreshNavDot = () => setChatNavUnread(unreadPeers.size > 0);
  const syncPeerListeners = () => {
    const desired = new Set([...followingIds, ...followerIds]);
    for (const [peerId, unsubscribe] of peers) {
      if (!desired.has(peerId)) {
        unsubscribe();
        peers.delete(peerId);
        unreadPeers.delete(peerId);
      }
    }
    desired.forEach(attachChatListener);
    refreshNavDot();
  };

  const attachChatListener = peerId => {
    if (!peerId || peerId === user.uid || peers.has(peerId)) return;
    let ready = false;
    const messages = query(
      collection(db, 'privateChats', chatId(user.uid, peerId), 'messages'),
      orderBy('createdAtMs', 'desc'),
      limit(1)
    );
    peers.set(peerId, onSnapshot(messages, snap => {
      const latest = snap.docs[0]?.data();
      if (isChatUnread(user.uid, peerId, latest)) unreadPeers.add(peerId);
      else unreadPeers.delete(peerId);
      refreshNavDot();
      if (!ready) { ready = true; return; }
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const msg = change.doc.data();
        if (msg.uid === user.uid) return;
        unreadPeers.add(peerId);
        refreshNavDot();
        showAlert(
          `Message from ${msg.name || 'User'}`,
          msg.sharedPostId ? 'Shared a post with you' : (msg.text || 'New message')
        );
      });
    }, () => {}));
  };

  const setIds = (target, snap) => {
    target.clear();
    snap.docs.forEach(d => { if (d.id !== user.uid) target.add(d.id); });
    syncPeerListeners();
  };

  notificationUnsubs.push(onSnapshot(
    collection(db, 'users', user.uid, 'following'),
    snap => setIds(followingIds, snap),
    () => {}
  ));
  notificationUnsubs.push(onSnapshot(
    collection(db, 'users', user.uid, 'followers'),
    snap => setIds(followerIds, snap),
    () => {}
  ));

  notificationUnsubs.push(() => {
    peers.forEach(unsubscribe => unsubscribe());
    peers.clear();
    followingIds.clear();
    followerIds.clear();
    unreadPeers.clear();
    setChatNavUnread(false);
  });

  const onUnreadEvent = e => {
    const peerId = e?.detail?.peerId;
    if (peerId) unreadPeers.delete(peerId);
    refreshNavDot();
  window.addEventListener('trio-chat-unread-change', onUnreadEvent);
  notificationUnsubs.push(() => window.removeEventListener('trio-chat-unread-change', onUnreadEvent));
}

// ── Auth state → render header chip ─────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  clearNotificationListeners();
  if (!el) return;
  if (user) {
    el.innerHTML = '';


    // Header logout removed — now only in Profile section. Keep handler for profile page.
    const profileLogout = document.getElementById('profileLogoutBtn');
    if (profileLogout) profileLogout.onclick = async () => {
      trioCache.clear();
      await signOut(auth);
      location.href = 'login.html';
    };

    // Skip notification listener on notifications.html (notifications.js handles it)
    if (!location.pathname.endsWith('notifications.html')) {
      listenForNotifications(user);
    }
    listenForAlerts(user);
    enableOneSignalPush(user).catch(err => console.warn('OneSignal enable failed', err));

  } else {
    el.innerHTML = '<a href="login.html" class="auth-login-btn">Login</a>';
  }
});

document.addEventListener('click', () => {
  const menu = document.getElementById('notificationMenu');
  if (menu) menu.hidden = true;
});
