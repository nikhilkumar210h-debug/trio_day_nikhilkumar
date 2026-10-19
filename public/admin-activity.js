/**
 * admin-activity.js — Trio Day Admin Panel for Activities & Tasks
 * 
 * Features:
 * - Admin-only access (strict email check)
 * - CRUD for Activities (with Cloudinary signed upload)
 * - CRUD for Tasks (with AI verification prompt)
 * - Real-time sync with Supabase
 */

import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { SoundManager } from './sound-manager.js';
import { escapeHtml as esc } from './utils.js';
import { setAdminFlag } from './ui/nav.js';

const WORKER_BASE = 'https://trio-day.trioday-nikhil.workers.dev';
const ADMIN_EMAILS = ['nikhilkumar210h@gmail.com', 'nikhilkumar45374@gmail.com'];

let currentUser = null;
let isAdmin = false;
let activitiesCache = [];
let tasksCache = [];
let editingActivityId = null;
let editingTaskId = null;
let adminInitialized = false;
let taskPickerBound = false;
let taskModalReturnFocus = null;

// ─── DOM ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const denied = $('denied');
const adminPanel = $('adminPanel');
const activitiesList = $('activitiesList');
const tasksList = $('tasksList');
const filterActivity = $('filterActivity');
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
    denied.hidden = true;
    adminPanel.hidden = false;
    renderAuthStatus();
    if (!adminInitialized) {
      adminInitialized = true;
      try { await initAdmin(); }
      catch (err) {
        adminInitialized = false;
        console.error('[Admin] Initialization failed:', err);
        adminPanel.insertAdjacentHTML('afterbegin', `<div class="admin-error" role="alert">Admin panel could not initialize: ${esc(err.message || 'Unknown error')}. Refresh and try again.</div>`);
      }
    }
  } else {
    isAdmin = false;
    setAdminFlag(false);
    denied.hidden = false;
    adminPanel.hidden = true;
    renderAuthStatus();
  }
});

function renderAuthStatus() {
  const authStatus = $('authStatus');
  if (!authStatus) return;
  
  if (currentUser && isAdmin) {
    const name = currentUser.displayName || 'Admin';
    const initial = name.trim().charAt(0).toUpperCase();
    authStatus.innerHTML = `
      <span class="status-badge" style="background:rgba(239,68,68,.2); border-color:rgba(239,68,68,.5); color:#EF4444;">👑 Admin</span>
      <a href="index.html" class="status-badge">🏠 Activities</a>
      <button id="langToggleBtn" class="lang-toggle" aria-label="Language">${localStorage.getItem('trio_language') || 'EN'}</button>
      <div style="width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#EF4444,#F97316);color:#fff;font-weight:900;font-size:16px;border:2px solid #EF4444">${esc(initial)}</div>
    `;
    const langBtn = $('langToggleBtn');
    if (langBtn) langBtn.onclick = toggleLanguage;
  }
}

function toggleLanguage() {
  const lang = localStorage.getItem('trio_language') === 'EN' ? 'HI' : 'EN';
  localStorage.setItem('trio_language', lang);
  location.reload();
}

// ─── INIT ADMIN ─────────────────────────────────────────────────────────────
async async function initAdmin() {
  await loadActivities();
  setupTabs();
  setupActivityForm();
  setupTaskForm();
  setupUpload();
  setupModals();
  loadActivitiesForFilter();
}

// Get Firebase ID token for Worker API calls
async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

function setupTabs() {
  const tabs = [...document.querySelectorAll('.admin-tab')];
  const panels = [...document.querySelectorAll('.admin-panel')];
  const panelIds = { activities: 'panelActivities', 'create-activity': 'panelCreateActivity', tasks: 'panelTasks' };
  tabs.forEach(tab => {
    const panelId = panelIds[tab.dataset.tab];
    tab.setAttribute('aria-controls', panelId);
    tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
    tab.onclick = () => {
      const panel = $(panelId);
      if (!panel) return;
      tabs.forEach(t => {
        const selected = t === tab;
        t.classList.toggle('active', selected);
        t.setAttribute('aria-selected', String(selected));
        t.tabIndex = selected ? 0 : -1;
      });
      panels.forEach(p => p.classList.toggle('active', p === panel));
      if (tab.dataset.tab === 'tasks') loadTasks();
    };
  });
}

