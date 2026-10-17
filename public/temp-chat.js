import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, doc, getDoc, setDoc, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, deleteDoc, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { showToast } from './ui/toast.js';
import { createSheet } from './ui/sheet.js';
import { esc } from './utils.js';
import { SoundFX } from './ui/sound.js';
import { awardXp } from './gamification/xp-levels.js';

const params = new URLSearchParams(location.search);
const challenge = params.get('challenge');
const other = params.get('other');
const isUndercover = params.get('undercover') === '1';
const myChoice = Number(params.get('myChoice') || -1);
const challengeQ = params.get('q') || 'The challenge';
let undercoverReplies = 0;
let undercoverAiInterval = null;
const $ = id => document.getElementById(id);

// Keep Trio Streak state
let streakSavedBy = new Set(); // uids who clicked keep-streak
let streakIsMine = false;

function roomKey(a, b, c) { return [a, b].sort().join('_') + '_' + c; }

function tick() {
  const left = Math.max(0, expiresAt - Date.now());
  $('timer').textContent = Math.floor(left / 60000).toString().padStart(2, '0') + ':' + Math.floor((left % 60000) / 1000).toString().padStart(2, '0');
  // Streak bar progress (10 min = 600000ms)
  const fill = $('streakFill');
  if (fill) {
    const pct = expiresAt ? Math.max(0, Math.min(100, Math.round((left / 600000) * 100))) : 0;
    fill.style.width = pct + '%';
    fill.classList.remove('warn', 'crit');
    if (pct <= 10) fill.classList.add('crit');
    else if (pct <= 25) fill.classList.add('warn');
  }
  if (left <= 0) {
    $('input').disabled = true;
    $('send').disabled = true;
    $('timer').textContent = 'Expired';
    if (unsub) unsub();
  }
}

// ─── Multi-Select State ─────────────────────────────────────────────────────
let selectionMode = false;
const selectedIds = new Set();
const bulkBar = document.createElement('div');
bulkBar.id = 'bulkActionBar';
bulkBar.className = 'bulk-action-bar';
bulkBar.hidden = true;
bulkBar.innerHTML = `
  <span class="bulk-count" aria-live="polite">0 selected</span>
  <button type="button" class="bulk-btn bulk-select-all" data-action="select-all">Select All Mine</button>
  <button type="button" class="bulk-btn bulk-cancel" data-action="cancel">Cancel</button>
  <button type="button" class="bulk-btn bulk-delete danger" data-action="delete" disabled>Delete (0)</button>
`;
document.body.appendChild(bulkBar);

function updateBulkBar() {
  const count = selectedIds.size;
  bulkBar.querySelector('.bulk-count').textContent = `${count} selected`;
  const delBtn = bulkBar.querySelector('[data-action="delete"]');
  delBtn.textContent = `Delete (${count})`;
  delBtn.disabled = count === 0;
  bulkBar.querySelector('[data-action="select-all"]').textContent = count === getOwnMessageCount() ? 'Deselect All' : 'Select All Mine';
}

function getOwnMessageCount() {
  const rows = document.querySelectorAll('.temp-message.mine:not(.is-deleting)');
  return rows.length;
}

function enterSelectionMode(initialMsgId = null) {
  if (selectionMode) return;
  selectionMode = true;
  if (initialMsgId) selectedIds.add(initialMsgId);
  document.body.classList.add('selection-mode');
  bulkBar.hidden = false;
  requestAnimationFrame(() => bulkBar.classList.add('open'));
  updateBulkBar();
  syncSelectionUI();
}

function exitSelectionMode() {
  if (!selectionMode) return;
  selectionMode = false;
  selectedIds.clear();
  document.body.classList.remove('selection-mode');
  bulkBar.classList.remove('open');
  setTimeout(() => { bulkBar.hidden = true; }, 220);
  syncSelectionUI();
}

function toggleSelection(msgDocId) {
  if (selectedIds.has(msgDocId)) selectedIds.delete(msgDocId);
  else selectedIds.add(msgDocId);
  updateBulkBar();
  syncSelectionUI();
}

