/**
 * admin-activity.js — Trio Day Admin panel (Activities & Tasks)
 *
 * All writes go through the gamification Worker (strict admin email check);
 * this page never writes to Supabase or Firestore directly from the browser.
 *
 * Verified schema facts this file depends on:
 *  - activities: id, display_order, category, title_en, title_hi, description_en,
 *    description_hi, difficulty, total_xp, cover_image_url, is_guest_allowed,
 *    is_published, created_at      (no `icon`, no `updated_at`)
 *  - tasks: id, activity_id, task_number, task_type, title_en, title_hi,
 *    instructions_en, instructions_hi, verification_prompt, min_time_seconds,
 *    xp_reward, created_at         (no `description_en`, `is_published`, `updated_at`)
 *  - `verification_prompt` is NOT readable with the anon key (service-role only),
 *    so it is not part of the admin SELECT and is only sent when the admin edits
 *    it (blank = keep the stored prompt).
 */

import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { SoundManager } from './sound-manager.js';
import { escapeHtml as esc } from './utils.js';
import { setAdminFlag } from './ui/nav.js';
import { workerPost } from './gamification/worker-config.js';

const SUPABASE_URL = 'https://vccypxwiqcuexxrhtgyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zJvP50wf3CW2PNfkOD9yCQ_ffFhsZEp';
const ADMIN_EMAILS = ['nikhilkumar210h@gmail.com', 'nikhilkumar45374@gmail.com'];
const CLOUDINARY_CLOUD_NAME = 'vyhglthg'; // must match the media-upload Worker + image-upload.js

const ACTIVITY_SELECT = 'id,display_order,category,title_en,title_hi,description_en,description_hi,difficulty,total_xp,cover_image_url,is_guest_allowed,is_published,created_at';
// verification_prompt intentionally omitted: the anon role cannot read it.
const TASK_SELECT_ADMIN = 'id,activity_id,task_number,task_type,title_en,title_hi,instructions_en,instructions_hi,min_time_seconds,xp_reward,created_at';

const CATEGORY_ICONS = {
  Starter: '🔥', Learning: '📚', 'Digital Skill': '💻', 'Personal Growth': '🌱',
  'Mind & Emotion': '🧠', 'Social Life': '🤝', 'Career & Practical Life': '🧭'
};

let currentUser = null;
let isAdmin = false;
let activitiesCache = [];
let tasksCache = [];
let editingActivityId = null;
let editingTaskId = null;
let verificationPromptDirty = false;

// ─── DOM ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const denied = $('denied');
const adminPanel = $('adminPanel');
const activitiesList = $('activitiesList');
const tasksList = $('tasksList');
const filterActivity = $('filterActivity');
const filterActivityCategory = $('activityCategoryFilter');
const activityForm = $('activityForm');
const taskForm = $('taskForm');
const taskModal = $('taskModal');
const createActivityTitle = $('createActivityTitle');

// ─── INIT ───────────────────────────────────────────────────────────────────
SoundManager.init();

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (user && ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
    isAdmin = true;
    setAdminFlag(true);
    if (denied) denied.hidden = true;
    if (adminPanel) adminPanel.hidden = false;
    await initAdmin();
  } else {
    isAdmin = false;
    setAdminFlag(false);
    if (denied) denied.hidden = false;
    if (adminPanel) adminPanel.hidden = true;
  }
});

// The header chip is rendered by auth-ui.js; this page adds only the Admin pill
// (its admin-only action surface) and the language toggle.
function mountHeaderExtras() {
  const el = $('authStatus');
  if (!el) return;
  el.querySelectorAll('[data-admin-extra]').forEach(n => n.remove());
  if (isAdmin) {
    const pill = document.createElement('span');
    pill.className = 'status-badge';
    pill.dataset.adminExtra = 'pill';
    pill.style.cssText = 'background:rgba(239,68,68,.18); border-color:rgba(239,68,68,.5); color:#F87171;';
    pill.textContent = '👑 Admin';
    el.appendChild(pill);
  }
  const lang = document.createElement('button');
  lang.type = 'button';
  lang.className = 'lang-toggle';
  lang.dataset.adminExtra = 'lang';
  lang.setAttribute('aria-label', 'Language');
  lang.textContent = localStorage.getItem('trio_language') === 'HI' ? 'HI' : 'EN';
  lang.addEventListener('click', toggleLanguage);
  el.appendChild(lang);
}
window.addEventListener('trio-auth-status-rendered', mountHeaderExtras);

