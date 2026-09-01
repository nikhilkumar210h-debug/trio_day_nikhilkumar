import { auth, db } from './firebase-init.js';
import { trioCache } from './trio-cache.js';
import { SoundManager } from './sound-manager.js';
import { escapeHtml as esc, avatarHtml, nameOf, timeOf, chatId } from './utils.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  getDocs, doc, deleteDoc, limit
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
let currentUser = null;
let users = [];
let inboxUnsubs = [];
let groupUnsub = null;
const conversations = new Map();
const params = new URLSearchParams(location.search);

function previewText(m) { if (!m) return ''; if (m.replyToStoryId) return '↩️ Story reply: ' + String(m.text || '').replace(/\s+/g,' ').slice(0,40); if (m.sharedPostId) return '📎 Shared a post'; return String(m.text || '').replace(/\s+/g, ' ').trim(); }
function chatSeenKey(uid) { return `trio_chat_seen_${uid}`; }
function getChatSeenMap(uid) { try { return JSON.parse(localStorage.getItem(chatSeenKey(uid)) || '{}'); } catch { return {}; } }
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

function setCurrentUserPill() {
  if (!$('chatPillName')) return;
  $('chatPillName').textContent = nameOf(currentUser);
  $('chatPillAvatar').innerHTML = avatarHtml(currentUser);
}

function clearInboxListeners() { inboxUnsubs.forEach(u => u()); inboxUnsubs = []; }

// ── Private inbox render ─────────────────────────────────────────────────────
function renderInbox(filter = '') {
  const list = $('userList'); if (!list) return;
  const qText = filter.trim().toLowerCase(); list.innerHTML = '';
  const rows = users
    .filter(u => u.uid && u.uid !== currentUser.uid && conversations.has(u.uid))
    .filter(u => { const text = `${nameOf(u)} ${u.userId || u.uid} ${previewText(conversations.get(u.uid)?.latest)}`.toLowerCase(); return !qText || text.includes(qText); })
    .sort((a, b) => (conversations.get(b.uid)?.latest?.createdAtMs || 0) - (conversations.get(a.uid)?.latest?.createdAtMs || 0));
  const countBadge = $('conversationCount'); if (countBadge) countBadge.textContent = String(rows.length);
  if (rows.length === 0) {
    list.innerHTML = `<div class="connections-empty inbox-empty"><div class="inbox-empty-icon">✉</div><p>Abhi koi conversation nahi hai.</p><p><a href="all-users.html">Users</a> se kisi ko message karo.</p></div>`;
    return;
  }
  rows.forEach(peer => {
    const latest = conversations.get(peer.uid)?.latest, unread = conversations.get(peer.uid)?.unread;
    const row = document.createElement('div'); row.className = 'chat-user-row';
    row.innerHTML = `<a class="chat-user inbox-user" href="private-chat.html?uid=${encodeURIComponent(peer.uid)}">
      <span class="user-avatar">${avatarHtml(peer)}</span>
      <span class="user-copy">
        <span class="name-line"><span class="name">${esc(nameOf(peer))}</span>${unread ? '<span class="chat-unread-dot" title="New message"></span>' : ''}</span>
        <span class="last-message">${esc(previewText(latest) || 'Start conversation')}</span>
        <span class="conversation-meta"><span>${esc(peer.userId || peer.uid)}</span><span>${esc(timeOf(latest?.createdAtMs))}</span></span>
      </span>
      <span class="chat-user-chevron">›</span></a>`;
    list.appendChild(row);
  });
}

function watchInbox() {
  clearInboxListeners(); conversations.clear();
  renderInbox($('userSearch')?.value || '');
  users.filter(u => u.uid && u.uid !== currentUser.uid).forEach(peer => {
    const messages = query(collection(db, 'privateChats', chatId(currentUser.uid, peer.uid), 'messages'), orderBy('createdAtMs', 'desc'), limit(1));
    const unsub = onSnapshot(messages, snap => {
      const latestDoc = snap.docs[0];
      if (!latestDoc) { conversations.delete(peer.uid); renderInbox($('userSearch')?.value || ''); return; }
      const latest = latestDoc.data();
      conversations.set(peer.uid, { latest, unread: isChatUnread(currentUser.uid, peer.uid, latest) });
      renderInbox($('userSearch')?.value || '');
    }, err => console.error('Inbox listener:', err));
    inboxUnsubs.push(unsub);
  });
}

// ── Delete group message ─────────────────────────────────────────────────────
async function deleteGroupMessage(msgDocId) {
  if (!currentUser) return;
  if (!window.confirm('Yeh message delete karna chahte ho? Group se hata diya jayega.')) return;
  SoundManager.delete();
  try { await deleteDoc(doc(db, 'groupChat', msgDocId)); }
  catch (err) { console.error('Group delete failed:', err); alert('Message delete nahi hua: ' + (err?.message || err)); }
}

const trashSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

// ── Group chat render ────────────────────────────────────────────────────────
function renderGroup() {
  const q = query(collection(db, 'groupChat'), orderBy('createdAtMs', 'asc'));
  groupUnsub?.();
  groupUnsub = onSnapshot(q, snap => {
    const box = $('groupMessages'); if (!box) return;
    box.innerHTML = '';
    snap.forEach(d => {
      const m = d.data(), msgDocId = d.id, mine = m.uid === currentUser.uid;
      const row = document.createElement('div'); row.className = 'msg' + (mine ? ' mine' : ''); row.dataset.msgId = msgDocId;
      row.innerHTML = `<div class="msg-bubble">
        ${!mine ? `<a class="msg-name msg-user-link" href="profile.html?uid=${encodeURIComponent(m.uid || '')}">${esc(m.name)}</a><div class="msg-id">${esc(m.userId || '')}</div>` : ''}
        <div class="msg-text">${esc(m.text)}</div>
        <div class="msg-footer"><span class="msg-time">${esc(timeOf(m.createdAtMs))}</span>
        ${mine ? `<button class="msg-delete-btn" data-id="${esc(msgDocId)}" title="Delete message" aria-label="Delete message">${trashSvg}</button>` : ''}
        </div></div>`;
      box.appendChild(row);
    });
    box.querySelectorAll('.msg-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); deleteGroupMessage(btn.dataset.id); });
    });
    box.scrollTop = box.scrollHeight;
  }, err => console.error('Group listener:', err));
}

// ── Load users — cache-first ─────────────────────────────────────────────────
// chat.js previously called getDocs(users) on every page load.
// Now it reuses the allUsers cache warmed by all-users.js (or fetches once).
async function loadUsers() {
  const cacheKey = 'allUsers';
  const cached = trioCache.get(cacheKey);
  if (cached) {
    users = cached;
  } else {
    const snap = await getDocs(collection(db, 'users'));
    users = snap.docs.map(d => ({ ...d.data(), uid: d.data().uid || d.id }));
    trioCache.set(cacheKey, users, trioCache.TTL.LONG);
    // Warm individual user caches as a side-effect
    users.forEach(u => { const k = `user_${u.uid}`; if (!trioCache.get(k)) trioCache.set(k, u, trioCache.TTL.LONG); });
  }
  if (!users.some(u => u.uid === currentUser.uid))
    users.push({ uid: currentUser.uid, name: nameOf(currentUser), email: currentUser.email });
  setCurrentUserPill();
  watchInbox();
}

// ── Tab switching ────────────────────────────────────────────────────────────
function setChatMode(mode = 'private') {
  const next = mode === 'group' ? 'group' : 'private';
  document.querySelectorAll('.chat-mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === next));
  $('privateInbox').hidden = next !== 'private';
  $('groupPanel').hidden = next !== 'group';
  if (next === 'group') renderGroup();
  if (next === 'private') renderInbox($('userSearch')?.value || '');
}

// ── Event listeners ──────────────────────────────────────────────────────────
$('userSearch')?.addEventListener('input', e => renderInbox(e.target.value));
document.querySelectorAll('.chat-mode-btn').forEach(btn => btn.addEventListener('click', () => { SoundManager.click(); setChatMode(btn.dataset.mode); }));
// Fix: red dot stuck — re-render inbox when private-chat marks seen
window.addEventListener('trio-chat-unread-change', () => renderInbox($('userSearch')?.value || ''));
window.addEventListener('storage', (e)=>{ if(e.key && e.key.startsWith('trio_chat_seen_')) renderInbox($('userSearch')?.value || ''); });

$('groupForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const input = $('groupInput'), sendBtn = $('groupForm')?.querySelector('button[type="submit"]');
  const text = input.value.trim(); if (!text) return;
  if (sendBtn) sendBtn.disabled = true;
  try {
    await addDoc(collection(db, 'groupChat'), {
      uid: currentUser.uid, name: nameOf(currentUser),
      userId: users.find(u => u.uid === currentUser.uid)?.userId || currentUser.uid,
      text, createdAt: Date.now(), createdAtMs: Date.now()
    });
    SoundManager.send();
    input.value = ''; input.focus();
  } catch (err) { console.error(err); alert('Message send nahi hua.'); }
  finally { if (sendBtn) sendBtn.disabled = false; }
});

// ── Auth ─────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async u => {
  clearInboxListeners();
  if (!u) { location.href = 'login.html?redirect=chat.html'; return; }
  SoundManager.init();
  currentUser = u;
  const openUid = params.get('uid');
  if (openUid && openUid !== u.uid) { location.replace(`private-chat.html?uid=${encodeURIComponent(openUid)}`); return; }
  await loadUsers();
  setChatMode('private');
});
