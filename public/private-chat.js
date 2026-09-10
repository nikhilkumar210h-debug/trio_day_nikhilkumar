import { auth, db } from './firebase-init.js';
import { notifyUser } from './services/notificationHelpers.js';
import { SoundManager } from './sound-manager.js';
import { escapeHtml as esc, avatarHtml, nameOf, timeOf, chatId } from './utils.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  getDoc, doc, getDocs, where, deleteDoc, writeBatch, limit
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
let currentUser = null;
let activePeer = null;
let privateUnsub = null;
const params = new URLSearchParams(location.search);
const peerUid = params.get('uid');

import { createSheet } from './ui/sheet.js';

function messageHtml(m) {
  const text = m?.text ?? m?.message ?? '';
  if (m?.replyToStoryId) {
    const storyUrl = `view_post.html?postId=${encodeURIComponent(m.replyToStoryId)}`;
    const preview = m.storyPreview ? `<img src="${esc(m.storyPreview)}" alt="Story preview" style="width:100%;border-radius:10px;margin:6px 0;max-height:180px;object-fit:cover;display:block;border:1px solid var(--color-border)">` : '';
    const orig = m.originalStoryText ? `<span class="shared-post-label" style="opacity:.8">Original: ${esc(String(m.originalStoryText).slice(0,60))}</span>` : '';
    return `${orig}${preview}<span class="msg-text-content">${esc(text)}</span><a class="shared-post-link" href="${storyUrl}">View story →</a>`;
  }
  if (!m?.sharedPostId) return `<span class="msg-text-content">${esc(text)}</span>`;
  const postUrl = `view_post.html?postId=${encodeURIComponent(m.sharedPostId)}`;
  // Show text even for shared posts (was hiding message)
  return `<span class="msg-text-content">${esc(text)}</span><span class="shared-post-label">📎 Shared a post</span><a class="shared-post-link" href="${postUrl}">Open post →</a>`;
}

async function findUser(uid) {
  const { getCachedUser } = await import('./services/userCache.js');
  const cached = await getCachedUser(uid);
  if (cached) return { ...cached, uid: cached.uid || uid };
  const direct = await getDoc(doc(db, 'users', uid));
  if (direct.exists()) return { ...direct.data(), uid: direct.data().uid || direct.id };
  const q = query(collection(db, 'users'), where('uid', '==', uid));
  const snap = await getDocs(q);
  if (!snap.empty) { const d = snap.docs[0]; return { ...d.data(), uid: d.data().uid || d.id }; }
  return null;
}

function setPeerHeader() {
  const profileUrl = `profile.html?uid=${encodeURIComponent(activePeer.uid)}`;
  $('peerProfile').href = profileUrl;
  $('peerProfileIcon').href = profileUrl;
  $('peerName').textContent = nameOf(activePeer);
  $('peerId').textContent = activePeer.userId || activePeer.uid;
  $('peerAvatar').innerHTML = avatarHtml(activePeer);
}

async function deletePrivateMessage(msgDocId) {
  if (!currentUser || !activePeer) return;
  const confirmed = window.confirm('Yeh message delete karna chahte ho? Dono sides se hata diya jayega.');
  if (!confirmed) return;
  try {
    SoundManager.delete();
    const ref = doc(db, 'privateChats', chatId(currentUser.uid, activePeer.uid), 'messages', msgDocId);
    await deleteDoc(ref);
  } catch (err) {
    console.error('Delete failed:', err);
    alert('Message delete nahi hua: ' + (err?.message || err));
  }
}

async function markMessagesAsSeen() {
  if (!currentUser || !activePeer) return;
  try {
    const chatIdStr = chatId(currentUser.uid, activePeer.uid);
    const q = query(collection(db, 'privateChats', chatIdStr, 'messages'), where('uid', '==', activePeer.uid));
    const snap = await getDocs(q);
    if (snap.empty) return;
    let batch = writeBatch(db);
    let ops = 0;
    for (const d of snap.docs) {
      if (!d.data().seen) { batch.update(d.ref, { seen: Date.now() }); ops++; }
      if (ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0; }
    }
    if (ops > 0) await batch.commit();
  } catch (err) { console.error('Mark seen failed:', err); }
}

let seenDebounce;
function debouncedMarkAsSeen() {
  clearTimeout(seenDebounce);
  seenDebounce = setTimeout(markMessagesAsSeen, 1000);
}

function openMsgMenu(msgDocId, isMine) {
  const { open, close } = createSheet({ title: isMine ? 'Message' : 'Message', content: `
    <div style="display:grid;gap:8px">
      <button class="nkm-btn" type="button" data-copy>Copy text</button>
      ${isMine ? '<button class="nkm-btn" type="button" data-del style="color:#ef4444;border-color:rgba(239,68,68,.2)">Delete</button>' : ''}
    </div>
  `});
  open();
  const copyBtn = document.querySelector('[data-copy]');
  const delBtn = document.querySelector('[data-del]');
  // copy handled via delegation to row's data
  if (copyBtn) copyBtn.addEventListener('click', async ()=>{
    const txt = document.querySelector(`[data-msg-id="${msgDocId}"] .msg-text-content`)?.textContent || '';
    try{ await navigator.clipboard.writeText(txt); copyBtn.textContent='Copied!'; setTimeout(close,700);}catch{ prompt('Copy', txt); }
  });
  if (delBtn) delBtn.addEventListener('click', ()=>{ close(); deletePrivateMessage(msgDocId); });
}

