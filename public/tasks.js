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
import { escapeHtml as esc } from './utils.js';
import { trioCache } from './trio-cache.js';
import { createSheet } from './ui/sheet.js';

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

// Theme is managed globally by theme.js (loaded on every shell page).
// No independent page theme state here.

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
  // rail sync
  if ($('railLevel')) $('railLevel').textContent = level;
  if ($('railXpFill')) $('railXpFill').style.width = `${(into / XP_PER_LEVEL) * 100}%`;
  if ($('railXpLabel')) $('railXpLabel').textContent = `${into} / ${XP_PER_LEVEL} XP`;
  if ($('railStreak')) $('railStreak').textContent = streak;
  // badges preview rail
  const badges = user?.badges || [];
  const railBadges = $('railBadges'), railList = $('railBadgesList');
  if (railBadges && railList) {
    if (badges.length) {
      railBadges.hidden = false;
      railList.innerHTML = badges.slice(0,3).map(b=> `<span class="nkm-badge">${esc(b.name||b.id||'Badge')}</span>`).join(' ');
    } else railBadges.hidden = true;
  }
}

function renderPersonalTasks(tasks) {
  if (!tasks.length) {
    listEl.innerHTML = '<div class="nkm-empty" style="padding:18px">No tasks left today.<br><small>You\'ve completed today\'s activity.</small></div>';
    $('heroRing').innerHTML = progressRingHtml(100, { size: 56, stroke: 5, label: `0/0` });
    $('heroSub').textContent = 'All done — legend.';
    return;
  }
  const done = tasks.filter(t => t.done).length;
  const pct = Math.round((done / tasks.length) * 100);
  $('heroRing').innerHTML = progressRingHtml(pct, { size: 56, stroke: 5, label: `${done}/${tasks.length}` });
  $('heroSub').textContent = done === tasks.length ? 'All done for this period — legend.' : `${tasks.length - done} left · keep the streak alive.`;

  listEl.innerHTML = tasks.map(t => {
    const target = Math.max(1, Number(t.target) || 1);
    const count = Math.min(Number(t.count) || 0, target);
    const ring = progressRingHtml((count / target) * 100, { size: 44, stroke: 4, label: `${count}/${target}` });
    const canManual = t.metric === 'manual' || t.metric === 'drink_water' || t.metric === 'read_minutes' || t.metric === 'custom';
    const step = t.metric === 'read_minutes' ? 15 : 1;
    return `<article class="nkm-task-row${t.done ? ' done' : ''}" data-id="${esc(t.id)}">
      <span class="nkm-task-icon">${esc(t.icon || '✅')}</span>
      <div class="nkm-task-main">
        <h3>${esc(t.title)}</h3>
        <p>${esc(t.description || '')}</p>
        <div class="nkm-task-meta"><span class="nkm-task-xp">+${esc(t.xpReward)} XP</span><span class="nkm-task-cadence">${esc(t.cadence)}</span></div>
      </div>
      <span class="nkm-task-ring">${ring}</span>
      <div class="nkm-task-action">
        ${t.done ? `<button type="button" class="nkm-btn nkm-btn--sm" disabled>Done</button>` : canManual ? `<button type="button" class="nkm-btn nkm-btn--primary nkm-btn--sm bump-btn" data-id="${esc(t.id)}" data-amt="${step}">+${step}</button>` : `<button type="button" class="nkm-btn nkm-btn--sm" disabled>Auto</button>`}
      </div>
    </article>`;
  }).join('');

  listEl.querySelectorAll('.bump-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!me) return;
      const row = btn.closest('.nkm-task-row');
      const ringLabel = row?.querySelector('.ring-label');
      const prevLabel = ringLabel?.textContent || '';
      const prevBtnText = btn.textContent;
      // Optimistic: show immediate increment
      if (ringLabel) {
        const [curStr, targetStr] = prevLabel.split('/');
        const cur = parseInt(curStr) || 0;
        const target = parseInt(targetStr) || 1;
        const amt = Number(btn.dataset.amt) || 1;
        const next = Math.min(cur + amt, target);
        ringLabel.textContent = `${next}/${target}`;
        if (next >= target) {
          row.classList.add('done');
          btn.textContent = 'Done';
        } else {
          btn.textContent = '…';
        }
      } else {
        btn.textContent = '…';
      }
      btn.disabled = true;
      try {
        await manualBump(me.uid, btn.dataset.id, Number(btn.dataset.amt) || 1);
        trioCache.invalidate(`tasks_${me.uid}_${tab}`);
        trioCache.invalidatePrefix(`progress_${me.uid}_`);
        trioCache.invalidatePrefix('tasks_');
        const snap = await getDoc(doc(db, 'users', me.uid));
        if (snap.exists()) {
          trioCache.set(`user_${me.uid}`, snap.data(), trioCache.TTL.DEFAULT);
          renderHero(snap.data());
        }
        await loadTab();
      } catch (err) {
        if (ringLabel) ringLabel.textContent = prevLabel;
        if (row) row.classList.remove('done');
        btn.textContent = prevBtnText;
        console.error(err);
        setStatus(err.message || 'Could not update task', true);
      } finally {
        btn.disabled = false;
        if (btn.textContent === '…') btn.textContent = prevBtnText;
      }
    });
  });
}

