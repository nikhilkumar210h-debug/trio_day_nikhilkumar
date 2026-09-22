import { auth, db } from './firebase-init.js';
import { escapeHtml as esc } from './utils.js';
import { notificationText } from './services/notificationHelpers.js';
import { trioCache } from './trio-cache.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, query, orderBy, limit, onSnapshot,
  updateDoc, doc, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
let me = null;
let allNotifications = [];

function renderNotificationRows(container, alerts) {
  container.innerHTML = '';
  if (!alerts.length) { container.innerHTML = '<div class="notifications-empty-row">No notifications</div>'; return; }
  alerts.forEach(alert => {
    const row = document.createElement('div');
    row.className = `notification-row${alert.read ? '' : ' unread'}`;
    row.dataset.notificationId = alert.id;
    row.style.cssText = 'display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,.02);border:1px solid transparent;transition:background .15s,border-color .15s';
    if (!alert.read) { row.style.background = 'rgba(139,92,246,.09)'; row.style.borderColor = 'rgba(139,92,246,.18)'; }
    const avatarHtml = alert.actorPhotoURL
      ? `<img src="${esc(alert.actorPhotoURL)}" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover">`
      : `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#8B5CF6,#6366F1);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff">${esc((alert.actorName || 'U').charAt(0))}</div>`;
    row.innerHTML = `
      <div style="flex-shrink:0">${avatarHtml}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:14px;color:var(--ink)">${esc(notificationText(alert))}</div>
        <div style="font-size:12px;color:var(--ink-muted);margin-top:4px">${new Date(alert.createdAtMs || Date.now()).toLocaleString()}</div>
      </div>
      ${!alert.read ? '<div style="width:8px;height:8px;border-radius:50%;background:#8B5CF6;flex-shrink:0;margin-top:4px"></div>' : ''}
    `;
    row.addEventListener('click', async () => {
      if (!alert.read) {
        try { await updateDoc(doc(db, 'users', me.uid, 'notifications', alert.id), { read: true }); } catch (e) { console.error(e); }
      }
      if (alert.urlPath) location.href = alert.urlPath; else if (alert.postId) location.href = 'index.html';
    });
    container.appendChild(row);
  });
}

function filterAndRender() {
  const activeTab = document.querySelector('.notification-tab[aria-selected="true"]')?.dataset.tab || 'all';
  let filtered = allNotifications;
  if (activeTab === 'unread') filtered = allNotifications.filter(a => !a.read);
  else if (activeTab === 'mentions') filtered = allNotifications.filter(a => a.type === 'mention');
  const list = $('notificationsList');
  const empty = $('notificationsEmpty');
  if (!filtered.length) { list.innerHTML = ''; empty.hidden = false; }
  else { empty.hidden = true; renderNotificationRows(list, filtered); }
}

async function markAllRead() {
  if (!me) return;
  const unread = allNotifications.filter(a => !a.read);
  if (!unread.length) return;
  try {
    const batch = writeBatch(db);
    unread.forEach(a => batch.update(doc(db, 'users', me.uid, 'notifications', a.id), { read: true }));
    await batch.commit();
    const { showToast } = await import('./ui/toast.js');
    showToast('Sab notifications read mark kar diye');
  } catch (err) {
    console.error(err);
    const { showToast } = await import('./ui/toast.js');
    showToast('Failed to mark all read', 'error');
  }
}

onAuthStateChanged(auth, async u => {
  if (!u) { location.href = 'login.html?redirect=notifications.html'; return; }
  me = u;
  const list = $('notificationsList');
  const empty = $('notificationsEmpty');
  list.innerHTML = '<div class="notifications-loading">Loading…</div>';
  
  const unsubscribe = onSnapshot(
    query(collection(db, 'users', me.uid, 'notifications'), orderBy('createdAtMs', 'desc'), limit(50)),
    snap => {
      allNotifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      filterAndRender();
    },
    err => { console.error(err); list.innerHTML = '<div class="notifications-error">Failed to load</div>'; }
  );
  
  document.querySelectorAll('.notification-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.notification-tab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active'); btn.setAttribute('aria-selected', 'true');
      filterAndRender();
    });
  });
  
  const markBtn = $('markAllReadBtn');
  if (markBtn) markBtn.addEventListener('click', markAllRead);
});