function toggleLanguage() {
  const lang = localStorage.getItem('trio_language') === 'EN' ? 'HI' : 'EN';
  localStorage.setItem('trio_language', lang);
  location.reload();
}

// ─── INIT ADMIN ─────────────────────────────────────────────────────────────
async function initAdmin() {
  await loadActivities();
  setupTabs();
  setupTaskForm();
  setupUpload();
  setupModals();
  mountHeaderExtras();
}

function setupTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const key = tab.dataset.tab;
      const panelId = {
        activities: 'panelActivities',
        'create-activity': 'panelCreateActivity',
        tasks: 'panelTasks'
      }[key];
      const panel = panelId ? $(panelId) : null;
      if (panel) panel.classList.add('active');
      if (key === 'tasks') loadTasks();
      if (key === 'create-activity') resetActivityForm();
    });
  });
}

// ─── TASK FORM (templates + activity picker) ─────────────────────────────────
const TASK_TEMPLATES = {
  offline: ['Real-life Action', 'Complete one useful real-world action', 'Choose one small, safe action that helps you or your surroundings. Do it today and describe the concrete result.', 'Aaj ek chhota aur safe kaam karein jo aapki ya aas-paas ki madad kare. Phir uska result batayein.', 600, 25, 'Check for a specific, plausible action and a concrete result. Do not require photos or private information.'],
  learning: ['Learning Sprint', 'Learn one concept and explain it', 'Study one concept, explain it in your own words, and give one example.', 'Ek concept padhein, apne shabdon mein samjhayen aur ek example dein.', 900, 30, 'Check relevance, own reasoning, and a meaningful example.'],
  creative: ['Creative Build', 'Create a tiny original thing', 'Create a small sketch, paragraph, mini design, or code snippet. Explain one choice you made.', 'Ek chhoti original cheez banayein—sketch, paragraph, design ya code snippet. Apna ek choice samjhayen.', 900, 30, 'Look for a concrete description of the creation. Do not claim to verify unseen work.'],
  reflection: ['Reflection', 'Reflect on one moment and one lesson', 'Think of one ordinary moment today. What happened, what did you learn, and what small step will you try next?', 'Aaj ke ek aam moment par sochein: kya hua, kya seekha aur agla chhota step kya hoga?', 180, 15, 'Accept relevant reflection; do not require sensitive personal details.'],
  social: ['Social Connection', 'Make one thoughtful connection', 'Have a brief, respectful conversation or offer useful help. Respect boundaries and do not share names.', 'Kisi se respectful baat karein ya madad karein. Boundaries ka dhyan rakhein aur naam share na karein.', 300, 25, 'Check for a specific, respectful interaction. Do not request other people’s private information.'],
  mindful: ['Mindful Reset', 'Take a calm screen-free pause', 'Pause for a few minutes, notice your surroundings, and choose one thing to return to with attention.', 'Kuch minute ruk kar aas-paas par dhyan dein aur phir ek kaam focus se karne ke liye chunein.', 180, 15, 'Accept a relevant reflection without inferring mental-health status.'],
  planning: ['Planning', 'Plan the next small step', 'Write one goal, the next action, when you will do it, and one possible obstacle.', 'Ek goal, agla action, use kab karenge aur ek possible rukawat likhein.', 300, 20, 'Check for a concrete action and realistic time or cue.'],
  observe: ['Observation', 'Notice three details', 'Observe a safe, ordinary place or object. Note three specific details and one pattern.', 'Kisi safe jagah ya object ko observe karein. Teen details aur ek pattern likhein.', 180, 15, 'Check for three distinct observations. Avoid identifying strangers.'],
  habit: ['Habit Practice', 'Practice one tiny helpful habit', 'Choose a small helpful habit, do it once, and describe what helped you begin.', 'Ek chhoti helpful habit chunein, use ek baar karein aur batayein shuru kaise kiya.', 300, 20, 'Check for a specific, safe habit and a plausible description.'],
  problem: ['Problem Solving', 'Solve one everyday problem', 'Pick a harmless everyday problem, list two possible solutions, choose one, and explain why.', 'Ek chhoti safe problem chunein, do solutions likhein, ek chunein aur wajah samjhayen.', 600, 25, 'Check for a problem, two distinct options, and a reasoned choice.'],
  boss: ['Boss Task', 'Complete a mini-project', 'Break the challenge into 2–3 steps, complete what is feasible today, then report the outcome and next step.', 'Challenge ko 2–3 steps mein baantein, aaj jitna ho sake karein aur result aur next step batayein.', 1200, 50, 'Look for planning, a concrete outcome, and a next step; do not imply incomplete work is complete.']
};

