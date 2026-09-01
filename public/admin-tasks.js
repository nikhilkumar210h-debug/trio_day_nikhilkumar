import { auth } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { isAdmin, ensureSystemTemplates, createTemplate } from './gamification/templates.js';
import { ensureBadgeCatalog } from './gamification/badges.js';
import {
  listCommunityTasks, expireOldTasks, archiveTask,
  setChallengeFeatured, setChallengeHidden, removeChallenge
} from './gamification/community-tasks.js';
import { trioCache } from './trio-cache.js';

const $ = id => document.getElementById(id);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  document.getElementById('trioToast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'trioToast';
  toast.setAttribute('role', 'status');
  toast.style.cssText = `
    position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 5rem);
    left:50%;transform:translateX(-50%);
    background:${type === 'error' ? '#c0392b' : type === 'warn' ? '#d4821a' : '#138843'};
    color:#fff;padding:0.75rem 1.35rem;border-radius:2rem;font-size:0.95rem;
    font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.4);z-index:9999;
    white-space:nowrap;max-width:calc(100vw - 2rem);text-align:center;
    animation:trioToastIn 0.25s ease;`;
  toast.textContent = message;
  if (!document.getElementById('trioToastStyle')) {
    const s = document.createElement('style'); s.id = 'trioToastStyle';
    s.textContent = '@keyframes trioToastIn{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(s);
  }
  document.body.appendChild(toast);
  setTimeout(() => toast?.remove(), type === 'success' ? 2800 : 5000);
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
    </div>`).join('') || '<p class="muted">No challenges yet — users create them from task-create.html.</p>';

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

  $('seedBtn').onclick = async () => {
    trioCache.invalidate('templates_seeded');
    trioCache.invalidate('task_templates_active');
    await ensureSystemTemplates();
    $('adminStatus').textContent = 'Templates seeded ✅';
  };
  $('badgesBtn').onclick = async () => {
    trioCache.invalidate('badge_catalog');
    await ensureBadgeCatalog();
    $('adminStatus').textContent = 'Badges seeded ✅';
  };
  $('expireBtn').onclick = async () => {
    const n = await expireOldTasks();
    $('adminStatus').textContent = `Expired ${n} task(s)`;
    await loadList();
  };
  $('createTpl').onclick = async () => {
    const btn = $('createTpl');
    const statusEl = $('adminStatus');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    statusEl.textContent = '';
    try {
      await createTemplate(user.uid, {
        title: $('tTitle').value.trim() || 'New template',
        description: $('tDesc').value.trim(),
        cadence: $('tCadence').value,
        metric: $('tMetric').value,
        target: Number($('tTarget').value) || 1,
        xpReward: Number($('tXp').value) || 40,
        icon: '✅'
      }, { isAdmin: true });
      statusEl.textContent = 'Template saved ✅';
      showToast('Template saved successfully! ✅');
      setTimeout(() => { location.href = 'tasks.html'; }, 1400);
    } catch (err) {
      console.error(err);
      const msg = err.message || 'Save failed';
      statusEl.textContent = msg;
      showToast(msg, 'error');
      btn.disabled = false;
      btn.textContent = 'Save template';
    }
  };
});
