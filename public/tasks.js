import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getMergedTasks, manualBump } from './gamification/progress.js';
import { listCommunityTasks, expireOldTasks } from './gamification/community-tasks.js';
import { isAdmin } from './gamification/templates.js';
import { xpIntoLevel, XP_PER_LEVEL, levelFromXp } from './gamification/constants.js';
import { progressRingHtml } from './ui/achievements.js';
import { runAppOpenReminders } from './gamification/reminders.js';
import { ensureBadgeCatalog } from './gamification/badges.js';
import { listActiveTemplates } from './gamification/templates.js';

const $ = id => document.getElementById(id);
const listEl = $('taskList');
const statusEl = $('tasksStatus');
let me = null;
let tab = 'daily';

function setStatus(t = '', err = false) {
  if (!statusEl) return;
  statusEl.textContent = t || 'Keep at it! You got this! 💪';
  statusEl.classList.toggle('error', err);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function applyThemeToggle() {
  const btn = $('themeToggle');
  const saved = localStorage.getItem('trio_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  btn?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('trio_theme', next);
  });
}

function renderHero(user) {
  const xp = Number(user?.xp) || 0;
  const level = user?.level || levelFromXp(xp);
  const into = xpIntoLevel(xp);
  const streak = Number(user?.streakCurrent) || 0;
  $('statXp').textContent = xp;
  $('statLevel').textContent = level;
  $('statStreak').textContent = streak;
  $('xpLabel').textContent = `${into} / ${XP_PER_LEVEL}`;
  $('xpFill').style.width = `${(into / XP_PER_LEVEL) * 100}%`;
}

function renderPersonalTasks(tasks) {
  if (!tasks.length) {
    listEl.innerHTML = '<div class="empty-state"><h3>No templates</h3><p>Check back soon or create a community task.</p></div>';
    return;
  }
  const done = tasks.filter(t => t.done).length;
  const pct = Math.round((done / tasks.length) * 100);
  $('heroRing').innerHTML = progressRingHtml(pct, { size: 72, stroke: 6, label: `${done}/${tasks.length}` });
  $('heroSub').textContent = done === tasks.length
    ? 'All done for this period — legend.'
    : `${tasks.length - done} left · keep the streak alive.`;

  listEl.innerHTML = tasks.map(t => {
    const target = Math.max(1, Number(t.target) || 1);
    const count = Math.min(Number(t.count) || 0, target);
    const ring = progressRingHtml((count / target) * 100, { size: 52, label: `${count}/${target}` });
    const canManual = t.metric === 'manual' || t.metric === 'drink_water' || t.metric === 'read_minutes' || t.metric === 'custom';
    const step = t.metric === 'read_minutes' ? 15 : 1;
    return `<article class="task-row${t.done ? ' done' : ''}" data-id="${esc(t.id)}">
      ${ring}
      <div>
        <h3>${esc(t.icon || '✅')} ${esc(t.title)}</h3>
        <p>${esc(t.description || '')}</p>
        <div class="task-meta"><span>+${esc(t.xpReward)} XP</span><span>${esc(t.cadence)}</span><span>${esc(t.metric)}</span></div>
      </div>
      <div class="task-actions">
        ${t.done
          ? `<button type="button" class="btn secondary" disabled>Done</button>`
          : canManual
            ? `<button type="button" class="btn primary bump-btn" data-id="${esc(t.id)}" data-amt="${step}">+${step}</button>`
            : `<button type="button" class="btn secondary" disabled>Auto</button>`}
      </div>
    </article>`;
  }).join('');

  listEl.querySelectorAll('.bump-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!me) return;
      btn.disabled = true;
      try {
        await manualBump(me.uid, btn.dataset.id, Number(btn.dataset.amt) || 1);
        const snap = await getDoc(doc(db, 'users', me.uid));
        if (snap.exists()) renderHero(snap.data());
        await loadTab();
      } catch (err) {
        console.error(err);
        setStatus(err.message || 'Could not update task', true);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function renderCommunity(tasks, kindLabel) {
  $('heroRing').innerHTML = progressRingHtml(tasks.length ? 100 : 0, { size: 72, label: String(tasks.length) });
  $('heroSub').textContent = `${kindLabel} — join, complete, earn XP together.`;
  if (!tasks.length) {
    listEl.innerHTML = `<div class="empty-state"><h3>Nothing live</h3><p>Anyone can start one from a template.</p><p><a class="btn primary" href="task-create.html">Create challenge</a></p></div>`;
    return;
  }
    listEl.innerHTML = tasks.map(t => `
    <a class="community-card" href="task-detail.html?id=${encodeURIComponent(t.id)}">
      <h3>${t.featured ? '<span class="ach-pill">Featured</span> ' : ''}${esc(t.icon || '🏁')} ${esc(t.title)}</h3>
      <p>${esc(t.description || '')}</p>
      <div class="community-stats">
        <span>${esc(t.kind || 'challenge')}</span>
        <span>${t.joins || 0} joined</span>
        <span>${t.likes || 0} likes</span>
        <span>${t.completions || 0} done</span>
        <span>+${t.xpReward || 0} XP</span>
      </div>
    </a>`).join('');
}

async function loadTab() {
  if (!me) {
    listEl.innerHTML = '<div class="empty-state"><h3>Login required</h3></div>';
    return;
  }
  setStatus('Loading…');
  try {
    if (tab === 'community' || tab === 'challenge') {
      const kind = tab === 'challenge' ? 'challenge' : 'community';
      const tasks = await listCommunityTasks({ kind: tab === 'community' ? null : kind, status: 'active' });
      const filtered = tab === 'community'
        ? tasks.filter(t => t.kind !== 'challenge')
        : tasks.filter(t => t.kind === 'challenge' || t.kind === 'seasonal');
      renderCommunity(filtered, tab === 'challenge' ? 'Challenges & seasonal' : 'Community tasks');
    } else if (tab === 'fun') {
      const templates = await listActiveTemplates();
      const funTemplates = templates.filter(t => t.metric && (t.metric === 'laugh_minutes' || t.metric === 'smile_shares' || t.metric === 'dance_breaks' || t.metric === 'good_vibes'));
      renderPersonalTasks(funTemplates);
    } else {
      const tasks = await getMergedTasks(me.uid, tab);
      renderPersonalTasks(tasks);
    }
    setStatus('');
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Failed to load', true);
  }
}

document.querySelectorAll('.tasks-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tasks-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tab = btn.dataset.tab;
    loadTab();
  });
});

applyThemeToggle();

onAuthStateChanged(auth, async user => {
  me = user;
  if (!user) return;
  await ensureBadgeCatalog().catch(() => { });
  expireOldTasks().catch(() => { });
  runAppOpenReminders(user.uid).catch(() => { });

  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  renderHero(snap?.exists() ? snap.data() : {});
  if (await isAdmin(user.uid)) $('adminLink').hidden = false;
  await loadTab();
});