function setupTaskForm() {
  const activityPicker = $('taskActivityPicker');
  if (activityPicker) {
    activityPicker.addEventListener('change', () => {
      $('taskActivityId').value = activityPicker.value;
      if (!editingTaskId) suggestNextTaskNumber();
    });
  }

  const preset = $('taskTemplate');
  if (!preset) return;
  preset.addEventListener('change', () => {
    const p = TASK_TEMPLATES[preset.value];
    if (!p) { return; }
    if (!confirmTemplateOverwrite()) { preset.value = ''; return; }

    $('taskType').value = p[0];
    $('taskTitle').value = p[1];
    $('taskInstructionsEn').value = p[2];
    $('taskInstructionsHi').value = p[3];
    $('taskMinTime').value = p[4];
    $('taskXp').value = p[5];
    setVerificationPrompt(p[6], true);
    setFormStatus('taskFormStatus', 'ok', 'Template applied. Edit any field before saving.');
    $('taskTitle').focus();
  });

  // Track whether the admin actually edited the verification prompt: it cannot
  // be read back, so an untouched blank field must not overwrite the stored one.
  $('taskVerificationPrompt')?.addEventListener('input', () => { verificationPromptDirty = true; });
}

/** Never silently destroy work-in-progress when a template is picked. */
function confirmTemplateOverwrite() {
  const filled = ['taskTitle', 'taskInstructionsEn', 'taskInstructionsHi'].some(id => ($(id)?.value || '').trim());
  if (!filled) return true;
  return window.confirm('Replace the current task fields with this template?');
}

function setVerificationPrompt(value, markDirty) {
  const el = $('taskVerificationPrompt');
  if (!el) return;
  el.value = value || '';
  verificationPromptDirty = !!markDirty;
}

function suggestNextTaskNumber() {
  const activityId = $('taskActivityPicker')?.value || filterActivity?.value || '';
  const used = tasksCache.filter(t => t.activity_id === activityId).map(t => Number(t.task_number) || 0);
  $('taskOrder').value = (used.length ? Math.max(...used) : 0) + 1;
}

function refreshActivityPicker() {
  const activityPicker = $('taskActivityPicker');
  if (!activityPicker) return;
  const current = activityPicker.value;
  activityPicker.innerHTML = '<option value="">Choose an activity…</option>' +
    activitiesCache.map(act => `<option value="${esc(act.id)}">${esc(act.title_en || 'Untitled activity')} · ${esc(act.category || '')}</option>`).join('');
  if (current) activityPicker.value = current;
}