function selectAllMine() {
  const ownRows = document.querySelectorAll('.temp-message.mine:not(.is-deleting)');
  if (selectedIds.size === ownRows.length) {
    selectedIds.clear();
  } else {
    ownRows.forEach(r => selectedIds.add(r.dataset.msgId));
  }
  updateBulkBar();
  syncSelectionUI();
}

function syncSelectionUI() {
  document.querySelectorAll('.temp-message').forEach(row => {
    const msgId = row.dataset.msgId;
    const isSelected = selectedIds.has(msgId);
    row.classList.toggle('selected', isSelected);
    row.setAttribute('aria-selected', isSelected);
    row.classList.toggle('selectable', selectionMode && row.classList.contains('mine'));
  });
  const selectAllBtn = bulkBar.querySelector('[data-action="select-all"]');
  if (selectAllBtn) selectAllBtn.textContent = selectedIds.size === getOwnMessageCount() ? 'Deselect All' : 'Select All Mine';
}

async function deleteSelectedMessages() {
  if (!me || selectedIds.size === 0 || !roomId) return;
  const delBtn = bulkBar.querySelector('[data-action="delete"]');
  const originalText = delBtn.textContent;
  delBtn.disabled = true;
  delBtn.textContent = 'Deleting…';

  const idsToDelete = Array.from(selectedIds);

  // Optimistic: mark rows as deleting
  idsToDelete.forEach(id => {
    const row = document.querySelector(`.temp-message[data-msg-id="${id}"]`);
    if (row) row.classList.add('is-deleting');
  });

  try {
    const BATCH_LIMIT = 450;
    for (let i = 0; i < idsToDelete.length; i += BATCH_LIMIT) {
      const chunk = idsToDelete.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const msgDocId of chunk) {
        const ref = doc(db, 'tempChats', roomId, 'tempMessages', msgDocId);
        batch.delete(ref);
      }
      await batch.commit();
    }
    showToast(`Deleted ${idsToDelete.length} message${idsToDelete.length > 1 ? 's' : ''}`);
    exitSelectionMode();
  } catch (err) {
    console.error('Batch delete failed:', err);
    showToast('Delete failed: ' + (err?.message || err), 'error');
    // Rollback optimistic state
    idsToDelete.forEach(id => {
      const row = document.querySelector(`.temp-message[data-msg-id="${id}"]`);
      if (row) row.classList.remove('is-deleting');
    });
    delBtn.disabled = false;
    delBtn.textContent = originalText;
    updateBulkBar();
  }
}

// ─── Bulk Bar Event Delegation ──────────────────────────────────────────────
bulkBar.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'cancel') exitSelectionMode();
  else if (action === 'select-all') selectAllMine();
  else if (action === 'delete') deleteSelectedMessages();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && selectionMode) exitSelectionMode();
});

function openMsgMenu(msgDocId, isMine) {
  const { open, close } = createSheet({ title: isMine ? 'Message' : 'Message', content: `
    <div style="display:grid;gap:8px">
      <button class="nkm-btn" type="button" data-copy>Copy text</button>
      ${isMine ? '<button class="nkm-btn" type="button" data-del style="color:#ef4444;border-color:rgba(239,68,68,.2)">Delete</button>' : ''}
      ${isMine ? '<button class="nkm-btn" type="button" data-select>Select Messages</button>' : ''}
    </div>
  `});
  open();
  const copyBtn = document.querySelector('[data-copy]');
  const delBtn = document.querySelector('[data-del]');
  const selectBtn = document.querySelector('[data-select]');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const txt = document.querySelector(`[data-msg-id="${msgDocId}"] p`)?.textContent || '';
    try { await navigator.clipboard.writeText(txt); copyBtn.textContent = 'Copied!'; setTimeout(close, 700); } catch { prompt('Copy', txt); }
  });
  if (delBtn) delBtn.addEventListener('click', () => { close(); deleteSingleMessage(msgDocId); });
  if (selectBtn) selectBtn.addEventListener('click', () => { close(); enterSelectionMode(msgDocId); });
}