function setupTaskForm() {
  const activityPicker = $('taskActivityPicker');
  if (activityPicker) {
    populateTaskActivityPicker();
    if (!taskPickerBound) {
      activityPicker.addEventListener('change', () => { $('taskActivityId').value = activityPicker.value; });
      taskPickerBound = true;
    }
  }
  const preset = $('taskTemplate');
  if (!preset) return;
  const templates = {
    offline: ['Real-life Action','Complete one useful real-world action','Choose one small, safe action that helps you or your surroundings. Do it today and describe the concrete result.','Aaj ek chhota aur safe kaam karein jo aapki ya aas-paas ki madad kare. Phir uska result batayein.',600,25,'Check for a specific, plausible action and a concrete result. Do not require photos or private information.'],
    learning: ['Learning Sprint','Learn one concept and explain it','Study one concept, explain it in your own words, and give one example.','Ek concept padhein, apne shabdon mein samjhayen aur ek example dein.',900,30,'Check relevance, own reasoning, and a meaningful example.'],
    creative: ['Creative Build','Create a tiny original thing','Create a small sketch, paragraph, mini design, or code snippet. Explain one choice you made.','Ek chhoti original cheez banayein—sketch, paragraph, design ya code snippet. Apna ek choice samjhayen.',900,30,'Look for a concrete description of the creation. Do not claim to verify unseen work.'],
    reflection: ['Reflection','Reflect on one moment and one lesson','Think of one ordinary moment today. What happened, what did you learn, and what small step will you try next?','Aaj ke ek aam moment par sochein: kya hua, kya seekha aur agla chhota step kya hoga?',180,15,'Accept relevant reflection; do not require sensitive personal details.'],
    social: ['Social Connection','Make one thoughtful connection','Have a brief, respectful conversation or offer useful help. Respect boundaries and do not share names.','Kisi se respectful baat karein ya madad karein. Boundaries ka dhyan rakhein aur naam share na karein.',300,25,'Check for a specific, respectful interaction. Do not request other people’s private information.'],
    mindful: ['Mindful Reset','Take a calm screen-free pause','Pause for a few minutes, notice your surroundings, and choose one thing to return to with attention.','Kuch minute ruk kar aas-paas par dhyan dein aur phir ek kaam focus se karne ke liye chunein.',180,15,'Accept a relevant reflection without inferring mental-health status.'],
    planning: ['Planning','Plan the next small step','Write one goal, the next action, when you will do it, and one possible obstacle.','Ek goal, agla action, use kab karenge aur ek possible rukawat likhein.',300,20,'Check for a concrete action and realistic time or cue.'],
    observe: ['Observation','Notice three details','Observe a safe, ordinary place or object. Note three specific details and one pattern.','Kisi safe jagah ya object ko observe karein. Teen details aur ek pattern likhein.',180,15,'Check for three distinct observations. Avoid identifying strangers.'],
    habit: ['Habit Practice','Practice one tiny helpful habit','Choose a small helpful habit, do it once, and describe what helped you begin.','Ek chhoti helpful habit chunein, use ek baar karein aur batayein shuru kaise kiya.',300,20,'Check for a specific, safe habit and a plausible description.'],
    problem: ['Problem Solving','Solve one everyday problem','Pick a harmless everyday problem, list two possible solutions, choose one, and explain why.','Ek chhoti safe problem chunein, do solutions likhein, ek chunein aur wajah samjhayen.',600,25,'Check for a problem, two distinct options, and a reasoned choice.'],
    boss: ['Boss Task','Complete a mini-project','Break the challenge into 2–3 steps, complete what is feasible today, then report the outcome and next step.','Challenge ko 2–3 steps mein baantein, aaj jitna ho sake karein aur result aur next step batayein.',1200,50,'Look for planning, a concrete outcome, and a next step; do not imply incomplete work is complete.']
  };
  preset.addEventListener('change', () => {
    const p = templates[preset.value];
    if (!p) return;
    $('taskType').value = p[0]; $('taskTitle').value = p[1];
    $('taskDescription').value = p[2]; $('taskInstructionsEn').value = p[2];
    $('taskInstructionsHi').value = p[3]; $('taskMinTime').value = p[4];
    $('taskXp').value = p[5]; $('taskVerificationPrompt').value = p[6];
    $('taskTitle').focus();
  });
}