// ─── ACTIVITIES ─────────────────────────────────────────────────────────────
function skeletonCards(n, height) {
  return Array.from({ length: n }, () =>
    `<div class="skeleton-card" style="height:${height}px; aspect-ratio:auto; border-radius:12px; margin-bottom:12px;"></div>`
  ).join('');
}

async function loadActivities() {
  if (!activitiesList) return;
  activitiesList.innerHTML = skeletonCards(3, 110);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/activities?select=${ACTIVITY_SELECT}&order=display_order.asc`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const data = await res.json();
    activitiesCache = Array.isArray(data) ? data : [];
    renderActivitiesList();
    refreshActivityPicker();
    loadActivitiesForFilter();
  } catch (err) {
    console.error('[Admin] Load activities error:', err);
    activitiesList.innerHTML = `<div class="admin-empty"><p>Failed to load activities (${esc(err.message)}).</p>
      <button type="button" class="btn secondary" id="retryActivities">Retry</button></div>`;
    $('retryActivities')?.addEventListener('click', loadActivities);
  }
}

function renderActivitiesList() {
  const category = filterActivityCategory?.value || '';
  const visibleActivities = category
    ? activitiesCache.filter(act => act.category === category)
    : activitiesCache;
  if (!visibleActivities.length) {
    if (activitiesCache.length) {
      activitiesList.innerHTML = '<div class="admin-empty">No activities for this goal yet. Select <strong>Create Activity</strong> to add one.</div>';
      return;
    }
    activitiesList.innerHTML = '<div class="admin-empty">No activities yet. Use <strong>Create Activity</strong> to add the first one.</div>';
    return;
  }

  activitiesList.innerHTML = visibleActivities.map(act => `
    <div class="task-list-item" data-id="${esc(act.id)}">
      <span class="task-order">${act.display_order || 0}</span>
      <div class="task-info">
        <div class="task-title">${CATEGORY_ICONS[act.category] || '⚡'} ${esc(act.title_en || 'Untitled')}</div>
        <div class="task-meta">
          ${esc(act.category || '—')} · ${esc(act.difficulty || 'no level')} · ⚡ ${Number(act.total_xp) || 0} XP ·
          ${act.is_guest_allowed ? '🔓 Guests' : '🔒 Members'} · ${act.is_published ? '✅ Published' : '⏸️ Draft'}
          ${act.cover_image_url ? ' · 🖼️ Image' : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn primary btn-sm create-activity-task" data-id="${esc(act.id)}">➕ Add Task</button>
        <button class="btn secondary btn-sm edit-activity" data-id="${esc(act.id)}">✏️ Edit</button>
        <button class="btn secondary btn-sm delete-activity" data-id="${esc(act.id)}" style="color:var(--color-danger); border-color:var(--color-danger)">🗑️ Delete</button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.edit-activity').forEach(btn => {
    btn.addEventListener('click', () => openActivityEditor(btn.dataset.id));
  });
  document.querySelectorAll('.create-activity-task').forEach(btn => {
    btn.addEventListener('click', () => openNewTaskEditor(btn.dataset.id));
  });
  document.querySelectorAll('.delete-activity').forEach(btn => {
    btn.addEventListener('click', () => deleteActivity(btn.dataset.id));
  });
}

function loadActivitiesForFilter() {
  if (!filterActivity) return;
  const current = filterActivity.value;
  filterActivity.innerHTML = '<option value="">All Activities</option>' +
    activitiesCache.map(act => `<option value="${esc(act.id)}">${esc(act.title_en || 'Untitled activity')}</option>`).join('');
  if (current) filterActivity.value = current;
}

