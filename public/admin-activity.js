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

const SUPABASE_URL = 'https://vccypxwiqcuexxrhtgyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zJvP50wf3CW2PNfkOD9yCQ_ffFhsZEp';
const WORKER_BASE = 'https://trio-day.trioday-nikhil.workers.dev';
const ADMIN_EMAILS = ['nikhilkumar210h@gmail.com', 'nikhilkumar45374@gmail.com'];
const CLOUDINARY_CLOUD_NAME = 'your-cloud-name'; // TODO: Update with actual Cloudinary cloud name
const CLOUDINARY_UPLOAD_PRESET = 'trio_activities'; // TODO: Create unsigned upload preset

let currentUser = null;
let isAdmin = false;
let activitiesCache = [];
let tasksCache = [];
let editingActivityId = null;
let editingTaskId = null;

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
    initAdmin();
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
  }
}

// ─── INIT ADMIN ─────────────────────────────────────────────────────────────
async function initAdmin() {
  await loadActivities();
  setupTabs();
  setupActivityForm();
  setupTaskForm();
  setupUpload();
  setupModals();
  loadActivitiesForFilter();
}

function setupTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(`panel${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`).classList.add('active');
      
      if (tab.dataset.tab === 'tasks') loadTasks();
    };
  });
}

// ─── ACTIVITIES CRUD ────────────────────────────────────────────────────────
async function loadActivities() {
  activitiesList.innerHTML = '<div class="skeleton-stack" style="width:100%;"><div class="skeleton-card" style="height:120px; aspect-ratio:auto; border-radius:12px; margin-bottom:12px; background:linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 100%); background-size:200% 100%; animation:shimmer 1.5s infinite linear;"></div></div>'.repeat(3);
  
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/activities?select=*&order=order_index.asc`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    activitiesCache = await res.json();
    renderActivitiesList();
  } catch (err) {
    console.error('[Admin] Load activities error:', err);
    activitiesList.innerHTML = `<div class="task-box" style="text-align:center"><p style="color:var(--color-danger)">Failed to load activities</p><button class="btn secondary" onclick="loadActivities()">Retry</button></div>`;
  }
}

function renderActivitiesList() {
  if (!activitiesCache.length) {
    activitiesList.innerHTML = '<div class="task-box" style="text-align:center"><p style="color:var(--ink-dim)">No activities yet. Click "Create Activity" to add one.</p></div>';
    return;
  }
  
  activitiesList.innerHTML = activitiesCache.map(act => `
    <div class="task-list-item" data-id="${act.id}">
      <span class="task-order">${act.order_index || 0}</span>
      <div class="task-info">
        <div class="task-title">${act.icon || '⚡'} ${esc(act.title)}</div>
        <div class="task-meta">
          Category: ${esc(act.category)} | ${act.is_guest_allowed ? '🔓 Guest Allowed' : '🔒 Members Only'} | ${act.is_active ? '✅ Active' : '⏸️ Inactive'}
          ${act.cover_image ? ' | 🖼️ Has Image' : ''}
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
  filterActivity.innerHTML = '<option value="">All Activities</option>' + 
    activitiesCache.map(act => `<option value="${act.id}">${esc(act.title)}</option>`).join('');
}