function setupActivityForm() {
  // Form submit handler is set up in setupModals()
  // This function exists to satisfy initAdmin() call
  // Additional form initialization can go here if needed
}

// ─── ACTIVITIES CRUD ────────────────────────────────────────────────────────
async function loadActivities() {
  activitiesList.innerHTML = '<div class="skeleton-stack" style="width:100%;"><div class="skeleton-card" style="height:120px; aspect-ratio:auto; border-radius:12px; margin-bottom:12px; background:linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 100%); background-size:200% 100%; animation:shimmer 1.5s infinite linear;"></div></div>'.repeat(3);
  
  try {
    const idToken = await getIdToken();
    const res = await fetch(`${WORKER_BASE}/api/admin/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ action: 'list' })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.message || payload?.error || `Supabase returned ${res.status}`);
    if (!Array.isArray(payload)) throw new Error('Unexpected activities response from Supabase');
    activitiesCache = payload;
    renderActivitiesList();
    loadActivitiesForFilter();
    populateTaskActivityPicker();
  } catch (err) {
    console.error('[Admin] Load activities error:', err);
    activitiesList.innerHTML = `<div class="task-box admin-empty-state" style="text-align:center" role="alert"><p class="admin-error-text">Failed to load activities: ${esc(err.message || 'Unknown error')}</p><button id="retryActivitiesBtn" type="button" class="btn secondary">Retry</button></div>`;
    $('retryActivitiesBtn')?.addEventListener('click', loadActivities);
  }
}

function renderActivitiesList() {
  if (!activitiesCache.length) {
    activitiesList.innerHTML = '<div class="task-box" style="text-align:center"><p style="color:var(--ink-dim)">No activities yet. Click "Create Activity" to add one.</p></div>';
    return;
  }
  
  activitiesList.innerHTML = activitiesCache.map(act => `
    <div class="task-list-item" data-id="${act.id}">
      <span class="task-order">${act.display_order || 0}</span>
      <div class="task-info">
        <div class="task-title">${act.icon || '⚡'} ${esc(act.title_en)}</div>
        <div class="task-meta">
          Category: ${esc(act.category)} | ${act.is_guest_allowed ? '🔓 Guest Allowed' : '🔒 Members Only'} | ${act.is_published ? '✅ Published' : '⏸️ Draft'}
          ${act.cover_image_url ? ' | 🖼️ Has Image' : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn secondary btn-sm edit-activity" data-id="${act.id}">✏️ Edit</button>
        <button class="btn secondary btn-sm delete-activity" data-id="${act.id}" style="color:var(--color-danger); border-color:var(--color-danger)">🗑️ Delete</button>
      </div>
    </div>
  `).join('');
  
  // Event listeners
  document.querySelectorAll('.edit-activity').forEach(btn => {
    btn.onclick = () => openActivityEditor(btn.dataset.id);
  });
  document.querySelectorAll('.delete-activity').forEach(btn => {
    btn.onclick = () => deleteActivity(btn.dataset.id);
  });
}

async function loadActivitiesForFilter() {
  const selected = filterActivity.value;
  filterActivity.innerHTML = '<option value="">All Activities</option>' +
    activitiesCache.map(act => `<option value="${act.id}">${esc(act.title_en || act.title || 'Untitled activity')}</option>`).join('');
  if (selected && activitiesCache.some(act => String(act.id) === selected)) filterActivity.value = selected;
  populateTaskActivityPicker();
}

function populateTaskActivityPicker() {
  const picker = $('taskActivityPicker');
  if (!picker) return;
  const selected = picker.value || $('taskActivityId')?.value || '';
  picker.innerHTML = '<option value="">Choose an activity…</option>' +
    activitiesCache.map(act => `<option value="${esc(String(act.id))}">${esc(act.title_en || act.title || 'Untitled activity')} · ${esc(act.category || '')}</option>`).join('');
  if (selected && activitiesCache.some(act => String(act.id) === String(selected))) picker.value = selected;
}

function openActivityEditor(activityId) {
  const act = activitiesCache.find(a => a.id === activityId);
  if (!act) return;
  
  editingActivityId = activityId;
  createActivityTitle.textContent = 'Edit Activity';
  activityForm.querySelector('button[type="submit"]').textContent = '💾 Update Activity';
  
  // Populate form with new column names
  $('activityId').value = act.id;
  $('actTitle').value = act.title_en;
  $('actCategory').value = act.category;
  $('actIcon').value = act.icon || '';
  $('actOrder').value = act.display_order || 0;
  $('actDescription').value = act.description_en || '';
  $('actDifficulty').value = act.difficulty || '';
  $('actXpReward').value = act.total_xp || '';
  $('actGuestAllowed').checked = act.is_guest_allowed || false;
  $('actActive').checked = act.is_published !== false;
  
  // Cover image
  if (act.cover_image_url) {
    $('actCoverUrl').value = act.cover_image_url;
    $('actCoverUrl').style.display = 'block';
    $('actCoverPreview').src = act.cover_image_url;
    $('actCoverPreview').hidden = false;
    $('actCoverUpload').classList.add('has-file');
    $('actCoverUpload .upload-text').innerHTML = '<strong>Image uploaded</strong><br><small>Click to replace</small>';
  } else {
    resetCoverUpload();
  }
  
  // Switch to create/edit panel
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="create-activity"]').classList.add('active');
  $('panelCreateActivity').classList.add('active');
}

function resetActivityForm() {
  editingActivityId = null;
  createActivityTitle.textContent = 'Create New Activity';
  activityForm.querySelector('button[type="submit"]').textContent = '💾 Save Activity';
  activityForm.reset();
  $('activityId').value = '';
  resetCoverUpload();
}

function resetCoverUpload() {
  $('actCoverUrl').value = '';
  $('actCoverUrl').style.display = 'none';
  $('actCoverPreview').hidden = true;
  $('actCoverPreview').src = '';
  $('actCoverUpload').classList.remove('has-file');
  $('actCoverUpload .upload-text').innerHTML = '<strong>Click or drag to upload</strong><br><small>Auto-optimized: f_auto,q_auto,c_fill,g_auto,w_800</small>';
}

async function saveActivity(e) {
  e.preventDefault();
  
  const formData = new FormData(activityForm);
  const data = {
    title_en: formData.get('title'),
    category: formData.get('category'),
    icon: formData.get('icon') || '⚡',
    display_order: parseInt(formData.get('order_index')) || 0,
    description_en: formData.get('description') || '',
    cover_image_url: formData.get('cover_image') || null,
    difficulty: formData.get('difficulty') || '',
    total_xp: parseInt(formData.get('xp_reward')) || 0,
    is_guest_allowed: formData.get('is_guest_allowed') === 'true',
    is_published: formData.get('is_active') === 'true',
    updated_at: new Date().toISOString()
  };
  
  const submitBtn = activityForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';
  
  try {
    const idToken = await getIdToken();
    const action = editingActivityId ? 'update' : 'create';
    const activityId = editingActivityId || '';
    
    const res = await fetch(`${WORKER_BASE}/api/admin/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ action, activityId, data })
    });
    
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to save activity');
    
    showToast(editingActivityId ? 'Activity updated!' : 'Activity created!');
    resetActivityForm();
    await loadActivities();
    loadActivitiesForFilter();
    
    // Switch back to list
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="activities"]').classList.add('active');
    $('panelActivities').classList.add('active');
    
  } catch (err) {
    console.error('[Admin] Save activity error:', err);
    alert('Failed to save: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingActivityId ? '💾 Update Activity' : '💾 Save Activity';
  }
}