function openActivityEditor(activityId) {
  const act = activitiesCache.find(a => a.id === activityId);
  if (!act) return;

  editingActivityId = activityId;
  createActivityTitle.textContent = 'Edit Activity';
  activityForm.querySelector('button[type="submit"]').textContent = '💾 Update Activity';

  $('activityId').value = act.id;
  $('actTitle').value = act.title_en || '';
  $('actCategory').value = act.category || '';
  $('actOrder').value = act.display_order || 0;
  $('actDescription').value = act.description_en || '';
  $('actDifficulty').value = act.difficulty || '';
  $('actXpReward').value = Number(act.total_xp) || '';
  $('actGuestAllowed').checked = act.is_guest_allowed === true;
  $('actActive').checked = act.is_published !== false;

  if (act.cover_image_url) {
    $('actCoverUrl').value = act.cover_image_url;
    $('actCoverUrl').style.display = 'block';
    $('actCoverPreview').src = act.cover_image_url;
    $('actCoverPreview').hidden = false;
    $('actCoverUpload').classList.add('has-file');
    setUploadText('Image uploaded', 'Click to replace');
  } else {
    resetCoverUpload();
  }

  hideFormStatus('activityFormStatus');
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="create-activity"]')?.classList.add('active');
  $('panelCreateActivity')?.classList.add('active');
}

function resetActivityForm() {
  editingActivityId = null;
  createActivityTitle.textContent = 'Create New Activity';
  activityForm.querySelector('button[type="submit"]').textContent = '💾 Save Activity';
  activityForm.reset();
  $('activityId').value = '';
  resetCoverUpload();
  hideFormStatus('activityFormStatus');
}

function resetCoverUpload() {
  $('actCoverUrl').value = '';
  $('actCoverUrl').style.display = 'none';
  $('actCoverPreview').hidden = true;
  $('actCoverPreview').src = '';
  $('actCoverUpload').classList.remove('has-file');
  setUploadText('Click or drag to upload', 'Auto-optimized for the activity card');
}

function setUploadText(strong, small) {
  const el = $('actCoverUpload')?.querySelector('.upload-text');
  if (el) el.innerHTML = `<strong>${esc(strong)}</strong><br><small>${esc(small)}</small>`;
}

