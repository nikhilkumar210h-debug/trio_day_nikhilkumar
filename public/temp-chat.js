import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, doc, getDoc, setDoc, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, deleteDoc, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { showToast } from './ui/toast.js';
import { createSheet } from './ui/sheet.js';
import { esc } from './utils.js';

const params = new URLSearchParams(location.search);
const challenge = params.get('challenge');
const other = params.get('other');
let me = null, roomId = '', unsub = null, expiresAt = 0;
const $ = id => document.getElementById(id);

function roomKey(a, b, c) { return [a, b].sort().join('_') + '_' + c; }

function tick() {
  const left = Math.max(0, expiresAt - Date.now());
  $('timer').textContent = Math.floor(left / 60000).toString().padStart(2, '0') + ':' + Math.floor((left % 60000) / 1000).toString().padStart(2, '0');
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
  if (!me || !challenge || !other || other === me.uid) {
    console.warn('[temp-chat] Missing params:', { me: !!me, challenge, other, same: other === me?.uid });
    return location.href = 'challenge.html';
  }
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