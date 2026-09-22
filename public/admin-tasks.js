import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { ensureBadgeCatalog } from './gamification/badges.js';
import {
  listCommunityTasks, expireOldTasks, archiveTask,
  setChallengeFeatured, setChallengeHidden, removeChallenge
} from './gamification/community-tasks.js';
import { trioCache } from './trio-cache.js';
import { escapeHtml as esc } from './utils.js';
import { showToast } from './ui/toast.js';

const $ = id => document.getElementById(id);



async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await getDoc(doc(db, 'config', 'admins')).catch(() => null);
  return !!(snap?.exists() && Array.isArray(snap.data()?.uids) && snap.data().uids.includes(uid));
}

async function loadList() {
  // Admins see hidden challenges too
  const tasks = await listCommunityTasks({ status: 'active', max: 80, includeHidden: true });
  $('adminTasks').innerHTML = tasks.map(t => `
    <div class="task-row">
      <div style="font-size:1.5rem">${esc(t.icon || '🏁')}</div>
      <div>
        <h3>${t.featured ? '⭐ ' : ''}${t.hidden ? '🙈 ' : ''}${esc(t.title)}</h3>
        <p>${esc(t.kind)} · by ${esc(t.creatorName || t.creatorUid)} · ${t.joins || 0} joins
          · ${t.featured ? 'featured' : 'unfeatured'}
          · ${t.hidden ? 'hidden' : 'visible'}</p>
      </div>
      <div class="task-actions">
        <button type="button" class="btn secondary feat-btn" data-id="${esc(t.id)}" data-on="${t.featured ? '0' : '1'}">${t.featured ? 'Unfeature' : 'Feature'}</button>
        <button type="button" class="btn secondary hide-btn" data-id="${esc(t.id)}" data-on="${t.hidden ? '0' : '1'}">${t.hidden ? 'Unhide' : 'Hide'}</button>
        <button type="button" class="btn secondary archive-btn" data-id="${esc(t.id)}">Archive</button>
        <button type="button" class="btn secondary danger-action remove-btn" data-id="${esc(t.id)}">Remove</button>
        <button type="button" class="btn secondary danger-action delete-btn" data-id="${esc(t.id)}" data-title="${esc(t.title)}">Delete</button>
      </div>
    </div>`).join('') || '<p class="muted">No Challenges yet — users can create them from the Create Challenge action.</p>';

  $('adminTasks').querySelectorAll('.feat-btn').forEach(btn => {
    btn.onclick = async () => {
      await setChallengeFeatured(btn.dataset.id, btn.dataset.on === '1');
      await loadList();
    };
  });
  $('adminTasks').querySelectorAll('.hide-btn').forEach(btn => {
    btn.onclick = async () => {
      await setChallengeHidden(btn.dataset.id, btn.dataset.on === '1');
      await loadList();
    };
  });
  $('adminTasks').querySelectorAll('.archive-btn').forEach(btn => {
    btn.onclick = async () => {
      await archiveTask(btn.dataset.id);
      await loadList();
    };
  });
  $('adminTasks').querySelectorAll('.remove-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Permanently remove this challenge?')) return;
      await removeChallenge(btn.dataset.id);
      await loadList();
    };
  });
  $('adminTasks').querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm(`Are you sure you want to delete this challenge?\n\n"${btn.dataset.title}"\n\nThis cannot be undone.`)) return;
      btn.disabled = true;
      btn.textContent = 'Deleting…';
      try {
        await removeChallenge(btn.dataset.id);
        showToast('Challenge deleted ✅');
        await loadList();
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Delete failed', 'error');
        btn.disabled = false;
        btn.textContent = 'Delete';
      }
    };
  });
}

onAuthStateChanged(auth, async user => {
  if (!user) return;
  const ok = await isAdmin(user.uid);
  if (!ok) {
    $('denied').hidden = false;
    return;
  }
  $('adminPanel').hidden = false;
  await loadList();

  $('badgesBtn').onclick = async () => {
    trioCache.invalidate('badge_catalog');
    await ensureBadgeCatalog();
    $('adminStatus').textContent = 'Badges seeded ✅';
  };
  $('expireBtn').onclick = async () => {
    const n = await expireOldTasks();
    $('adminStatus').textContent = `Expired ${n} Challenge(s)`;
    await loadList();
  };
});