function renderCommunity(tasks, kindLabel) {
  // update hero ring as count
  $('heroRing').innerHTML = progressRingHtml(tasks.length ? 100 : 0, { size: 56, label: String(tasks.length) });
  $('heroSub').textContent = `${kindLabel} — join, complete, earn XP together.`;
  // update rail challenge
  const railCh = $('railChallenge'), railTxt = $('railChallengeText');
  if (railCh && railTxt) {
    if (tasks.length) { railCh.hidden=false; railTxt.textContent = `${tasks[0].title} · +${tasks[0].xpReward||0} XP`; railCh.onclick=()=> location.href=`task-detail.html?id=${encodeURIComponent(tasks[0].id)}`; railCh.style.cursor='pointer'; }
    else railCh.hidden=true;
  }
  if (!tasks.length) {
    listEl.innerHTML = `<div class="nkm-empty">No community challenges yet.<br><a class="nkm-btn nkm-btn--primary nkm-btn--sm" href="task-create.html" style="margin-top:8px">Create challenge</a></div>`;
    return;
  }
  listEl.innerHTML = tasks.map(t => `
    <a class="nkm-community-card" href="task-detail.html?id=${encodeURIComponent(t.id)}">
      <div class="nkm-community-head"><span>${esc(t.icon || '🏁')}</span><strong>${esc(t.title)}</strong>${t.featured ? '<span class="nkm-badge">Featured</span>' : ''}</div>
      <p>${esc(t.description || '')}</p>
      <div class="nkm-community-meta"><span>${esc(t.kind || 'challenge')}</span><span>${t.joins || 0} joined</span><span>+${t.xpReward || 0} XP</span></div>
    </a>`).join('');
}

async function loadTab() {
  if (!me) {
    listEl.innerHTML = '<div class="nkm-empty">Login required</div>';
    return;
  }
  setStatus('Loading…');
  // skeleton
  listEl.innerHTML = '<div class="nkm-skeleton nkm-skel-row" style="height:72px"></div><div class="nkm-skeleton nkm-skel-row" style="height:72px"></div>';
  try {
    if (tab === 'community' || tab === 'challenge') {
      const kind = tab === 'challenge' ? 'challenge' : 'community';
      const cacheKey = `communityTasks_${kind}`;
      let tasks = trioCache.get(cacheKey);
      if (!tasks) {
        const all = await listCommunityTasks({ kind: tab === 'community' ? null : kind, status: 'active' });
        tasks = all;
        trioCache.set(cacheKey, tasks, trioCache.TTL.SHORT);
      }
      const filtered = tab === 'community' ? tasks.filter(t => t.kind !== 'challenge') : tasks.filter(t => t.kind === 'challenge' || t.kind === 'seasonal');
      renderCommunity(filtered, tab === 'challenge' ? 'Challenges & seasonal' : 'Community tasks');
    } else if (tab === 'fun') {
      const cacheKey = 'templates_fun';
      let fun = trioCache.get(cacheKey);
      if (!fun) {
        const templates = await listActiveTemplates();
        fun = templates.filter(t => t.metric && (t.metric === 'laugh_minutes' || t.metric === 'smile_shares' || t.metric === 'dance_breaks' || t.metric === 'good_vibes'));
        trioCache.set(cacheKey, fun, trioCache.TTL.SHORT);
      }
      renderPersonalTasks(fun);
    } else {
      const cacheKey = `tasks_${me.uid}_${tab}`;
      let tasks = trioCache.get(cacheKey);
      if (!tasks) {
        tasks = await getMergedTasks(me.uid, tab);
        trioCache.set(cacheKey, tasks, trioCache.TTL.SHORT);
      }
      renderPersonalTasks(tasks);
    }
    setStatus('');
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Failed to load', true);
  }
}