async function saveActivity(e) {
  e.preventDefault();

  const formData = new FormData(activityForm);
  const data = {
    title_en: String(formData.get('title') || '').trim(),
    category: formData.get('category') || '',
    display_order: parseInt(formData.get('order_index'), 10) || 0,
    description_en: String(formData.get('description') || '').trim(),
    cover_image_url: formData.get('cover_image') || null,
    difficulty: String(formData.get('difficulty') || '').trim(),
    total_xp: Math.max(0, parseInt(formData.get('total_xp'), 10) || 0),
    is_guest_allowed: formData.get('is_guest_allowed') === 'true',
    is_published: formData.get('is_active') === 'true'
    // NOTE: no `icon` (no such column) and no `updated_at` (no such column).
  };

  if (!data.title_en) { setFormStatus('activityFormStatus', 'error', 'A title is required.'); return; }
  if (!data.category) { setFormStatus('activityFormStatus', 'error', 'Choose a category.'); return; }

  const submitBtn = activityForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';

  try {
    const action = editingActivityId ? 'update' : 'create';
    await workerPost('/api/admin/activity', { action, activityId: editingActivityId || '', data }, currentUser);

    setFormStatus('activityFormStatus', 'ok', editingActivityId ? 'Activity updated.' : 'Activity created.');
    showToast(editingActivityId ? 'Activity updated!' : 'Activity created!');
    resetActivityForm();
    await loadActivities();

    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="activities"]')?.classList.add('active');
    $('panelActivities')?.classList.add('active');
  } catch (err) {
    console.error('[Admin] Save activity error:', err);
    setFormStatus('activityFormStatus', 'error', `Could not save: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingActivityId ? '💾 Update Activity' : '💾 Save Activity';
  }
}

async function deleteActivity(activityId) {
  const act = activitiesCache.find(a => a.id === activityId);
  if (!window.confirm(`Delete “${act?.title_en || 'this activity'}” and all of its tasks? This cannot be undone.`)) return;

  try {
    await workerPost('/api/admin/activity', { action: 'delete', activityId }, currentUser);
    showToast('Activity deleted!');
    await loadActivities();
  } catch (err) {
    console.error('[Admin] Delete error:', err);
    window.alert('Could not delete: ' + err.message);
  }
}

// ─── TASKS ──────────────────────────────────────────────────────────────────
async function loadTasks(activityIdFilter = filterActivity?.value || '') {
  if (!tasksList) return false;
  tasksCache = [];

  let url = `${SUPABASE_URL}/rest/v1/tasks?select=${TASK_SELECT_ADMIN}&order=activity_id.asc,task_number.asc`;
  if (activityIdFilter) url += `&activity_id=eq.${encodeURIComponent(activityIdFilter)}`;

  tasksList.innerHTML = skeletonCards(3, 90);

  try {
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const data = await res.json();
    tasksCache = Array.isArray(data) ? data : [];
    renderTasksList();
    return true;
  } catch (err) {
    console.error('[Admin] Load tasks error:', err);
    tasksCache = [];
    tasksList.innerHTML = `<div class="admin-empty"><p>Failed to load tasks (${esc(err.message)}).</p>
      <button type="button" class="btn secondary" id="retryTasks">Retry</button></div>`;
    $('retryTasks')?.addEventListener('click', () => loadTasks(activityIdFilter));
    return false;
  }
}

function activityTitleOf(activityId) {
  return activitiesCache.find(a => a.id === activityId)?.title_en || activityId;
}

function renderTasksList() {
  if (!tasksCache.length) {
    tasksList.innerHTML = '<div class="admin-empty">No tasks yet. Use <strong>Create Task</strong> to add one.</div>';
    return;
  }

  tasksList.innerHTML = tasksCache.map(task => `
    <div class="task-list-item" data-id="${esc(task.id)}">
      <span class="task-order">${task.task_number}</span>
      <div class="task-info">
        <div class="task-title">${esc(task.task_type || 'Task')}: ${esc(task.title_en || 'Untitled')}</div>
        <div class="task-meta">
          ${esc(activityTitleOf(task.activity_id))} ·
          ${task.min_time_seconds ? `⏱️ ${task.min_time_seconds}s suggested` : 'no timer'} ·
          ⚡ ${Number(task.xp_reward) || 0} XP
        </div>
      </div>
      <div class="task-actions">
        <button class="btn secondary btn-sm edit-task" data-id="${esc(task.id)}">✏️ Edit</button>
        <button class="btn secondary btn-sm delete-task" data-id="${esc(task.id)}" style="color:var(--color-danger); border-color:var(--color-danger)">🗑️ Delete</button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.edit-task').forEach(btn => {
    btn.addEventListener('click', () => openTaskEditor(btn.dataset.id));
  });
  document.querySelectorAll('.delete-task').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.id));
  });
}

function openTaskEditor(taskId) {
  const task = tasksCache.find(t => t.id === taskId);
  if (!task) return;

  editingTaskId = taskId;
  $('taskModalEyebrow').textContent = 'Edit Task';
  $('taskModalTitle').textContent = task.title_en || 'Task';

  taskForm.reset();
  $('taskId').value = task.id;
  $('taskActivityId').value = task.activity_id;
  if ($('taskActivityPicker')) $('taskActivityPicker').value = task.activity_id;
  $('taskOrder').value = task.task_number || 1;
  $('taskType').value = task.task_type || 'Action Step';
  $('taskTitle').value = task.title_en || '';
  if ($('taskTitleHi')) $('taskTitleHi').value = task.title_hi || '';
  $('taskInstructionsEn').value = task.instructions_en || '';
  $('taskInstructionsHi').value = task.instructions_hi || '';
  $('taskMinTime').value = task.min_time_seconds || 0;
  $('taskXp').value = task.xp_reward || 10;
  // Not readable client-side: blank means "keep the stored prompt".
  setVerificationPrompt('', false);
  if ($('taskTemplate')) $('taskTemplate').value = '';
  hideFormStatus('taskFormStatus');

  taskModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

async function openNewTaskEditor(activityId = filterActivity?.value || '') {
  editingTaskId = null;
  $('taskModalEyebrow').textContent = 'Create Task';
  $('taskModalTitle').textContent = 'New Task';

  const loadedActivityTasks = activityId ? await loadTasks(activityId) : true;
  taskForm.reset();
  $('taskId').value = '';
  $('taskActivityId').value = activityId;
  if ($('taskActivityPicker')) $('taskActivityPicker').value = activityId;
  $('taskType').value = 'Action Step';
  $('taskXp').value = 10;
  $('taskMinTime').value = 0;
  if ($('taskTitleHi')) $('taskTitleHi').value = '';
  setVerificationPrompt('', false);
  if ($('taskTemplate')) $('taskTemplate').value = '';
  hideFormStatus('taskFormStatus');
  if (!loadedActivityTasks) setFormStatus('taskFormStatus', 'error', 'Could not load this activity’s tasks. Check the activity selection and task number before saving.');
  suggestNextTaskNumber();

  taskModal.hidden = false;
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => $('taskTitle')?.focus(), 60);
}