async function deleteSingleMessage(msgDocId) {
  if (!me || !roomId) return;
  const confirmed = window.confirm('Delete this message? It will be removed for both participants.');
  if (!confirmed) return;
  try {
    const ref = doc(db, 'tempChats', roomId, 'tempMessages', msgDocId);
    await deleteDoc(ref);
    showToast('Message deleted');
  } catch (err) {
    console.error('Delete failed:', err);
    showToast('Delete failed: ' + (err?.message || err), 'error');
  }
}

async function start() {
  if (!me || !challenge) {
    console.warn('[temp-chat] Missing params:', { me: !!me, challenge });
    return location.href = 'challenge.html';
  }

  // Phase 3: Undercover Challenger Mode — no live human, AI defends opposite side
  if (isUndercover) {
    startUndercoverMode();
    return;
  }

  if (!other || other === me.uid) {
  roomId = roomKey(me.uid, other, challenge);
  console.log('[temp-chat] roomId:', roomId);
  const ref = doc(db, 'tempChats', roomId);
  const snap = await getDoc(ref);
  console.log('[temp-chat] getDoc result:', snap.exists());
  const existing = snap.exists() ? snap.data() : null;
  const existingExpiry = Number(existing?.expiresAtMs) || 0;
  if (existing && existingExpiry > Date.now()) {
    expiresAt = existingExpiry;
    console.log('[temp-chat] Using existing room, expiresAt:', expiresAt);
  } else {
    expiresAt = Date.now() + 600000;
    console.log('[temp-chat] Creating new room, expiresAt:', expiresAt);
    await setDoc(ref, { participants: [me.uid, other], challengeId: challenge, createdAt: serverTimestamp(), createdAtMs: Date.now(), expireAt: new Date(expiresAt), expiresAtMs: expiresAt });
    console.log('[temp-chat] Room created');
  }
  setInterval(tick, 1000); tick();

  // Header "Select" button
  const selectBtn = $('selectMessagesBtn');
  if (selectBtn) {
    selectBtn.onclick = () => enterSelectionMode();
  }

  // Keep Trio Streak button
  const keepBtn = $('keepStreakBtn');
  const streakStorageKey = 'trio_streak_saved_' + challenge;
  if (keepBtn) {
    // Restore saved state from session
    try {
      if (localStorage.getItem(streakStorageKey) === '1') {
        keepBtn.classList.add('saved');
        keepBtn.textContent = '✅ Streak Saved';
        streakSavedBy.add(me.uid);
      }
    } catch { /* localStorage unavailable */ }
    keepBtn.onclick = async () => {
      if (!roomId) return;
      keepBtn.disabled = true;
      try {
        // Mark saved locally (session)
        try { localStorage.setItem(streakStorageKey, '1'); } catch { }
        streakSavedBy.add(me.uid);
        keepBtn.classList.add('saved');
        keepBtn.textContent = '✅ Streak Saved';
        SoundFX.win();
        showToast('Streak saved!');

        // Award XP for keeping the streak
        await awardXp(me.uid, 25, { challengeId: challenge, reason: 'keep_streak' });

        // Open/create private 1:1 chat with the other participant
        if (other) {
          const chatId = [me.uid, other].sort().join('_');
          const pcRef = doc(db, 'privateChats', chatId);
          await setDoc(pcRef, {
            participants: [me.uid, other],
            challengeId: challenge,
            createdAt: serverTimestamp(),
            createdAtMs: Date.now()
          }, { merge: true });
          showToast('🔥 Streak kept! Private chat unlocked.', 'success');
          setTimeout(() => { location.href = 'private-chat.html?uid=' + encodeURIComponent(other); }, 1200);
        }
      } catch (err) {
        console.error('Keep streak failed:', err);
        showToast('Could not save streak.', 'error');
      } finally {
        keepBtn.disabled = false;
      }
    };
  }

  const q = query(collection(db, 'tempChats', roomId, 'tempMessages'), orderBy('createdAtMs', 'asc'));
  unsub = onSnapshot(q, s => {
    const rows = s.docs.map(d => ({ id: d.id, ...d.data() }));
    const messagesEl = $('messages');
    messagesEl.innerHTML = rows.length ? rows.map(m => `
      <div class="temp-message ${m.uid === me.uid ? 'mine' : ''}" data-msg-id="${m.id}"
           ${selectionMode && selectedIds.has(m.id) ? 'aria-selected="true" class="selected"' : ''}
           ${selectionMode && m.uid === me.uid ? 'class="selectable"' : ''}>
        <strong>${esc(m.name || 'User')}</strong>
        <p>${esc(m.text || '')}</p>
        ${m.uid === me.uid ? '<span class="msg-select-indicator" aria-hidden="true">✓</span>' : ''}
      </div>`).join('') : '<div class="temp-empty">You have the room to yourself for now.</div>';

    // Attach interaction handlers after render
    attachMessageHandlers(messagesEl);

    // Preserve scroll position if not at bottom, otherwise scroll to bottom
    const wasAtBottom = messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - 50;
    if (wasAtBottom) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }, () => { $('messages').innerHTML = '<div class="temp-empty">This temporary room is unavailable.</div>'; });
  }
}