function renderMessages(snap) {
  const box = $('privateMessages');
  box.innerHTML = '';
  let lastMs = 0;
  if(snap.empty){
    box.innerHTML='<div class="nkm-chat-empty"><p>No messages yet.</p><p>Say hi to start the conversation.</p></div>';
    return;
  }

  let prevUid = null;
  snap.forEach(d => {
    const m = d.data();
    const msgDocId = d.id;
    lastMs = Math.max(lastMs, Number(m.createdAtMs || m.createdAt) || 0);
    const mine = m.uid === currentUser.uid;
    const isGrouped = prevUid === m.uid;
    const row = document.createElement('div');
    row.className = `private-msg-row ${mine ? 'mine' : 'theirs'} ${isGrouped ? 'grouped' : 'group-break'}`;
    row.dataset.msgId = msgDocId;

    row.innerHTML = `
      ${!mine && !isGrouped ? `<a class="message-avatar" href="profile.html?uid=${encodeURIComponent(m.uid || activePeer.uid)}">${avatarHtml(activePeer)}</a>` : (!mine && isGrouped ? '<span style="width:28px;flex:none"></span>' : '')}
      <div class="message-stack">
        ${!mine && !isGrouped ? `<a class="message-author" href="profile.html?uid=${encodeURIComponent(m.uid || activePeer.uid)}">${esc(m.name || nameOf(activePeer))}</a>` : ''}
        <div class="message-bubble" data-bubble>
          ${messageHtml(m)}
          <div class="message-time">${esc(timeOf(m.createdAtMs || m.createdAt))} ${mine && m.seen ? '<span class="msg-seen" title="Seen">✓ seen</span>' : ''}</div>
        </div>
      </div>
      <button class="nkm-msg-menu" type="button" aria-label="More" data-menu>⋯</button>`;

    box.appendChild(row);
    const menuBtn = row.querySelector('[data-menu]');
    if(menuBtn) menuBtn.addEventListener('click', (e)=>{ e.stopPropagation(); openMsgMenu(msgDocId, mine); });
    const bubble = row.querySelector('[data-bubble]');
    if(bubble){
      let pressTimer = null;
      const open = ()=> openMsgMenu(msgDocId, mine);
      bubble.addEventListener('click', (e)=>{
        // mobile tap or desktop selection: open sheet when not hovering delete button
        if (window.matchMedia('(hover:none)').matches || window.innerWidth <= 839) open();
      });
      bubble.addEventListener('contextmenu', (e)=>{ e.preventDefault(); open(); });
      bubble.addEventListener('touchstart', ()=>{ pressTimer = setTimeout(open, 480); }, {passive:true});
      bubble.addEventListener('touchend', ()=>{ clearTimeout(pressTimer); });
      bubble.addEventListener('touchmove', ()=>{ clearTimeout(pressTimer); });
    }
    prevUid = m.uid;
  });

  if (currentUser && activePeer) {
    const mark = window.TrioChatUnread?.markChatSeen;
    if (mark) mark(currentUser.uid, activePeer.uid, lastMs || Date.now());
    else {
      try {
        const key = `trio_chat_seen_${currentUser.uid}`;
        const map = JSON.parse(localStorage.getItem(key) || '{}');
        map[activePeer.uid] = Math.max(Number(map[activePeer.uid]) || 0, lastMs || Date.now());
        localStorage.setItem(key, JSON.stringify(map));
        window.dispatchEvent(new CustomEvent('trio-chat-unread-change', { detail: { peerId: activePeer.uid } }));
      } catch { }
    }
    debouncedMarkAsSeen();
  }

  requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
}

function watchMessages() {
  privateUnsub?.();
  const q = query(
    collection(db, 'privateChats', chatId(currentUser.uid, activePeer.uid), 'messages'),
    orderBy('createdAtMs', 'asc'),
    limit(50)
  );
  privateUnsub = onSnapshot(q, renderMessages, err => console.error('Private chat listener:', err));
}

$('privateForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!activePeer || !currentUser) return;
  const input = $('privateInput');
  const sendBtn = $('privateForm')?.querySelector('button[type="submit"]');
  const text = input.value.trim();
  if (!text) return;
  if (sendBtn) sendBtn.disabled = true;
  try {
    const meSnap = await getDoc(doc(db, 'users', currentUser.uid)).catch(() => null);
    const me = meSnap?.exists() ? meSnap.data() : {};
    const now = Date.now();
    const senderName = me.name || currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
    await addDoc(collection(db, 'privateChats', chatId(currentUser.uid, activePeer.uid), 'messages'), {
      uid: currentUser.uid,
      name: senderName,
      userId: me.userId || currentUser.uid,
      text,
      createdAt: now,
      createdAtMs: now
    });
    await notifyUser(activePeer.uid, {
      type: 'message',
      actorUid: currentUser.uid,
      actorName: senderName,
      text
    }).catch(err => console.warn('Message notification failed', err));
    SoundManager.send();
    input.value = '';
    input.focus();
  } catch (err) {
    console.error(err);
    alert(err?.message || 'Private message send nahi hua.');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
});

onAuthStateChanged(auth, async u => {
  if (!u) {
    const back = `private-chat.html?uid=${encodeURIComponent(peerUid || '')}`;
    location.href = `login.html?redirect=${encodeURIComponent(back)}`;
    return;
  }
  if (!peerUid || peerUid === u.uid) { location.href = 'chat.html'; return; }
  SoundManager.init();
  currentUser = u;
  activePeer = await findUser(peerUid);
  if (!activePeer) { alert('User nahi mila.'); location.href = 'chat.html'; return; }
  setPeerHeader();
  watchMessages();
});
