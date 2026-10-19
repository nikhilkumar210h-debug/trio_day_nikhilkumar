/**
 * activity-player.js — Trio Day Activity Task Player
 * 
 * Handles:
 * - Fetch activity & tasks from Supabase
 * - Step-by-step task progression with progress bar
 * - Min-time timer per task (countdown)
 * - Proof/Reflection text input with character count
 * - AI Verification via Cloudflare Worker (/api/activity/complete-task)
 * - Skip task (0 XP) → next task
 * - Guest limit enforcement (3 tasks max)
 * - Login modal trigger + XP sync on login
 * - Completion screen with total XP earned
 */

import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, increment, collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { SoundManager } from './sound-manager.js';
import { escapeHtml as esc, cloudinaryAutoUrl } from './utils.js';
import { setAdminFlag } from './ui/nav.js';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://vccypxwiqcuexxrhtgyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zJvP50wf3CW2PNfkOD9yCQ_ffFhsZEp';
const WORKER_BASE = 'https://trio-day.trioday-nikhil.workers.dev'; // Update for local dev
const ADMIN_EMAILS = ['nikhilkumar210h@gmail.com', 'nikhilkumar45374@gmail.com'];

const GUEST_TASK_LIMIT = 3;

// Supabase column mapping for real schema
const ACTIVITY_SELECT = 'id,display_order,category,title_en,title_hi,description_en,description_hi,difficulty,total_xp,cover_image_url,is_guest_allowed,is_published,created_at';
const TASK_SELECT = 'id,activity_id,task_number,task_type,title_en,title_hi,instructions_en,instructions_hi,verification_prompt,min_time_seconds,xp_reward';

// ─── STATE ──────────────────────────────────────────────────────────────────
let currentUser = null;
let userProfile = null;
let isAdmin = false;
let activityId = null;
let activityData = null;
let tasks = [];
let currentTaskIndex = 0;
let taskTimerInterval = null;
let taskStartTime = null;
let taskTimeRemaining = 0;
let isTimerRunning = false;
let guestTasksPlayed = 0;
let totalXpEarned = 0;
let currentLanguage = 'EN';

// ─── DOM ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const loadingState = $('loadingState');
const taskPlayer = $('taskPlayer');
const taskBox = $('taskBox');
const completionScreen = $('completionScreen');
const guestLimitScreen = $('guestLimitScreen');
const activityHeader = $('activityHeader');
const progressTrack = $('progressTrack');
const progressFill = $('progressFill');
const playerCatName = $('playerCatName');
const currTaskNum = $('currTaskNum');
const totalTaskNum = $('totalTaskNum');
const taskTypeBadge = $('taskTypeBadge');
const taskXpBadge = $('taskXpBadge');
const taskTitle = $('taskTitle');
const taskDetail = $('taskDetail');
const timerContainer = $('timerContainer');
const timerDisplay = $('timerDisplay');
const proofInputWrapper = $('proofInputWrapper');
const proofLabel = $('proofLabel');
const proofTextarea = $('proofTextarea');
const charCount = $('charCount');
const btnSkip = $('btnSkip');
const btnComplete = $('btnComplete');
const finalWeeklyXp = $('finalWeeklyXp');
const totalXpEarnedEl = $('totalXpEarned');
const loginModal = $('loginModal');
const guestXpDisplay = $('guestXpDisplay');

// ─── TRANSLATIONS ───────────────────────────────────────────────────────────
const TRANSLATIONS = {
  EN: {
    task_complete: 'Complete Task & Claim XP',
    task_skip: 'Skip Task (0 XP)',
    timer_min: 'min',
    timer_sec: 'sec',
    proof_placeholder: 'Describe what you did, paste a link, or share your reflection...',
    proof_label: 'Your Proof / Reflection',
    completed: 'Mission Accomplished!',
    xp_earned: 'XP Earned',
    guest_limit: '3/3 Free Tasks Completed!',
    guest_msg: 'You\'ve used your demo quota. Login to save your XP, unlock custom goals, and access all activities.',
    verifying: 'Verifying with AI...',
    verified: 'Verified! XP awarded.',
    verification_failed: 'AI verification failed. Please provide a genuine response.',
    error_generic: 'Something went wrong. Please try again.',
    login_save: 'Login to Save XP',
  },
  HI: {
    task_complete: 'Task Complete Karke XP Claim Karein',
    task_skip: 'Skip Karein (0 XP)',
    timer_min: 'मिनट',
    timer_sec: 'सेकंड',
    proof_placeholder: 'Aapne kya kiya, link paste karein, ya apna reflection share karein...',
    proof_label: 'Aapka Proof / Reflection',
    completed: 'Mission Poora Hua!',
    xp_earned: 'XP Mila',
    guest_limit: '3/3 Free Tasks Pure Hue!',
    guest_msg: 'Aapna demo quota pura ho gaya. Apna XP save karne aur saare activities unlock karne ke liye login karein.',
    verifying: 'AI se verify ho raha hai...',
    verified: 'Verified! XP mil gaya.',
    verification_failed: 'AI verification failed. Please provide a genuine response.',
    error_generic: 'Kuch galat hua. Please try again.',
    login_save: 'XP Save Karne Login Karein',
  }
};