// ── Phase 3: Undercover Challenger Mode ─────────────────────────────────────
// Instant 10-minute debate against an AI challenger defending the opposite choice.
// After 5 user replies, the user guesses "Real Human or Undercover AI?" for bonus XP.
function startUndercoverMode() {
  // UI: mark as undercover mode
  const timerEl = $('timer');
  if (timerEl) timerEl.textContent = '🤖 Undercover';
  const messagesEl = $('messages');
  if (messagesEl) messagesEl.innerHTML = '';

  // Create a record-keeping room (user messages are stored; AI messages are local only)
  roomId = roomKey(me.uid, 'undercover_ai', challenge);
  const ref = doc(db, 'tempChats', roomId);
  setDoc(ref, {
    participants: [me.uid, 'undercover_ai'],
    challengeId: challenge,
    isUndercover: true,
    myChoice,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
    expireAt: new Date(Date.now() + 600000),
    expiresAtMs: Date.now() + 600000
  }).catch(() => {});

  expiresAt = Date.now() + 600000;
  setInterval(tick, 1000); tick();

  // AI intro
  setTimeout(() => addAiMessage("Hey! I took the opposite side. Ready to debate? 💬"), 800);

  // AI periodic messages (every 18–25 seconds)
  const aiMsgs = [
    "Don't you think you're missing the bigger picture?",
    "I'm pretty confident in my take. What about you?",
    "Let's be real — my answer makes more sense here.",
    "You still sticking with your choice?",
    "This is where it gets interesting...",
    "Hmm, I'm not so sure about that one."
  ];
  undercoverAiInterval = setInterval(() => {
    addAiMessage(aiMsgs[Math.floor(Math.random() * aiMsgs.length)]);
  }, 20000);

  const input = $('input');
  const sendBtn = $('send');

  if (sendBtn) {
    sendBtn.onclick = async () => {
      const text = input.value.trim();
      if (!text || Date.now() >= expiresAt) return;
      SoundFX.voteClick();
      sendBtn.disabled = true;
      try {
        // Store user message in Firestore (record-keeping only)
        await addDoc(collection(db, 'tempChats', roomId, 'tempMessages'), {
          uid: me.uid,
          name: me.displayName || 'Trio member',
          text,
          createdAt: serverTimestamp(),
          createdAtMs: Date.now(),
          expireAt: new Date(expiresAt)
        });
        input.value = '';
        undercoverReplies++;

        // AI responds after a short delay
        setTimeout(() => {
          const aiReplies = [
            "Hmm, interesting point, but I still think I'm right.",
            "You make a good case, but here's why I disagree...",
            "Fair enough. But what about this angle?",
            "I see where you're coming from, yet my choice holds up.",
            "OK, but have you considered...?"
          ];
          addAiMessage(aiReplies[Math.floor(Math.random() * aiReplies.length)]);
        }, 1500);

        // After 5 user replies, show the "Real Human or Undercover AI?" guess
        if (undercoverReplies >= 5 && undercoverAiInterval) {
          clearInterval(undercoverAiInterval);
          undercoverAiInterval = null;
          setTimeout(() => showUndercoverGuessDialog(), 2000);
        }
      } catch (err) {
        console.error('Undercover message failed:', err);
      } finally {
        sendBtn.disabled = false;
      }
    };
  }

  if (input) {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendBtn.click(); } });
  }
}