async function deleteActivity(activityId) {
  if (!confirm('Delete this activity and all its tasks? This cannot be undone.')) return;
  
  try {
    const idToken = await getIdToken();
    
    const res = await fetch(`${WORKER_BASE}/api/admin/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ action: 'delete', activityId })
    });
    
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete activity');
    
    showToast('Activity deleted!');
    await loadActivities();
    loadActivitiesForFilter();
  } catch (err) {
    console.error('[Admin] Delete error:', err);
    alert('Failed to delete: ' + err.message);
  }
}

// ─── TASKS CRUD ─────────────────────────────────────────────────────────────
async function loadTasks() {
  const activityFilter = filterActivity.value;
  
  tasksList.innerHTML = '<div class="skeleton-stack" style="width:100%;"><div class="skeleton-card" style="height:100px; aspect-ratio:auto; border-radius:12px; margin-bottom:12px; background:linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 100%); background-size:200% 100%; animation:shimmer 1.5s infinite linear;"></div></div>'.repeat(3);
  
  try {
    const idToken = await getIdToken();
    const res = await fetch(`${WORKER_BASE}/api/admin/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ action: 'list', activityId: activityFilter || null })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.message || payload?.error || `Supabase returned ${res.status}`);
    if (!Array.isArray(payload)) throw new Error('Unexpected tasks response from Supabase');
    tasksCache = payload;
    renderTasksList();
  } catch (err) {
    console.error('[Admin] Load tasks error:', err);
    tasksList.innerHTML = `<div class="task-box admin-empty-state" style="text-align:center" role="alert"><p class="admin-error-text">Failed to load tasks: ${esc(err.message || 'Unknown error')}</p><button id="retryTasksBtn" type="button" class="btn secondary">Retry</button></div>`;
    $('retryTasksBtn')?.addEventListener('click', loadTasks);
  }
}