function openActivityEditor(activityId) {
  const act = activitiesCache.find(a => a.id === activityId);
  if (!act) return;
  
  editingActivityId = activityId;
  createActivityTitle.textContent = 'Edit Activity';
  activityForm.querySelector('button[type="submit"]').textContent = '💾 Update Activity';
  
  // Populate form
  $('activityId').value = act.id;
  $('actTitle').value = act.title;
  $('actCategory').value = act.category;
  $('actIcon').value = act.icon || '';
  $('actOrder').value = act.order_index || 0;
  $('actDescription').value = act.description || '';
  $('actDifficulty').value = act.difficulty || '';
  $('actXpReward').value = act.xp_reward || '';
  $('actGuestAllowed').checked = act.is_guest_allowed || false;
  $('actActive').checked = act.is_active !== false;
  
  // Cover image
  if (act.cover_image) {
    $('actCoverUrl').value = act.cover_image;
    $('actCoverUrl').style.display = 'block';
    $('actCoverPreview').src = act.cover_image;
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
    title: formData.get('title'),
    category: formData.get('category'),
    icon: formData.get('icon') || '⚡',
    order_index: parseInt(formData.get('order_index')) || 0,
    description: formData.get('description') || '',
    cover_image: formData.get('cover_image') || null,
    difficulty: formData.get('difficulty') || '',
    xp_reward: formData.get('xp_reward') || '',
    is_guest_allowed: formData.get('is_guest_allowed') === 'true',
    is_active: formData.get('is_active') === 'true',
    updated_at: new Date().toISOString()
  };
  
  const submitBtn = activityForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';
  
  try {
    let res;
    if (editingActivityId) {
      res = await fetch(`${SUPABASE_URL}/rest/v1/activities?id=eq.${editingActivityId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
      });
    } else {
      data.created_at = new Date().toISOString();
      res = await fetch(`${SUPABASE_URL}/rest/v1/activities`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
      });
    }
    
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    
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
    // Delete tasks first
    await fetch(`${SUPABASE_URL}/rest/v1/tasks?activity_id=eq.${activityId}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    
    // Delete activity
    const res = await fetch(`${SUPABASE_URL}/rest/v1/activities?id=eq.${activityId}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    
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
  let url = `${SUPABASE_URL}/rest/v1/tasks?select=*,activities(title)&order=activity_id.asc,order_index.asc`;
  if (activityFilter) url += `&activity_id=eq.${activityFilter}`;
  
  tasksList.innerHTML = '<div class="skeleton-stack" style="width:100%;"><div class="skeleton-card" style="height:100px; aspect-ratio:auto; border-radius:12px; margin-bottom:12px; background:linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 100%); background-size:200% 100%; animation:shimmer 1.5s infinite linear;"></div></div>'.repeat(3);
  
  try {
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    tasksCache = await res.json();
    renderTasksList();
  } catch (err) {
    console.error('[Admin] Load tasks error:', err);
    tasksList.innerHTML = `<div class="task-box" style="text-align:center"><p style="color:var(--color-danger)">Failed to load tasks</p><button class="btn secondary" onclick="loadTasks()">Retry</button></div>`;
  }
}

function renderTasksList() {
  if (!tasksCache.length) {
    tasksList.innerHTML = '<div class="task-box" style="text-align:center"><p style="color:var(--ink-dim)">No tasks yet. Click "Create Task" to add one.</p></div>';
    return;
  }
  
  tasksList.innerHTML = tasksCache.map(task => `
    <div class="task-list-item" data-id="${task.id}">
      <span class="task-order">${task.order_index}</span>
      <div class="task-info">
        <div class="task-title">${task.type || 'Task'}: ${esc(task.title)}</div>
        <div class="task-meta">
          Activity: ${esc(task.activities?.title || 'Unknown')} | ${task.min_time_seconds ? `⏱️ ${task.min_time_seconds}s` : 'No timer'} | ⚡ ${task.xp_reward} XP | ${task.verification_prompt ? '🤖 AI Verify' : '✅ Auto-approve'} | ${task.is_active ? '✅ Active' : '⏸️ Inactive'}
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
  $('taskModalTitle').textContent = task.title;
  
  taskForm.reset();
  $('taskId').value = task.id;
  $('taskActivityId').value = task.activity_id;
  $('taskOrder').value = task.order_index;
  $('taskType').value = task.type || 'Action Step';
  $('taskTitle').value = task.title;
  $('taskDescription').value = task.description || '';
  $('taskInstructionsEn').value = task.instructions_en || '';
  $('taskInstructionsHi').value = task.instructions_hi || '';
  $('taskMinTime').value = task.min_time_seconds || 0;
  $('taskXp').value = task.xp_reward || 10;
  $('taskVerificationPrompt').value = task.verification_prompt || '';
  $('taskActive').checked = task.is_active !== false;
  
  taskModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function openNewTaskEditor(activityId = null) {
  editingTaskId = null;
  $('taskModalEyebrow').textContent = 'Create Task';
  $('taskModalTitle').textContent = 'New Task';
  
  taskForm.reset();
  $('taskId').value = '';
  $('taskActivityId').value = activityId || (filterActivity.value || '');
  $('taskOrder').value = 1;
  $('taskType').value = 'Action Step';
  $('taskActive').checked = true;
  
  taskModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeTaskModal() {
  taskModal.hidden = true;
  document.body.style.overflow = '';
  editingTaskId = null;
}

async function saveTask(e) {
  e.preventDefault();
  
  const formData = new FormData(taskForm);
  const data = {
    activity_id: formData.get('activity_id'),
    order_index: parseInt(formData.get('order_index')) || 1,
    type: formData.get('type') || 'Action Step',
    title: formData.get('title'),
    description: formData.get('description') || '',
    instructions_en: formData.get('instructions_en') || '',
    instructions_hi: formData.get('instructions_hi') || '',
    min_time_seconds: parseInt(formData.get('min_time_seconds')) || 0,
    xp_reward: parseInt(formData.get('xp_reward')) || 10,
    verification_prompt: formData.get('verification_prompt') || '',
    is_active: formData.get('is_active') === 'true',
    updated_at: new Date().toISOString()
  };
  
  const submitBtn = taskForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';
  
  try {
    let res;
    if (editingTaskId) {
      res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${editingTaskId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
      });
    } else {
      data.created_at = new Date().toISOString();
      res = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
      });
    }
    
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    
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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${taskId}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    
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
      const { uploadUrl, signature, timestamp, apiKey, publicId } = await signRes.json();
      
      // Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', 'trio/activities');
      formData.append('public_id', publicId);
      formData.append('transformation', 'f_auto,q_auto,c_fill,g_auto,w_800');
      
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadRes.ok) throw new Error('Cloudinary upload failed');
      const result = await uploadRes.json();
      
      // Set the optimized URL
      const optimizedUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,c_fill,g_auto,w_800/${result.public_id}`;
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