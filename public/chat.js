import { auth, db } from './firebase-init.js';
import { trioCache } from './trio-cache.js';
import { SoundManager } from './sound-manager.js';
import { escapeHtml as esc, avatarHtml, nameOf, timeOf, chatId } from './utils.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, getDocs, query, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
let currentUser = null;
let users = [];
const conversations = new Map();
const params = new URLSearchParams(location.search);
const challengeId = params.get('challenge');
const challengeContext = {
  trip:'You get one free trip tomorrow. Where are you going?',
  hour:'You have one free hour tonight. What sounds better?',
  weekend:'You have one weekend to make something. What do you pick?',
  food:'Pick one forever.'
};
if(challengeId && challengeContext[challengeId]){
  const box=document.getElementById('challengeContext');
  if(box){box.hidden=false;document.getElementById('challengeContextText').textContent=challengeContext[challengeId];}
}


function previewText(m) { if (!m) return ''; if (m.replyToStoryId) return '↩️ Story reply'; if (m.sharedPostId) return '📎 Shared a story'; return String(m.text || '').replace(/\s+/g, ' ').trim().slice(0,40); }
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
  // Profile cache normally provides follower IDs; fall back to the authoritative subcollection when cold.
  const followerIds = followersSnap.length ? followersSnap : await (async()=>{
    try {
      const snap = await getDocs(collection(db, 'users', currentUser.uid, 'followers'));
      const ids = snap.docs.map(d => d.id).filter(id => id !== currentUser.uid).slice(0, 100);
      trioCache.set(`followers_ids_${currentUser.uid}`, ids, trioCache.TTL.SHORT);
      return ids;
    } catch { return []; }
  })();
  let peerIds = [...new Set([...following, ...followerIds])].slice(0,40);
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

$('userSearch')?.addEventListener('input', e => renderInbox(e.target.value));
window.addEventListener('trio-chat-unread-change', () => renderInbox($('userSearch')?.value || ''));
window.addEventListener('storage', (e)=>{ if(e.key && e.key.startsWith('trio_chat_seen_')) renderInbox($('userSearch')?.value || '') });

onAuthStateChanged(auth, async u => {
  if (!u) { location.href = 'login.html?redirect=chat.html'; return; }
  SoundManager.init();
  currentUser = u;
  const openUid = new URLSearchParams(location.search).get('uid');
  if (openUid && openUid !== u.uid) { location.replace(`private-chat.html?uid=${encodeURIComponent(openUid)}`); return; }
  await loadUsers();
  renderInbox($('userSearch')?.value || '');
});