function t(key) {
  return TRANSLATIONS[currentLanguage][key] || key;
}

// ─── INIT ───────────────────────────────────────────────────────────────────
SoundManager.init();
currentLanguage = localStorage.getItem('trio_language') || 'EN';
guestTasksPlayed = parseInt(localStorage.getItem('trio_guest_tasks') || '0', 10);
document.documentElement.setAttribute('data-lang', currentLanguage);

// Parse activity ID from URL
const urlParams = new URLSearchParams(window.location.search);
activityId = urlParams.get('act');

if (!activityId) {
  showError('No activity specified');
  setTimeout(() => location.href = 'index.html', 2000);
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      userProfile = userDoc.exists() ? userDoc.data() : null;
      isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase());
      setAdminFlag(isAdmin);
    } catch (err) {
      console.error('[ActivityPlayer] Auth error:', err);
    }
  } else {
    isAdmin = false;
    setAdminFlag(false);
    userProfile = null;
  }
  renderAuthStatus();
  await loadActivity();
});

// ─── AUTH STATUS ────────────────────────────────────────────────────────────
function renderAuthStatus() {
  const authStatus = $('authStatus');
  if (!authStatus) return;
  
  if (currentUser) {
    const name = userProfile?.displayName || userProfile?.name || currentUser.displayName || 'You';
    const initial = name.trim().charAt(0).toUpperCase();
    const photo = userProfile?.photoURL || currentUser.photoURL;
    
    authStatus.innerHTML = `
      <span class="streak-badge">🔥 ${userProfile?.streakCurrent || 0}d Streak</span>
      <a href="leaderboard.html" class="status-badge">${t('rank_btn') || '🏆 Leaderboard'}</a>
      <span class="xp-badge-nav">⚡ ${userProfile?.weeklyXp || 0} XP</span>
      <button id="langToggleBtn" class="lang-toggle" aria-label="Language">${currentLanguage}</button>
      <div style="position:relative">
        <button id="profileAvatarBtn" class="profile-pic-btn" aria-label="Profile" style="background:none;border:none;padding:0;cursor:pointer">
          ${photo ? `<img src="${cloudinaryAutoUrl(esc(photo))}" alt="" style="width:42px;height:42px;border-radius:50%;border:2px solid #00FFCC;object-fit:cover">` : `<div class="profile-pic-placeholder" style="width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#8B5CF6,#00FFCC);color:#05070B;font-weight:900;font-size:16px;border:2px solid #00FFCC">${esc(initial)}</div>`}
        </button>
      </div>
    `;
    
    const avatarBtn = $('profileAvatarBtn');
    if (avatarBtn) avatarBtn.onclick = () => location.href = 'profile.html';
    const langBtn = $('langToggleBtn');
    if (langBtn) langBtn.onclick = toggleLanguage;
    
  } else {
    const remaining = Math.max(0, GUEST_TASK_LIMIT - guestTasksPlayed);
    authStatus.innerHTML = `
      <span class="streak-badge">🔥 0d Streak</span>
      <a href="leaderboard.html" class="status-badge">${t('rank_btn') || '🏆 Leaderboard'}</a>
      <span class="xp-badge-nav">⚡ 0 XP</span>
      <button id="langToggleBtn" class="lang-toggle" aria-label="Language">${currentLanguage}</button>
      <a href="login.html" class="status-badge">🔑 Login (${remaining}/${GUEST_TASK_LIMIT} Free Tasks)</a>
      <a href="login.html"><img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80" alt="Profile" class="profile-pic" style="width:42px;height:42px;border-radius:50%;border:2px solid #00FFCC;object-fit:cover"></a>
    `;
    
    const langBtn = $('langToggleBtn');
    if (langBtn) langBtn.onclick = toggleLanguage;
  }
}

