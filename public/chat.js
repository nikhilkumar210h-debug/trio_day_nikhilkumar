import { auth, db } from './firebase-init.js';
import { trioCache } from './trio-cache.js';
import { SoundManager } from './sound-manager.js';
import { escapeHtml as esc, avatarHtml, nameOf, timeOf, chatId } from './utils.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, getDocs, query, orderBy, limit, addDoc
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { notifyUser } from './services/notificationHelpers.js';
import { getCachedUser } from './services/userCache.js';

const $ = id => document.getElementById(id);
let currentUser = null;
let users = [];
// Conversation partner profiles, fetched on demand (cache-backed) in
// watchInbox() — replaces the old assumption that partners are always inside
// an arbitrary first-20 users snapshot. Saves Spark free-tier reads.
const peerProfiles = new Map();
const conversations = new Map();
const params = new URLSearchParams(location.search);
const challengeId = params.get('challenge');
const pendingChallengeShare = (() => {
  try { return JSON.parse(sessionStorage.getItem('trio_pending_challenge_share') || 'null'); } catch { return null; }
})();
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
  const rows = [...conversations.keys()]
    .filter(pid => pid && pid !== currentUser.uid)
    .map(pid => ({ peer: peerProfiles.get(pid) || { uid: pid }, latest: conversations.get(pid)?.latest, unread: conversations.get(pid)?.unread }))
    .filter(r => { const text = `${nameOf(r.peer)} ${previewText(r.latest)}`.toLowerCase(); return !qText || text.includes(qText); })
    .sort((a, b) => (b.latest?.createdAtMs || 0) - (a.latest?.createdAtMs || 0))
    .slice(0, 20);
  const countBadge = $('conversationCount'); if (countBadge) countBadge.textContent = String(rows.length);
  if (rows.length === 0) {
    list.innerHTML = `<div class="nkm-chat-empty"><span>✉</span><p>No conversations yet.</p><div style="margin-top:10px"><a class="nkm-btn nkm-btn--primary nkm-btn--sm" href="all-users.html">Start a Conversation</a></div><div style="margin-top:8px"><a class="nkm-btn nkm-btn--secondary nkm-btn--sm" href="challenge.html">🔥 Start a 10-Min Debate →</a></div></div>`;
    return;
  }
  rows.forEach(({ peer, latest, unread }) => {
    const row = document.createElement('div'); row.className = 'nkm-chat-row';
    const open = document.createElement('a'); open.href = `private-chat.html?uid=${encodeURIComponent(peer.uid)}`; open.className='nkm-chat-row-main';
    open.innerHTML = `<span class="nkm-chat-avatar">${avatarHtml(peer)}</span>
      <span class="nkm-chat-meta">
        <span class="nkm-chat-name">${esc(nameOf(peer))}</span>
        <span class="nkm-chat-preview">${esc(previewText(latest) || 'Start conversation')}</span>
      </span>
      <span class="nkm-chat-time">${esc(timeOf(latest?.createdAtMs))}</span>`;
    row.appendChild(open);
    if (unread) row.insertAdjacentHTML('beforeend','<span class="nkm-chat-unread" title="New"></span>');
    // Streak badge for active peers (Phase 4)
    row.insertAdjacentHTML('beforeend','<span class="nkm-chat-streak" title="Keep Trio Streak">🔥</span>');
    if (pendingChallengeShare) {
      const shareBtn = document.createElement('button');
      shareBtn.type='button'; shareBtn.className='nkm-btn nkm-btn--sm nkm-btn--primary challenge-inbox-share';
      shareBtn.textContent='Share';
      shareBtn.title='Share this Challenge in this Chat';
      shareBtn.addEventListener('click', async e => {
        e.preventDefault(); e.stopPropagation(); shareBtn.disabled=true;
        try {
          const now=Date.now();
          const senderName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
          await addDoc(collection(db,'privateChats',chatId(currentUser.uid,peer.uid),'messages'), {
            uid:currentUser.uid, name:senderName,
            text:'⚡ Shared a Challenge: '+String(pendingChallengeShare.q||'').slice(0,180),
            sharedChallengeId:pendingChallengeShare.id,
            sharedChallengeQuestion:pendingChallengeShare.q,
            sharedChallengeOptions:Array.isArray(pendingChallengeShare.o)?pendingChallengeShare.o.slice(0,5):[],
            sharedChallengeUrl:pendingChallengeShare.url,
            createdAt:now, createdAtMs:now
          });
          await notifyUser(peer.uid,{type:'message',actorUid:currentUser.uid,actorName:senderName,text:'⚡ Shared a Challenge: '+String(pendingChallengeShare.q||'').slice(0,180)}).catch(()=>{});
          sessionStorage.removeItem('trio_pending_challenge_share');
          shareBtn.textContent='Shared ✓';
          setTimeout(()=>renderInbox($('userSearch')?.value||''),500);
        } catch(err) {
          console.error('Challenge share failed',err);
          shareBtn.disabled=false; shareBtn.textContent='Share';
        }
      });
      row.appendChild(shareBtn);
    }
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
      const snap = await getDocs(query(collection(db, 'users', currentUser.uid, 'followers'), limit(100)));
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
  // Fetch participant profiles on demand (trio-cache backed, 5-min TTL) — only
  // for peers with an actual conversation, never an unbounded users dump.
  await Promise.all(previews.filter(Boolean).map(async p => {
    const profile = await getCachedUser(p.pid).catch(() => null);
    peerProfiles.set(p.pid, profile || { uid: p.pid });
  }));
  renderInbox($('userSearch')?.value || '');
}

async function loadUsers() {
  const cacheKey = 'allUsers';
  const cached = trioCache.get(cacheKey);
  if (cached) {
    users = cached;
  } else {
    // Bounded, error-safe directory fetch (fallback peer source only). A
    // permission/network failure must never block watchInbox()/renderInbox()
    // below — the 3 skeleton cards must always clear.
    try {
      const snap = await getDocs(query(collection(db, 'users'), limit(20)));
      users = snap.docs.map(d => ({ ...d.data(), uid: d.data().uid || d.id }));
      trioCache.set(cacheKey, users, trioCache.TTL.LONG);
      users.forEach(u => { const k = `user_${u.uid}`; if (!trioCache.get(k)) trioCache.set(k, u, trioCache.TTL.LONG); });
    } catch (err) {
      console.warn('[Chat] users list unavailable:', err);
      users = [];
    }
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