function closeTaskModal() {
  taskModal.hidden = true;
  document.body.style.overflow = '';
  editingTaskId = null;
}

async function saveTask(e) {
  e.preventDefault();

  const formData = new FormData(taskForm);
  const activityIdValue = $('taskActivityPicker')?.value || formData.get('activity_id');
  if (!activityIdValue) {
    setFormStatus('taskFormStatus', 'error', 'Choose which activity this task belongs to.');
    $('taskActivityPicker')?.focus();
    return;
  }
  $('taskActivityId').value = activityIdValue;

  const title = String(formData.get('title') || '').trim();
  const taskNumber = parseInt(formData.get('task_number'), 10);
  if (!title) { setFormStatus('taskFormStatus', 'error', 'A task title is required.'); return; }
  if (!Number.isFinite(taskNumber) || taskNumber < 1) { setFormStatus('taskFormStatus', 'error', 'Task number must be 1 or higher.'); return; }

  const data = {
    activity_id: activityIdValue,
    task_number: taskNumber,
    task_type: formData.get('type') || 'Action Step',
    title_en: title,
    instructions_en: String(formData.get('instructions_en') || '').trim(),
    instructions_hi: String(formData.get('instructions_hi') || '').trim(),
    min_time_seconds: Math.max(0, parseInt(formData.get('min_time_seconds'), 10) || 0),
    xp_reward: Math.max(0, parseInt(formData.get('xp_reward'), 10) || 10)
    // `description_en` / `is_published` / `updated_at` do not exist on `tasks`.
  };
  if ($('taskTitleHi')) data.title_hi = String(formData.get('title_hi') || '').trim();
  // Only send verification_prompt when the admin edited it (it is unreadable).
  if (verificationPromptDirty) data.verification_prompt = String(formData.get('verification_prompt') || '');

  const submitBtn = taskForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';

  try {
    const action = editingTaskId ? 'update' : 'create';
    await workerPost('/api/admin/task', { action, taskId: editingTaskId || '', data }, currentUser);

    showToast(editingTaskId ? 'Task updated!' : 'Task created!');
    closeTaskModal();
    await loadTasks();
  } catch (err) {
    console.error('[Admin] Save task error:', err);
    setFormStatus('taskFormStatus', 'error', `Could not save: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Save Task';
  }
}

async function deleteTask(taskId) {
  const task = tasksCache.find(t => t.id === taskId);
  if (!window.confirm(`Delete “${task?.title_en || 'this task'}”? This cannot be undone.`)) return;

  try {
    await workerPost('/api/admin/task', { action: 'delete', taskId }, currentUser);
    showToast('Task deleted!');
    await loadTasks();
  } catch (err) {
    console.error('[Admin] Delete task error:', err);
    window.alert('Could not delete: ' + err.message);
  }
}

// ─── CLOUDINARY UPLOAD (signed through the Worker) ───────────────────────────
function setupUpload() {
  const uploadArea = $('actCoverUpload');
  const fileInput = $('actCoverFile');
  const urlInput = $('actCoverUrl');
  const preview = $('actCoverPreview');
  if (!uploadArea || !fileInput) return;

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer?.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
  });

  async function handleFileUpload(file) {
    if (!file.type.startsWith('image/')) { window.alert('Please select an image file.'); return; }
    if (file.size > 10 * 1024 * 1024) { window.alert('File too large (max 10MB).'); return; }

    uploadArea.classList.add('has-file');
    setUploadText('Uploading…', 'Please wait');

    try {
      const sign = await workerPost('/api/admin/cloudinary-sign', { folder: 'trio/activities', filename: file.name }, currentUser);
      const { uploadUrl, signature, timestamp, apiKey, publicId, cloudName } = sign;

      const body = new FormData();
      body.append('file', file);
      body.append('api_key', apiKey);
      body.append('timestamp', timestamp);
      body.append('signature', signature);
      body.append('folder', 'trio/activities');
      if (publicId) body.append('public_id', publicId);
      body.append('transformation', 'f_auto,q_auto,c_fill,g_auto,w_800');

      const endpoint = uploadUrl || `https://api.cloudinary.com/v1_1/${cloudName || CLOUDINARY_CLOUD_NAME}/image/upload`;
      const uploadRes = await fetch(endpoint, { method: 'POST', body });
      if (!uploadRes.ok) throw new Error(`Cloudinary upload failed (${uploadRes.status})`);
      const result = await uploadRes.json();

      // Prefer the cloud name the Worker actually signed for (never drift from it).
      const workerCloud = String(endpoint).match(/v1_1\/([^/]+)\//)?.[1];
      const name = cloudName || workerCloud || CLOUDINARY_CLOUD_NAME;
      const optimizedUrl = result.secure_url ||
        `https://res.cloudinary.com/${name}/image/upload/f_auto,q_auto,c_fill,g_auto,w_800/${result.public_id}`;

      urlInput.value = optimizedUrl;
      urlInput.style.display = 'block';
      if (preview) { preview.src = optimizedUrl; preview.hidden = false; }
      setUploadText('Uploaded successfully', 'Click to replace');
      showToast('Image uploaded & optimized!');
    } catch (err) {
      console.error('[Admin] Upload error:', err);
      uploadArea.classList.remove('has-file');
      setUploadText('Upload failed', 'Click to retry');
      setFormStatus('activityFormStatus', 'error', `Image upload failed: ${err.message}`);
    }
  }
}

// ─── MODALS ─────────────────────────────────────────────────────────────────
function setupModals() {
  $('taskModalClose')?.addEventListener('click', closeTaskModal);
  taskModal?.addEventListener('click', e => { if (e.target === taskModal) closeTaskModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && taskModal && !taskModal.hidden) closeTaskModal();
  });
  $('cancelTask')?.addEventListener('click', closeTaskModal);
  $('cancelActivity')?.addEventListener('click', resetActivityForm);
  $('createTaskBtn')?.addEventListener('click', () => openNewTaskEditor());
  $('refreshActivities')?.addEventListener('click', loadActivities);
  filterActivityCategory?.addEventListener('change', renderActivitiesList);
  filterActivity?.addEventListener('change', () => loadTasks());

  activityForm?.addEventListener('submit', saveActivity);
  taskForm?.addEventListener('submit', saveTask);
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function setFormStatus(id, kind, message) {
  const el = $(id);
  if (!el) return;
  el.hidden = false;
  el.className = `form-status is-${kind === 'ok' ? 'ok' : 'error'}`;
  el.textContent = message;
}

function hideFormStatus(id) {
  const el = $(id);
  if (el) { el.hidden = true; el.textContent = ''; }
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'lang-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2500);
}
