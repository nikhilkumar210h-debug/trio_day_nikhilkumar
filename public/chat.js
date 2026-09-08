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
let groupUnsub = null;
const conversations = new Map();
const params = new URLSearchParams(location.search);

function previewText(m) { if (!m) return ''; if (m.replyToStoryId) return '↩️ Story reply'; if (m.sharedPostId) return '📎 Shared a post'; return String(m.text || '').replace(/\s+/g, ' ').trim().slice(0,40); }
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

function renderInbox(filter = '') {
  const list = $('userList'); if (!list) return;
  const qText = filter.trim().toLowerCase(); list.innerHTML = '';
  const rows = users
    .filter(u => u.uid && u.uid !== currentUser.uid && conversations.has(u.uid))
    .filter(u => { const text = `${nameOf(u)} ${u.userId || u.uid} ${previewText(conversations.get(u.uid)?.latest)}`.toLowerCase(); return !qText || text.includes(qText); })
    .sort((a, b) => (conversations.get(b.uid)?.latest?.createdAtMs || 0) - (conversations.get(a.uid)?.latest?.createdAtMs || 0))
    .slice(0,20);
  const countBadge = $('conversationCount'); if (countBadge) countBadge.textContent = String(rows.length);
  if (rows.length === 0) {
    list.innerHTML = `<div class="nkm-chat-empty"><span>✉</span><p>No conversations yet.</p><a class="nkm-btn nkm-btn--primary nkm-btn--sm" href="all-users.html">Start a Conversation</a></div>`;
    return;
  }
  rows.forEach(peer => {
    const latest = conversations.get(peer.uid)?.latest, unread = conversations.get(peer.uid)?.unread;
    const row = document.createElement('a'); row.className = 'nkm-chat-row'; row.href = `private-chat.html?uid=${encodeURIComponent(peer.uid)}`;
    row.innerHTML = `<span class="nkm-chat-avatar">${avatarHtml(peer)}</span>
      <span class="nkm-chat-meta">
        <span class="nkm-chat-name">${esc(nameOf(peer))}</span>
        <span class="nkm-chat-preview">${esc(previewText(latest) || 'Start conversation')}</span>
        <span class="nkm-chat-sub"><span>${esc(peer.userId || peer.uid)}</span></span>
      </span>
      <span class="nkm-chat-time">${esc(timeOf(latest?.createdAtMs))}</span>
      ${unread ? '<span class="nkm-chat-unread" title="New"></span>' : ''}`;
    list.appendChild(row);
  });
}

async function watchInbox() {
  conversations.clear();
  renderInbox($('userSearch')?.value || '');
  // Efficient: get peerIds from cached following/followers (no full users scan), limit 20 most recent via one-time preview fetches
  const following = trioCache.get(`following_ids_${currentUser.uid}`) || [];
  const followersSnap = trioCache.get(`followers_ids_${currentUser.uid}`) || [];
  let peerIds = [...new Set([...following, ...followersSnap])].slice(0,40);
  if (!peerIds.length) {
    // fallback: use users list limited to 20 not current
    peerIds = users.filter(u=>u.uid!==currentUser.uid).slice(0,20).map(u=>u.uid);
  }
  // one-time preview fetch for each peer (no realtime listeners for hub)
  const previews = await Promise.all(peerIds.slice(0,20).map(async pid=>{
    try{
      const q = query(collection(db, 'privateChats', chatId(currentUser.uid, pid), 'messages'), orderBy('createdAtMs','desc'), limit(1));
      const snap = await getDocs(q);
      const doc0 = snap.docs[0];
      if(!doc0) return null;
      const latest = doc0.data();
      return { pid, latest, unread: isChatUnread(currentUser.uid, pid, latest) };
    }catch{ return null; }
  }));
  previews.filter(Boolean).forEach(p=> conversations.set(p.pid, {latest:p.latest, unread:p.unread}));
  renderInbox($('userSearch')?.value || '');
}