function toggleLanguage() {
  currentLanguage = currentLanguage === 'EN' ? 'HI' : 'EN';
  localStorage.setItem('trio_language', currentLanguage);
  document.documentElement.setAttribute('data-lang', currentLanguage);
  location.reload(); // Simple and reliable - full page reload for language change
}

function reRenderUI() {
  if (!taskPlayer.hidden) renderCurrentTask();
  if (!completionScreen.hidden) renderCompletion();
  if (!guestLimitScreen.hidden) renderGuestLimit();
}

// ─── LOAD ACTIVITY ──────────────────────────────────────────────────────────
async function loadActivity() {
  try {
    // Fetch activity from Supabase
    const actRes = await fetch(`${SUPABASE_URL}/rest/v1/activities?id=eq.${activityId}&select=${ACTIVITY_SELECT}&is_published=eq.true`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    const actData = await actRes.json();
    if (!actData.length) throw new Error('Activity not found');
    activityData = actData[0];
    
    // Fetch tasks - explicitly list columns, NEVER select=* (verification_prompt is hidden from anon)
    const taskRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks?activity_id=eq.${activityId}&is_published=eq.true&select=${TASK_SELECT}&order=task_number.asc`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    tasks = await taskRes.json();
    
    if (!tasks.length) throw new Error('No tasks found');
    
    // Setup UI - use title_en/title_hi based on language
    const actTitle = currentLanguage === 'HI' ? (activityData.title_hi || activityData.title_en) : activityData.title_en;
    playerCatName.textContent = `${activityData.icon || '⚡'} ${actTitle}`;
    totalTaskNum.textContent = tasks.length;
    activityHeader.hidden = false;
    progressTrack.hidden = false;
    
    loadingState.hidden = true;
    renderCurrentTask();
    
  } catch (err) {
    console.error('[ActivityPlayer] Load error:', err);
    showError(err.message);
  }
}

// ─── RENDER CURRENT TASK ────────────────────────────────────────────────────
function renderCurrentTask() {
  if (currentTaskIndex >= tasks.length) {
    showCompletion();
    return;
  }
  
  const task = tasks[currentTaskIndex];
  const progressPct = Math.round((currentTaskIndex / tasks.length) * 100);
  
  // Update progress
  progressFill.style.width = `${progressPct}%`;
  currTaskNum.textContent = currentTaskIndex + 1;
  
  // Task content - use title_en/title_hi based on language
  const taskTitleText = currentLanguage === 'HI' ? (task.title_hi || task.title_en) : task.title_en;
  const taskDescription = task.description_en || '';
  const taskInstructions = currentLanguage === 'HI' ? (task.instructions_hi || task.instructions_en) : task.instructions_en;
  const taskBrief = [taskDescription, taskInstructions].filter(Boolean).join('\n\n');

  taskTypeBadge.textContent = `🧩 ${task.task_type || 'Task'}`;
  taskXpBadge.textContent = `⚡ +${task.xp_reward || 10} XP`;
  taskTitle.textContent = taskTitleText;
  taskDetail.textContent = taskBrief;
  
  // Timer and proof input
  setupTimer(task.min_time_seconds || 0);
  proofInputWrapper.hidden = false;
  proofLabel.textContent = t('proof_label');
  proofTextarea.placeholder = t('proof_placeholder');
  proofTextarea.value = '';
  updateCharCount();
  
  // Buttons
  btnSkip.textContent = t('task_skip');
  btnComplete.textContent = t('task_complete');
  // setupTimer controls whether completion is enabled while a minimum timer is running.
  btnSkip.disabled = false;
  
  // Event listeners
  btnComplete.onclick = () => handleComplete(task);
  btnSkip.onclick = () => handleSkip();
  proofTextarea.oninput = updateCharCount;
  
  // Show player
  taskPlayer.hidden = false;
  completionScreen.hidden = true;
  guestLimitScreen.hidden = true;
}

function updateCharCount() {
  const len = proofTextarea.value.length;
  const max = 2000;
  charCount.textContent = `${len} / ${max} characters`;
  charCount.className = 'char-count';
  if (len > max * 0.9) charCount.classList.add('danger');
  else if (len > max * 0.7) charCount.classList.add('warning');
}

// ─── TIMER ──────────────────────────────────────────────────────────────────
function setupTimer(minSeconds) {
  if (taskTimerInterval) clearInterval(taskTimerInterval);
  timerContainer.classList.remove('warning', 'danger', 'is-running');

  if (minSeconds > 0) {
    taskTimeRemaining = minSeconds;
    taskStartTime = Date.now();
    isTimerRunning = true;
    timerContainer.hidden = false;
    timerContainer.classList.add('is-running');
    btnComplete.disabled = true;
    btnComplete.title = 'Wait for the minimum task time to finish';
    updateTimerDisplay();

    taskTimerInterval = setInterval(() => {
      taskTimeRemaining = Math.max(0, taskTimeRemaining - 1);
      updateTimerDisplay();

      if (taskTimeRemaining <= 0) {
        clearInterval(taskTimerInterval);
        isTimerRunning = false;
        timerContainer.classList.remove('is-running', 'warning');
        timerContainer.classList.add('danger');
        btnComplete.disabled = false;
        btnComplete.removeAttribute('title');
      } else if (taskTimeRemaining <= 30) {
        timerContainer.classList.add('warning');
        timerContainer.classList.remove('danger');
      }
    }, 1000);
  } else {
    timerContainer.hidden = true;
    isTimerRunning = false;
    btnComplete.disabled = false;
    btnComplete.removeAttribute('title');
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(taskTimeRemaining / 60);
  const secs = taskTimeRemaining % 60;
  timerDisplay.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
}

// ─── HANDLE COMPLETE ────────────────────────────────────────────────────────
async function handleComplete(task) {
  const proof = proofTextarea.value.trim();
  
  if (!proof) {
    alert('Please provide your proof/reflection before completing.');
    proofTextarea.focus();
    return;
  }
  
  if (currentUser) {
    // Logged-in: Call Worker API for AI verification
    btnComplete.disabled = true;
    btnComplete.textContent = t('verifying');
    
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${WORKER_BASE}/api/activity/complete-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          activityId,
          taskId: task.id,
          taskNumber: task.task_number,
          proof,
          timeSpent: taskStartTime ? Math.floor((Date.now() - taskStartTime) / 1000) : 0
        })
      });
      
      const result = await res.json();

      if (!res.ok || result.ok === false) {
        throw new Error(result.error || t('verification_failed'));
      }

      // Reflect only the amount the server actually awarded (0 for an idempotent retry).
      totalXpEarned += Math.max(0, Number(result.awarded ?? result.xpAwarded ?? 0) || 0);
      showToast(result.alreadyAwarded ? 'This task was already counted.' : t('verified'));
      
    } catch (err) {
      console.error('[ActivityPlayer] Complete error:', err);
      btnComplete.disabled = false;
      btnComplete.textContent = t('task_complete');
      alert(err.message || t('error_generic'));
      return;
    }
  } else {
    // Guest: Local tracking
    totalXpEarned += task.xp_reward || 10;
    guestTasksPlayed++;
    localStorage.setItem('trio_guest_tasks', guestTasksPlayed.toString());
    localStorage.setItem('trio_guest_xp', totalXpEarned.toString());
    
    if (guestTasksPlayed >= GUEST_TASK_LIMIT) {
      showGuestLimit();
      return;
    }
  }
  
  // Move to next task
  currentTaskIndex++;
  if (taskTimerInterval) clearInterval(taskTimerInterval);
  renderCurrentTask();
}

// ─── HANDLE SKIP ────────────────────────────────────────────────────────────
async function handleSkip() {
  const task = tasks[currentTaskIndex];
  if (!task) return;
  if (taskTimerInterval) clearInterval(taskTimerInterval);

  if (currentUser) {
    btnSkip.disabled = true;
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch(`${WORKER_BASE}/api/activity/skip-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ activityId, taskId: task.id, taskNumber: task.task_number })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.ok === false) throw new Error(result.error || 'Skip could not be saved. Please try again.');
    } catch (err) {
      console.warn('[ActivityPlayer] Skip API failed:', err);
      alert(err.message || 'Skip could not be saved. Please try again.');
      btnSkip.disabled = false;
      setupTimer(task.min_time_seconds || 0);
      return;
    }
  } else {
    guestTasksPlayed++;
    localStorage.setItem('trio_guest_tasks', guestTasksPlayed.toString());
    
    if (guestTasksPlayed >= GUEST_TASK_LIMIT) {
      showGuestLimit();
      return;
    }
  }
  
  currentTaskIndex++;
  renderCurrentTask();
}

