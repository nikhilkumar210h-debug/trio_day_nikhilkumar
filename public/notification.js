import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, doc, onSnapshot, orderBy, query, limit, updateDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

function notificationText(notification) {
  const who = notification.actorName || 'Someone';
  return {
    like: `${who} liked your post`,
    comment: `${who} commented on your post`,
    share: `${who} shared your post`,
    connect: `${who} connected with you`
  }[notification.type] || `${who} sent you an update`;
}

function renderList(container, alerts) {
  container.innerHTML = '';
  if (!alerts.length) {
    const empty = document.createElement('p');
    empty.className = 'notification-empty';
    empty.textContent = 'No notifications yet.';
    container.appendChild(empty);
    return;
  }

  alerts.forEach((alert) => {
    const row = document.createElement(alert.postId ? 'a' : 'button');
    row.className = `notification-item${alert.read ? '' : ' unread'}`;
    row.dataset.notificationId = alert.id;
    if (alert.postId) row.href = `view_post.html?postId=${encodeURIComponent(alert.postId)}`;
    else row.type = 'button';

    const title = document.createElement('strong');
    title.textContent = notificationText(alert);

    const time = document.createElement('small');
    time.textContent = new Date(alert.createdAtMs || Date.now()).toLocaleString();

    row.append(title, time);
    row.addEventListener('click', () => {
      if (!alert.read) updateDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', alert.id), { read: true }).catch(() => {});
    });
    container.appendChild(row);
  });
}

const listEl = document.getElementById('notificationList');
const overlay = document.getElementById('notificationOverlay');
const closeBtn = document.querySelector('.notification-close');

closeBtn?.addEventListener('click', () => {
  window.location.href = 'index.html';
});

overlay?.addEventListener('click', (event) => {
  if (event.target === overlay) {
    window.location.href = 'index.html';
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'login.html?redirect=notification.html';
    return;
  }

  onSnapshot(query(collection(db, 'users', user.uid, 'notifications'), orderBy('createdAtMs', 'desc'), limit(30)), (snap) => {
    const alerts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderList(listEl, alerts);
  }, () => {
    renderList(listEl, []);
  });
});