async function deleteGroupMessage(msgDocId) {
  if (!currentUser) return;
  if (!window.confirm('Yeh message delete karna chahte ho? Group se hata diya jayega.')) return;
  SoundManager.delete();
  try { await deleteDoc(doc(db, 'groupChat', msgDocId)); }
  catch (err) { console.error('Group delete failed:', err); alert('Message delete nahi hua: ' + (err?.message || err)); }
}
const trashSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

function renderGroup() {
  const q = query(collection(db, 'groupChat'), orderBy('createdAtMs', 'asc'), limit(50));
  groupUnsub?.();
  groupUnsub = onSnapshot(q, snap => {
    const box = $('groupMessages'); if (!box) return;
    box.innerHTML = '';
    if(snap.empty){ box.innerHTML='<div class="nkm-chat-empty"><p>No group messages yet.</p><p>Be first to say hi.</p></div>'; return; }
    snap.forEach(d => {
      const m = d.data(), msgDocId = d.id, mine = m.uid === currentUser.uid;
      const displayText = m.text ?? m.message ?? m.content ?? '';
      if (!displayText || !String(displayText).trim()) return;
      const row = document.createElement('div'); row.className = 'msg' + (mine ? ' mine' : ''); row.dataset.msgId = msgDocId;
      const peer = users.find(u=>u.uid===m.uid);
      const ava = `<span style="width:28px;height:28px;border-radius:50%;flex:none;display:grid;place-items:center;overflow:hidden;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;font-weight:700;font-size:11px">${peer ? avatarHtml(peer) : esc((m.name||'U')[0])}</span>`;
      // Single row: avatar + name + message together inside msg-bubble — always show text
      row.innerHTML = `${ava}<div class="msg-bubble">
        <a class="msg-name msg-user-link" href="profile.html?uid=${encodeURIComponent(m.uid || '')}">${esc(m.name || 'User')}</a><div class="msg-id">${esc(m.userId || '')}</div>
        <div class="msg-text">${esc(displayText)}</div>
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

async function loadUsers() {
  const cacheKey = 'allUsers';
  const cached = trioCache.get(cacheKey);
  if (cached) {
    users = cached;
  } else {
    const snap = await getDocs(query(collection(db, 'users'), limit(20)));
    users = snap.docs.map(d => ({ ...d.data(), uid: d.data().uid || d.id }));
    trioCache.set(cacheKey, users, trioCache.TTL.LONG);
    users.forEach(u => { const k = `user_${u.uid}`; if (!trioCache.get(k)) trioCache.set(k, u, trioCache.TTL.LONG); });
  }
  if (!users.some(u => u.uid === currentUser.uid))
    users.push({ uid: currentUser.uid, name: nameOf(currentUser), email: currentUser.email });
  await watchInbox();
}

function setChatMode(mode = 'private') {
  const next = mode === 'group' ? 'group' : 'private';
  document.querySelectorAll('.chat-mode-btn').forEach(btn => btn.classList.toggle('is-active', btn.dataset.mode === next));
  document.querySelectorAll('.chat-mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === next));
  $('privateInbox').hidden = next !== 'private';
  $('groupPanel').hidden = next !== 'group';
  if (next === 'group') renderGroup();
  if (next === 'private') renderInbox($('userSearch')?.value || '');
}

$('userSearch')?.addEventListener('input', e => renderInbox(e.target.value));
document.querySelectorAll('.chat-mode-btn').forEach(btn => btn.addEventListener('click', () => { SoundManager.click(); setChatMode(btn.dataset.mode); }));
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

onAuthStateChanged(auth, async u => {
  if (!u) { location.href = 'login.html?redirect=chat.html'; return; }
  SoundManager.init();
  currentUser = u;
  const openUid = new URLSearchParams(location.search).get('uid');
  if (openUid && openUid !== u.uid) { location.replace(`private-chat.html?uid=${encodeURIComponent(openUid)}`); return; }
  await loadUsers();
  setChatMode('private');
});