// ─── COMPLETION SCREEN ──────────────────────────────────────────────────────
function showCompletion() {
  taskPlayer.hidden = true;
  completionScreen.hidden = false;
  progressFill.style.width = '100%';
  
  totalXpEarnedEl.textContent = `+${totalXpEarned} ${t('xp_earned')}`;
  
  if (currentUser && userProfile) {
    finalWeeklyXp.textContent = (userProfile.weeklyXp || 0) + totalXpEarned;
  } else {
    finalWeeklyXp.textContent = totalXpEarned;
  }
  
  SoundManager.play('success');
}

function renderCompletion() {
  totalXpEarnedEl.textContent = `+${totalXpEarned} ${t('xp_earned')}`;
  if (currentUser && userProfile) {
    finalWeeklyXp.textContent = (userProfile.weeklyXp || 0) + totalXpEarned;
  } else {
    finalWeeklyXp.textContent = totalXpEarned;
  }
}

// ─── GUEST LIMIT ────────────────────────────────────────────────────────────
function showGuestLimit() {
  taskPlayer.hidden = true;
  completionScreen.hidden = true;
  guestLimitScreen.hidden = false;
  
  guestLimitScreen.innerHTML = `
    <div class="task-box" style="text-align:center; max-width:500px; margin:20px auto;">
      <span class="tag-pill">🔒 Guest Trial Completed</span>
      <h2 style="color:#00FFCC; margin:18px 0 12px;">${t('guest_limit')}</h2>
      <p style="color:#CBD5E1; font-size:16px; line-height:1.6;">${t('guest_msg')}</p>
      <button id="guestLoginBtn" class="btn-task btn-complete" style="margin-top:16px; width:100%">${t('login_save')}</button>
    </div>
  `;
  
  $('guestLoginBtn').onclick = showLoginModal;
}