function openSecondarySheet(){
  const adminHidden = $('adminLink')?.hidden;
  const { open, close } = createSheet({ title:'Options', content:`
    <div style="display:grid;gap:8px">
      <a class="nkm-btn" href="leaderboard.html">Leaderboard</a>
      ${adminHidden ? '' : '<a class="nkm-btn" href="admin-tasks.html">Admin</a>'}
    </div>`});
  open();
  close; // keep reference
}
function openMoreSheet(){
  const { open } = createSheet({ title:'More periods', content:`
    <div style="display:grid;gap:8px">
      <button class="nkm-btn" type="button" data-sheet-tab="monthly">Monthly</button>
      <button class="nkm-btn" type="button" data-sheet-tab="fun">Fun</button>
    </div>`});
  open();
  document.querySelectorAll('[data-sheet-tab]').forEach(b=>{
    b.addEventListener('click', ()=>{
      tab = b.dataset.sheetTab;
      document.querySelectorAll('.nkm-tab').forEach(x=> x.classList.remove('is-active'));
      const mm = $('moreMenu'); if(mm) mm.hidden=true;
      const mb = $('moreBtn'); if(mb) mb.setAttribute('aria-expanded','false');
      loadTab();
      document.querySelector('.nkm-scrim')?.click();
    });
  });
}
function initTabs() {
  const moreBtn = $('moreBtn'), moreMenu = $('moreMenu');
  document.querySelectorAll('.nkm-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nkm-tab').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      if (moreMenu) moreMenu.hidden = true;
      if (moreBtn) moreBtn.setAttribute('aria-expanded','false');
      tab = btn.dataset.tab;
      loadTab();
    });
  });
  moreBtn?.addEventListener('click', e=>{
    e.stopPropagation();
    if (window.innerWidth <= 640) { openMoreSheet(); return; }
    const hidden = moreMenu.hidden;
    moreMenu.hidden = !hidden;
    moreBtn.setAttribute('aria-expanded', String(!hidden));
  });
  document.querySelectorAll('.nkm-more-item').forEach(b=>{
    b.addEventListener('click', ()=>{
      tab = b.dataset.tab;
      document.querySelectorAll('.nkm-tab').forEach(x=> x.classList.remove('is-active'));
      if (moreMenu) moreMenu.hidden=true;
      if (moreBtn) { moreBtn.setAttribute('aria-expanded','false'); moreBtn.textContent = b.textContent + ' ▾'; }
      loadTab();
    });
  });
  document.addEventListener('click', e=>{
    if (!moreMenu?.contains(e.target) && e.target!==moreBtn) { if(moreMenu) moreMenu.hidden=true; moreBtn?.setAttribute('aria-expanded','false'); }
  });
  $('activityMoreBtn')?.addEventListener('click', e=>{ e.stopPropagation(); openSecondarySheet(); });
}

initTabs();

onAuthStateChanged(auth, async user => {
  me = user;
  if (!user) return;
  await ensureBadgeCatalog().catch(() => { });
  expireOldTasks().catch(() => { });
  runAppOpenReminders(user.uid).catch(() => { });

  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  const data = snap?.exists() ? snap.data() : {};
  // cache hero data
  trioCache.set(`user_${user.uid}`, data, trioCache.TTL.DEFAULT);
  renderHero(data);
  if (await isAdmin(user.uid)) $('adminLink').hidden = false;
  await loadTab();
});