function renderTasksList() {
  if (!tasksCache.length) {
    tasksList.innerHTML = '<div class="task-box" style="text-align:center"><p style="color:var(--ink-dim)">No tasks yet. Click "Create Task" to add one.</p></div>';
    return;
  }
  
  tasksList.innerHTML = tasksCache.map(task => `
    <div class="task-list-item" data-id="${task.id}">
      <span class="task-order">${task.task_number}</span>
      <div class="task-info">
        <div class="task-title">${task.task_type || 'Task'}: ${esc(task.title_en)}</div>
        <div class="task-meta">
          Activity: ${esc(activitiesCache.find(act => String(act.id) === String(task.activity_id))?.title_en || activitiesCache.find(act => String(act.id) === String(task.activity_id))?.title || 'Activity')} | ${task.min_time_seconds ? `⏱️ ${task.min_time_seconds}s` : 'No timer'} | ⚡ ${task.xp_reward ?? 10} XP | ${task.verification_prompt ? '🤖 AI Verify' : '📝 Reflection check'} | ${task.is_published ? '✅ Published' : '⏸️ Draft'}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn secondary btn-sm edit-task" data-id="${task.id}">✏️ Edit</button>
        <button class="btn secondary btn-sm delete-task" data-id="${task.id}" style="color:var(--color-danger); border-color:var(--color-danger)">🗑️ Delete</button>
      </div>
    </div>
  `).join('');
  
  document.querySelectorAll('.edit-task').forEach(btn => {
    btn.onclick = () => openTaskEditor(btn.dataset.id);
  });
  document.querySelectorAll('.delete-task').forEach(btn => {
    btn.onclick = () => deleteTask(btn.dataset.id);
  });
}