function renderGuestLimit() {
  showGuestLimit();
}

// ─── LOGIN MODAL ────────────────────────────────────────────────────────────
function showLoginModal() {
  guestXpDisplay.textContent = totalXpEarned;
  loginModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function hideLoginModal() {
  loginModal.hidden = true;
  document.body.style.overflow = '';
  loginForm.reset();
  signupForm.reset();
  $('loginError').style.display = 'none';
  $('signupError').style.display = 'none';
}

loginModal.querySelector('#loginModalClose').onclick = hideLoginModal;
loginModal.onclick = e => { if (e.target === loginModal) hideLoginModal(); };

loginModal.querySelectorAll('.modal-tab').forEach(tab => {
  tab.onclick = () => {
    loginModal.querySelectorAll('.modal-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    loginModal.querySelectorAll('.modal-panel').forEach(p => p.hidden = true);
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    loginModal.querySelector(`#${tab.dataset.tab}TabPanel`).hidden = false;
  };
});

const loginForm = loginModal.querySelector('#loginForm');
const signupForm = loginModal.querySelector('#signupForm');
const loginError = loginModal.querySelector('#loginError');
const signupError = loginModal.querySelector('#signupError');

loginForm.onsubmit = async e => {
  e.preventDefault();
  loginError.style.display = 'none';
  try {
    await auth.signInWithEmailAndPassword(loginForm.querySelector('#loginEmail').value, loginForm.querySelector('#loginPassword').value);
    hideLoginModal();
    // After login, reload to sync XP
    location.reload();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.style.display = 'block';
  }
};

signupForm.onsubmit = async e => {
  e.preventDefault();
  signupError.style.display = 'none';
  try {
    const cred = await auth.createUserWithEmailAndPassword(signupForm.querySelector('#signupEmail').value, signupForm.querySelector('#signupPassword').value);
    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName: signupForm.querySelector('#signupName').value,
      email: signupForm.querySelector('#signupEmail').value,
      weeklyXp: totalXpEarned,
      xp: totalXpEarned,
      streakCurrent: 0,
      onboardingComplete: false,
      createdAt: serverTimestamp()
    });
    hideLoginModal();
    location.reload();
  } catch (err) {
    signupError.textContent = err.message;
    signupError.style.display = 'block';
  }
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
function showError(msg) {
  loadingState.innerHTML = `
    <div class="task-box" style="text-align:center">
      <p style="color:var(--color-danger)">${esc(msg)}</p>
      <button class="btn secondary" onclick="location.reload()">Retry</button>
      <a href="index.html" class="btn secondary" style="margin-left:8px">Back to Dashboard</a>
    </div>
  `;
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'lang-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 2500);
}