function addAiMessage(text) {
  const messagesEl = $('messages');
  if (!messagesEl) return;
  const row = document.createElement('div');
  row.className = 'temp-message';
  row.innerHTML = '<strong>🤖 Undercover AI</strong><p>' + esc(text) + '</p>';
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  SoundFX.undercoverReveal();
}

function showUndercoverGuessDialog() {
  const { open, close } = createSheet({
    title: 'Real Human or Undercover AI?',
    content: `
      <div style="display:flex;flex-direction:column;gap:12px;text-align:center">
        <p style="font-size:14px;color:var(--color-ink)">You've exchanged 5 messages. Was your chat partner a real human or an undercover AI?</p>
        <div style="display:flex;gap:8px;justify-content:center">
          <button type="button" class="nkm-btn nkm-btn--primary" data-guess="human">👤 Real Human</button>
          <button type="button" class="nkm-btn nkm-btn--secondary" data-guess="ai">🤖 Undercover AI</button>
        </div>
        <p style="font-size:11px;color:var(--color-ink-muted)">Correct guess = bonus XP!</p>
      </div>
    `,
    actions: ''
  });
  close();
  const sheet = document.querySelector('.nkm-sheet');
  sheet.querySelectorAll('[data-guess]').forEach(btn => {
    btn.addEventListener('click', () => {
      const guess = btn.dataset.guess;
      const correct = 'ai'; // It's always AI in undercover mode
      const won = guess === correct;
      close();
      SoundFX[won ? 'win' : 'locked']();
      // Award bonus XP for correct guess
      if (won && me) {
        import('./gamification/xp-levels.js').then(mod => {
          return mod.awardXp(me.uid, 25, { challengeId: challenge, reason: 'undercover_guess' });
        }).then(res => {
          if (res) showToast('Correct! +25 XP 🎯', 'success');
        }).catch(() => showToast('Nice try! It was an AI.'));
      } else {
        showToast('It was an Undercover AI. Better luck next time!');
      }
    });
  });
}

function attachMessageHandlers(container) {
  container.querySelectorAll('.temp-message').forEach(row => {
    const msgId = row.dataset.msgId;
    const isMine = row.classList.contains('mine');

    // Long-press for mobile selection mode entry
    let pressTimer = null;
    row.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => { enterSelectionMode(msgId); }, 420);
    }, { passive: true });
    row.addEventListener('touchend', () => { clearTimeout(pressTimer); });
    row.addEventListener('touchmove', () => { clearTimeout(pressTimer); });

    // Click handling: Shift+Click enters selection, regular click opens menu (or toggles in selection mode)
    row.addEventListener('click', (e) => {
      if (e.shiftKey && isMine) {
        e.preventDefault();
        e.stopPropagation();
        enterSelectionMode(msgId);
        return;
      }
      if (selectionMode) {
        if (isMine && !e.target.closest('[data-menu]')) {
          toggleSelection(msgId);
        } else if (!isMine) {
          showToast('You can only select and delete your own messages', 'warn');
        }
        return;
      }
      // Not in selection mode - open action sheet
      openMsgMenu(msgId, isMine);
    });

    // Context menu (right-click) opens action sheet
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openMsgMenu(msgId, isMine);
    });
  });
}

$('send').onclick = async () => {
  const text = $('input').value.trim();
  if (!text || Date.now() >= expiresAt) return;
  $('send').disabled = true;
  try {
    await addDoc(collection(db, 'tempChats', roomId, 'tempMessages'), {
      uid: me.uid,
      name: me.displayName || 'Trio member',
      text,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
      expireAt: new Date(expiresAt)
    });
    $('input').value = '';
  } finally {
    $('send').disabled = false;
  }
};

$('input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('send').click(); } });

onAuthStateChanged(auth, u => {
  if (!u) return location.href = 'login.html?redirect=' + encodeURIComponent(location.pathname + location.search);
  me = u;
  start().catch(err => { console.error('[temp-chat] start() failed:', err); alert('Failed to start chat: ' + err.message); location.href = 'challenge.html'; });
});