function openTaskEditor(taskId) {
  const task = tasksCache.find(t => t.id === taskId);
  if (!task) return;
  
  editingTaskId = taskId;
  $('taskModalEyebrow').textContent = 'Edit Task';
  $('taskModalTitle').textContent = task.title_en;
  
  taskForm.reset();
  $('taskId').value = task.id;
  $('taskActivityId').value = task.activity_id;
  if ($('taskActivityPicker')) $('taskActivityPicker').value = task.activity_id;
  $('taskOrder').value = task.task_number;
  $('taskType').value = task.task_type || 'Action Step';
  $('taskTitle').value = task.title_en;
  $('taskDescription').value = task.description_en || '';
  $('taskInstructionsEn').value = task.instructions_en || '';
  $('taskInstructionsHi').value = task.instructions_hi || '';
  $('taskMinTime').value = task.min_time_seconds || 0;
  $('taskXp').value = task.xp_reward || 10;
  $('taskVerificationPrompt').value = task.verification_prompt || '';
  $('taskActive').checked = task.is_published !== false;
  
  taskModalReturnFocus = document.activeElement;
  taskModal.hidden = false;
  document.body.style.overflow = 'hidden';
  $('taskModalClose').focus();
}

function openNewTaskEditor(activityId = null) {
  editingTaskId = null;
  $('taskModalEyebrow').textContent = 'Create Task';
  $('taskModalTitle').textContent = 'New Task';
  
  taskForm.reset();
  $('taskId').value = '';
  $('taskActivityId').value = activityId || (filterActivity.value || '');
  if ($('taskActivityPicker')) $('taskActivityPicker').value = $('taskActivityId').value;
  $('taskOrder').value = 1;
  $('taskType').value = 'Action Step';
  $('taskActive').checked = true;
  
  taskModalReturnFocus = document.activeElement;
  taskModal.hidden = false;
  document.body.style.overflow = 'hidden';
  $('taskModalClose').focus();
}

function closeTaskModal() {
  taskModal.hidden = true;
  document.body.style.overflow = '';
  editingTaskId = null;
  if (taskModalReturnFocus && typeof taskModalReturnFocus.focus === 'function') taskModalReturnFocus.focus();
}

async function saveTask(e) {
  e.preventDefault();
  
  const formData = new FormData(taskForm);
  const activityIdValue = $('taskActivityPicker')?.value || formData.get('activity_id');
  if (!activityIdValue) { alert('Choose which activity this task belongs to.'); $('taskActivityPicker')?.focus(); return; }
  $('taskActivityId').value = activityIdValue;
  const data = {
    activity_id: activityIdValue,
    task_number: Math.max(1, parseInt(formData.get('task_number'), 10) || 1),
    task_type: formData.get('type') || 'Action Step',
    title_en: formData.get('title'),
    description_en: formData.get('description') || '',
    instructions_en: formData.get('instructions_en') || '',
    instructions_hi: formData.get('instructions_hi') || '',
    min_time_seconds: parseInt(formData.get('min_time_seconds')) || 0,
    xp_reward: parseInt(formData.get('xp_reward')) || 10,
    verification_prompt: formData.get('verification_prompt') || '',
    is_published: formData.get('is_active') === 'true',
    updated_at: new Date().toISOString()
  };
  
  const submitBtn = taskForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';
  
  try {
    const idToken = await getIdToken();
    const action = editingTaskId ? 'update' : 'create';
    const taskId = editingTaskId || '';
    
    const res = await fetch(`${WORKER_BASE}/api/admin/task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ action, taskId, data })
    });
    
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to save task');
    
    showToast(editingTaskId ? 'Task updated!' : 'Task created!');
    closeTaskModal();
    await loadTasks();
    
  } catch (err) {
    console.error('[Admin] Save task error:', err);
    alert('Failed to save: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Save Task';
  }
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task? This cannot be undone.')) return;
  
  try {
    const idToken = await getIdToken();
    
    const res = await fetch(`${WORKER_BASE}/api/admin/task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ action: 'delete', taskId })
    });
    
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete task');
    
    showToast('Task deleted!');
    await loadTasks();
  } catch (err) {
    console.error('[Admin] Delete task error:', err);
    alert('Failed to delete: ' + err.message);
  }
}

// ─── CLOUDINARY UPLOAD ──────────────────────────────────────────────────────
function setupUpload() {
  const uploadArea = $('actCoverUpload');
  const fileInput = $('actCoverFile');
  const urlInput = $('actCoverUrl');
  const preview = $('actCoverPreview');
  
  uploadArea.onclick = () => fileInput.click();
  uploadArea.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } };
  uploadArea.ondragover = e => { e.preventDefault(); uploadArea.classList.add('dragover'); };
  uploadArea.ondragleave = () => uploadArea.classList.remove('dragover');
  uploadArea.ondrop = e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
  };
  
  fileInput.onchange = e => {
    if (e.target.files[0]) handleFileUpload(e.target.files[0]);
  };
  
  async function handleFileUpload(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large (max 10MB)');
      return;
    }
    
    uploadArea.classList.add('has-file');
    uploadArea.querySelector('.upload-text').innerHTML = '<strong>Uploading...</strong>';
    
    try {
      // Get signed upload URL from Worker
      const idToken = await currentUser.getIdToken();
      const signRes = await fetch(`${WORKER_BASE}/api/admin/cloudinary-sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ folder: 'trio/activities', filename: file.name })
      });
      
      if (!signRes.ok) throw new Error('Failed to get signed URL');
      const { uploadUrl, signature, timestamp, apiKey, publicId, folder = 'trio/activities' } = await signRes.json();
      if (!uploadUrl || !signature || !timestamp || !apiKey || !publicId) throw new Error('Upload signing response is incomplete. Check the Cloudinary Worker configuration.');
      
      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', folder);
      formData.append('public_id', publicId);
      
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadRes.ok) throw new Error('Cloudinary upload failed');
      const result = await uploadRes.json();
      
      // Set the optimized URL
      const optimizedUrl = String(result.secure_url || '').replace('/image/upload/', '/image/upload/f_auto,q_auto,c_fill,g_auto,w_800/');
      if (!optimizedUrl) throw new Error('Cloudinary did not return a secure image URL.');
      urlInput.value = optimizedUrl;
      urlInput.style.display = 'block';
      preview.src = optimizedUrl;
      preview.hidden = false;
      uploadArea.querySelector('.upload-text').innerHTML = '<strong>Uploaded successfully!</strong><br><small>Click to replace</small>';
      showToast('Image uploaded & optimized!');
      
    } catch (err) {
      console.error('[Admin] Upload error:', err);
      uploadArea.classList.remove('has-file');
      uploadArea.querySelector('.upload-text').innerHTML = '<strong>Upload failed</strong><br><small>Click to retry</small>';
      alert('Upload failed: ' + err.message);
    }
  }
}

// ─── MODALS ─────────────────────────────────────────────────────────────────
function setupModals() {
  $('taskModalClose').onclick = closeTaskModal;
  taskModal.onclick = e => { if (e.target === taskModal) closeTaskModal(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !taskModal.hidden) closeTaskModal(); });
  $('cancelTask').onclick = closeTaskModal;
  $('cancelActivity').onclick = resetActivityForm;
  $('createTaskBtn').onclick = () => openNewTaskEditor(filterActivity.value || null);
  $('refreshActivities').onclick = loadActivities;
  
  // Activity form submit
  activityForm.onsubmit = saveActivity;
  
  // Task form submit
  taskForm.onsubmit = saveTask;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'lang-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 2500);
}