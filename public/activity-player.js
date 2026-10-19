/**
 * activity-player.js — Trio Day Activity Task Player
 *
 * Flow: load activity + tasks (Supabase) → play tasks in order → each task
 * requires a written reflection → the gamification Worker verifies it and
 * awards XP → next task → completion screen.
 *
 * Task states handled here
 *   pending / in-progress · verifying (awaiting submission) · verified (completed)
 *   · verification-failed (retryable) · skipped
 *
 * Rules respected
 * - Reaching 0 on the timer grants NOTHING. The timer only shows the suggested
 *   minimum time for the task; completion always requires a submission that the
 *   server accepts.
 * - XP shown to the user comes from the server response (`awarded`), never from
 *   the raw task row, so a duplicate/already-claimed task cannot look successful.
 * - Guests get 3 free tasks; their completions are stored on-device and credited
 *   server-side after sign-in (POST /api/activity/claim-guest-xp).
 *
 * Supabase note: the `tasks` table has NO `is_published` column and the anon role
 * cannot read `verification_prompt` (correct: the Worker reads it with the
 * service role). Requesting a missing/privileged column returns 400/401.
 */

import { auth, db } from './firebase-init.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { SoundManager } from './sound-manager.js';
import { escapeHtml as esc } from './utils.js';
import { setAdminFlag } from './ui/nav.js';
import { ensureUserProfile } from './services/userCache.js';
import { workerPost } from './gamification/worker-config.js';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://vccypxwiqcuexxrhtgyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zJvP50wf3CW2PNfkOD9yCQ_ffFhsZEp';
const ADMIN_EMAILS = ['nikhilkumar210h@gmail.com', 'nikhilkumar45374@gmail.com'];

const GUEST_TASK_LIMIT = 3;
const GUEST_TASKS_KEY = 'trio_guest_tasks';
const GUEST_CLAIMS_KEY = 'trio_guest_claims';
const MIN_PROOF_LENGTH = 15;   // client-side guard (server enforces 10+)
const MAX_PROOF_LENGTH = 2000;

const ACTIVITY_SELECT = 'id,display_order,category,title_en,title_hi,description_en,description_hi,difficulty,total_xp,cover_image_url,is_guest_allowed,is_published,created_at';
const TASK_SELECT = 'id,activity_id,task_number,task_type,title_en,title_hi,instructions_en,instructions_hi,min_time_seconds,xp_reward';

const CATEGORY_ICONS = {
  Starter: '🔥', Learning: '📚', 'Digital Skill': '💻', 'Personal Growth': '🌱',
  'Mind & Emotion': '🧠', 'Social Life': '🤝', 'Career & Practical Life': '🧭'
};

// ─── STATE ──────────────────────────────────────────────────────────────────
let currentUser = null;
let userProfile = null;
let isAdmin = false;
let activityId = null;
let activityData = null;
let tasks = [];
let currentTaskIndex = 0;
let taskStates = [];            // 'pending' | 'completed' | 'skipped'
let taskTimerInterval = null;
let taskStartTime = null;
let taskTimeRemaining = 0;
let guestCompletions = 0;       // guest tasks completed (consumes the free quota)
let totalXpEarned = 0;          // sum of server-awarded XP this session
let lastWeeklyXp = null;        // server-authoritative weekly XP after the last award
let isSubmitting = false;
let currentLanguage = 'EN';

// ─── DOM ────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const loadingState = $('loadingState');
const taskPlayer = $('taskPlayer');
const completionScreen = $('completionScreen');
const guestLimitScreen = $('guestLimitScreen');
const activityHeader = $('activityHeader');
const progressTrack = $('progressTrack');
const progressFill = $('progressFill');
const playerCatName = $('playerCatName');
const taskSteps = $('taskSteps');
const currTaskNum = $('currTaskNum');
const totalTaskNum = $('totalTaskNum');
const taskTypeBadge = $('taskTypeBadge');
const taskXpBadge = $('taskXpBadge');
const taskTitle = $('taskTitle');
const taskDetail = $('taskDetail');
const taskStatus = $('taskStatus');
const timerContainer = $('timerContainer');
const timerDisplay = $('timerDisplay');
const proofInputWrapper = $('proofInputWrapper');
const proofLabel = $('proofLabel');
const proofTextarea = $('proofTextarea');
const proofHint = $('proofHint');
const charCount = $('charCount');
const btnSkip = $('btnSkip');
const btnComplete = $('btnComplete');
const finalWeeklyXp = $('finalWeeklyXp');
const totalXpEarnedEl = $('totalXpEarned');
const completionTitle = $('completionTitle');
const completionText = $('completionText');
const completionIcon = $('completionIcon');
const completionNote = $('completionNote');
const completionClaimBtn = $('completionClaimBtn');
const completionLeaderboardLink = $('completionLeaderboardLink');
const loginModal = $('loginModal');

// ─── TRANSLATIONS ───────────────────────────────────────────────────────────
const TRANSLATIONS = {
  EN: {
    task_complete: 'Complete Task & Claim XP',
    task_skip: 'Skip Task (0 XP)',
    proof_placeholder: 'Describe what you did and what happened. Be specific — a real reflection is required.',
    proof_label: 'Your reflection / proof',
    proof_hint: 'Minimum 15 characters. Write what you actually did.',
    min_time_note: 'Suggested minimum time',
    min_time_ready: 'Minimum time reached — you can complete now',
    verifying: 'Verifying…',
    verified: 'Verified — +{xp} XP',
    already_verified: 'Already verified this week (no extra XP)',
    verification_failed: 'Verification failed',
    status_in_progress: 'In progress',
    status_completed: 'Verified',
    status_skipped: 'Skipped',
    completed: 'Mission Accomplished!',
    completed_sub: 'Every task in this activity is verified. Your XP is saved to your account.',
    completed_guest_sub: 'You finished every task. Sign in so the server can credit your XP.',
    all_skipped: 'Activity finished',
    all_skipped_sub: 'All tasks were skipped, so no XP was earned. Try completing them to earn XP.',
    xp_earned: 'XP earned this session',
    guest_limit: '3/3 Free Tasks Completed!',
    guest_msg: 'You\'ve used your demo quota. Login to save your XP, unlock custom goals, and access all activities.',
    guest_note: 'Guest progress is stored on this device and credited after you log in.',
    guest_local_xp: 'XP waiting to be claimed',
    login_save: 'Login to Save XP',
    error_generic: 'Something went wrong. Please try again.',
    load_failed: 'Could not load this activity',
    no_tasks: 'This activity has no tasks yet',
    no_tasks_sub: 'Nothing to play here right now. Please pick another activity.',
    back: 'Back to activities',
    retry: 'Try again',
  },
  HI: {
    task_complete: 'Task Complete Karke XP Claim Karein',
    task_skip: 'Skip Karein (0 XP)',
    proof_placeholder: 'Aapne kya kiya aur kya hua — thoda detail me likhein. Sacha reflection zaroori hai.',
    proof_label: 'Aapka reflection / proof',
    proof_hint: 'Kam se kam 15 characters. Jo kiya wo likhein.',
    min_time_note: 'Suggested minimum samay',
    min_time_ready: 'Minimum samay pura — ab complete kar sakte hain',
    verifying: 'Verify ho raha hai…',
    verified: 'Verified — +{xp} XP',
    already_verified: 'Is hafte pehle hi verified (extra XP nahi)',
    verification_failed: 'Verification fail hua',
    status_in_progress: 'Chalu',
    status_completed: 'Verified',
    status_skipped: 'Skipped',
    completed: 'Mission Poora Hua!',
    completed_sub: 'Is activity ka har task verified hai. Aapka XP account me save hai.',
    completed_guest_sub: 'Aapne saare task poore kiye. XP credit karne ke liye login karein.',
    all_skipped: 'Activity khatam',
    all_skipped_sub: 'Saare task skip hue, isliye koi XP nahi mila. Complete karke XP kamayein.',
    xp_earned: 'Is session ka XP',
    guest_limit: '3/3 Free Tasks Pure Hue!',
    guest_msg: 'Aapna demo quota pura ho gaya. XP save karne aur saare activities unlock karne ke liye login karein.',
    guest_note: 'Guest progress is device par saved hai aur login ke baad credit hoga.',
    guest_local_xp: 'Claim hone wala XP',
    login_save: 'XP Save Karne Login Karein',
    error_generic: 'Kuch galat hua. Please try again.',
    load_failed: 'Ye activity load nahi ho payi',
    no_tasks: 'Is activity me abhi koi task nahi hai',
    no_tasks_sub: 'Yahan abhi khelne ke liye kuch nahi hai. Doosri activity chunein.',
    back: 'Activities par wapas',
    retry: 'Dobara koshish karein',
  }
};

function t(key) {
  return TRANSLATIONS[currentLanguage][key] || TRANSLATIONS.EN[key] || key;
}

// ─── INIT ───────────────────────────────────────────────────────────────────
SoundManager.init();
currentLanguage = localStorage.getItem('trio_language') === 'HI' ? 'HI' : 'EN';
guestCompletions = parseInt(localStorage.getItem(GUEST_TASKS_KEY) || '0', 10) || 0;
document.documentElement.setAttribute('data-lang', currentLanguage);

activityId = new URLSearchParams(window.location.search).get('act');

if (!activityId) {
  showError('No activity specified', 'Pick an activity from Today.');
}

// ─── HEADER EXTRAS (page-specific controls only) ─────────────────────────────
// The header chip (avatar/streak/weekly XP or Login) is rendered by auth-ui.js.
// The player only adds the language toggle.
function mountHeaderExtras() {
  const el = $('authStatus');
  if (!el) return;
  el.querySelectorAll('[data-player-extra]').forEach(n => n.remove());
  const lang = document.createElement('button');
  lang.type = 'button';
  lang.className = 'lang-toggle';
  lang.dataset.playerExtra = 'lang';
  lang.setAttribute('aria-label', 'Language');
  lang.textContent = currentLanguage;
  lang.addEventListener('click', toggleLanguage);
  el.appendChild(lang);
}
window.addEventListener('trio-auth-status-rendered', mountHeaderExtras);
mountHeaderExtras();

function toggleLanguage() {
  currentLanguage = currentLanguage === 'EN' ? 'HI' : 'EN';
  localStorage.setItem('trio_language', currentLanguage);
  document.documentElement.setAttribute('data-lang', currentLanguage);
  location.reload();
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
  mountHeaderExtras();
  if (activityId) await loadActivity();
});

// ─── LOAD ACTIVITY ──────────────────────────────────────────────────────────
async function loadActivity() {
  try {
    const actRes = await fetch(
      `${SUPABASE_URL}/rest/v1/activities?id=eq.${encodeURIComponent(activityId)}&select=${ACTIVITY_SELECT}&is_published=eq.true`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Accept': 'application/json' } }
    );
    if (!actRes.ok) throw new Error(`Activity request failed (${actRes.status})`);
    const actData = await actRes.json();
    if (!Array.isArray(actData) || !actData.length) {
      // Expected user state (bad link, unpublished activity) — not an app error.
      console.warn('[ActivityPlayer] Activity not found or unpublished:', activityId);
      showError(t('load_failed'), t('no_tasks_sub'));
      return;
    }
    activityData = actData[0];

    // NOTE: no `is_published` filter — the tasks table has no such column.
    const taskRes = await fetch(
      `${SUPABASE_URL}/rest/v1/tasks?activity_id=eq.${encodeURIComponent(activityId)}&select=${TASK_SELECT}&order=task_number.asc`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Accept': 'application/json' } }
    );
    if (!taskRes.ok) throw new Error(`Tasks request failed (${taskRes.status})`);
    const taskData = await taskRes.json();
    if (!Array.isArray(taskData)) throw new Error(t('load_failed'));

    tasks = taskData;
    taskStates = tasks.map(() => 'pending');

    const actTitle = currentLanguage === 'HI' ? (activityData.title_hi || activityData.title_en) : activityData.title_en;
    playerCatName.textContent = `${CATEGORY_ICONS[activityData.category] || '⚡'} ${actTitle || 'Activity'}`;
    totalTaskNum.textContent = tasks.length;

    activityHeader.hidden = false;
    progressTrack.hidden = false;
    if (taskSteps) taskSteps.hidden = tasks.length === 0;
    loadingState.hidden = true;

    if (!tasks.length) {
      showError(t('no_tasks'), `${t('no_tasks_sub')} (${activityData.category || ''})`.trim());
      return;
    }

    renderCurrentTask();
  } catch (err) {
    console.error('[ActivityPlayer] Load error:', err);
    showError(t('load_failed'), err.message);
  }
}

// ─── TASK STATE HELPERS ─────────────────────────────────────────────────────
function renderSteps() {
  if (!taskSteps) return;
  taskSteps.innerHTML = tasks.map((task, i) => {
    const state = taskStates[i];
    const label = state === 'completed' ? t('status_completed')
      : state === 'skipped' ? t('status_skipped')
        : i === currentTaskIndex ? t('status_in_progress') : `Task ${i + 1}`;
    const cls = ['task-step', `is-${state}`, i === currentTaskIndex ? 'is-current' : ''].filter(Boolean).join(' ');
    const mark = state === 'completed' ? '✓' : state === 'skipped' ? '⏭' : String(i + 1);
    return `<span class="${cls}" title="${esc(label)}" aria-label="${esc(label)}">${mark}</span>`;
  }).join('');
}

function setStatus(kind, message) {
  if (!taskStatus) return;
  if (!kind) { taskStatus.hidden = true; taskStatus.textContent = ''; taskStatus.className = 'task-status'; return; }
  taskStatus.hidden = false;
  taskStatus.className = `task-status is-${kind}`;
  taskStatus.textContent = message;
}

// ─── RENDER CURRENT TASK ────────────────────────────────────────────────────
function renderCurrentTask() {
  if (currentTaskIndex >= tasks.length) { showCompletion(); return; }

  // Guest quota: completions only (skips are free and worth no XP).
  if (!currentUser && guestCompletions >= GUEST_TASK_LIMIT) { showGuestLimit(); return; }

  const task = tasks[currentTaskIndex];
  taskStates[currentTaskIndex] = 'pending';

  progressFill.style.width = `${Math.round((currentTaskIndex / tasks.length) * 100)}%`;
  currTaskNum.textContent = currentTaskIndex + 1;

  const taskTitleText = currentLanguage === 'HI' ? (task.title_hi || task.title_en) : task.title_en;
  const taskInstructions = currentLanguage === 'HI' ? (task.instructions_hi || task.instructions_en) : task.instructions_en;

  taskTypeBadge.textContent = `🧩 ${task.task_type || 'Task'}`;
  taskXpBadge.textContent = `⚡ +${task.xp_reward || 10} XP`;
  taskTitle.textContent = taskTitleText || 'Task';
  taskDetail.textContent = taskInstructions || '';

  setupTimer(task.min_time_seconds || 0);
  setStatus(null);
  renderSteps();

  proofInputWrapper.hidden = false;
  proofLabel.textContent = t('proof_label');
  proofTextarea.placeholder = t('proof_placeholder');
  proofTextarea.value = '';
  proofTextarea.disabled = false;
  if (proofHint) proofHint.textContent = t('proof_hint');
  updateCharCount();

  btnSkip.textContent = t('task_skip');
  btnComplete.textContent = t('task_complete');
  btnComplete.disabled = false;
  btnSkip.disabled = false;
  isSubmitting = false;

  taskPlayer.hidden = false;
  completionScreen.hidden = true;
  guestLimitScreen.hidden = true;
}

function updateCharCount() {
  const len = proofTextarea.value.length;
  charCount.textContent = `${len} / ${MAX_PROOF_LENGTH} characters`;
  charCount.className = 'char-count';
  if (len > MAX_PROOF_LENGTH * 0.9) charCount.classList.add('danger');
  else if (len > MAX_PROOF_LENGTH * 0.7) charCount.classList.add('warning');
  else if (len >= MIN_PROOF_LENGTH) charCount.classList.add('ok');
}

// ─── TIMER (suggested minimum time — never a completion trigger) ─────────────
function setupTimer(minSeconds) {
  if (taskTimerInterval) clearInterval(taskTimerInterval);
  timerContainer.classList.remove('warning', 'danger', 'ready');

  if (minSeconds > 0) {
    taskTimeRemaining = minSeconds;
    taskStartTime = Date.now();
    timerContainer.hidden = false;
    timerContainer.classList.add('countdown');
    renderTimerLabel(t('min_time_note'));
    updateTimerDisplay();

    taskTimerInterval = setInterval(() => {
      taskTimeRemaining--;
      updateTimerDisplay();
      if (taskTimeRemaining <= 0) {
        clearInterval(taskTimerInterval);
        taskTimerInterval = null;
        timerContainer.classList.remove('countdown', 'warning');
        timerContainer.classList.add('ready');
        renderTimerLabel(t('min_time_ready'));
      } else if (taskTimeRemaining <= 10) {
        timerContainer.classList.add('warning');
      }
    }, 1000);
  } else {
    timerContainer.hidden = true;
    taskStartTime = Date.now();
  }
}

function renderTimerLabel(text) {
  const label = timerContainer.querySelector('.timer-label');
  if (label) label.textContent = text;
}

function updateTimerDisplay() {
  const mins = Math.floor(Math.max(0, taskTimeRemaining) / 60);
  const secs = Math.max(0, taskTimeRemaining) % 60;
  timerDisplay.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
}

// ─── IMPROVE-AFTER-COMPLETION FREEZE HELPERS ────────────────────────────────
function setBusy(busy, label) {
  isSubmitting = busy;
  btnComplete.disabled = busy;
  btnSkip.disabled = busy;
  proofTextarea.disabled = busy;
  if (busy) {
    btnComplete.dataset.label = btnComplete.textContent;
    if (label) btnComplete.textContent = label;
  } else if (btnComplete.dataset.label) {
    btnComplete.textContent = btnComplete.dataset.label;
  }
}

function setButtonsLabel() {
  btnComplete.textContent = t('task_complete');
  btnSkip.textContent = t('task_skip');
}

// ─── COMPLETE TASK ──────────────────────────────────────────────────────────
async function handleComplete(task) {
  if (isSubmitting) return;

  const proof = proofTextarea.value.trim();
  if (proof.length < MIN_PROOF_LENGTH) {
    setStatus('error', `Please write at least ${MIN_PROOF_LENGTH} characters in your reflection.`);
    proofTextarea.focus();
    return;
  }

  const timeSpent = taskStartTime ? Math.floor((Date.now() - taskStartTime) / 1000) : 0;

  if (currentUser) {
    // Logged in: server verifies the submission and awards XP.
    setBusy(true, t('verifying'));
    setStatus('pending', t('verifying'));

    try {
      const result = await workerPost('/api/activity/complete-task', {
        activityId,
        taskId: task.id,
        taskNumber: task.task_number,
        proof,
        timeSpent,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }, currentUser);

      if (result && result.ok === false) throw new Error(result.error || t('verification_failed'));

      const awarded = Number(result?.awarded) || 0;
      totalXpEarned += awarded;
      if (typeof result?.weeklyXp === 'number') lastWeeklyXp = result.weeklyXp;
      taskStates[currentTaskIndex] = 'completed';

      if (result?.alreadyAwarded) setStatus('info', t('already_verified'));
      else setStatus('success', t('verified').replace('{xp}', String(awarded)));
      if (awarded > 0) SoundManager.success();

      setBusy(false);
      setButtonsLabel();
      advance();
    } catch (err) {
      console.error('[ActivityPlayer] Complete error:', err);
      setBusy(false);
      setButtonsLabel();
      setStatus('error', `${t('verification_failed')}: ${err.message || t('error_generic')}`);
    }
    return;
  }

  // Guest: store the completion on-device. XP is credited later, server-side.
  guestCompletions++;
  localStorage.setItem(GUEST_TASKS_KEY, String(guestCompletions));
  recordGuestClaim({
    activityId,
    taskId: task.id,
    taskNumber: task.task_number,
    xp: Number(task.xp_reward) || 0,
    title: currentLanguage === 'HI' ? (task.title_hi || task.title_en) : task.title_en
  });
  taskStates[currentTaskIndex] = 'completed';
  setStatus('info', t('guest_note'));
  advance();
}

// ─── SKIP TASK ──────────────────────────────────────────────────────────────
async function handleSkip() {
  if (isSubmitting) return;
  const task = tasks[currentTaskIndex];
  if (!task) return;

  if (taskTimerInterval) { clearInterval(taskTimerInterval); taskTimerInterval = null; }
  taskStates[currentTaskIndex] = 'skipped';
  setStatus('info', `${t('status_skipped')} — 0 XP`);

  if (currentUser) {
    // Best-effort history log; a failure must not interrupt the user.
    workerPost('/api/activity/skip-task', {
      activityId,
      taskId: task.id,
      taskNumber: task.task_number,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }, currentUser).catch(err => console.warn('[ActivityPlayer] Skip log failed:', err.message));
  }

  // A skip is free for guests: nothing was earned, so it does not consume the
  // free quota (the server caps guest XP claims at 3 anyway).
  advance();
}

// ─── ADVANCE ────────────────────────────────────────────────────────────────
function advance() {
  if (taskTimerInterval) { clearInterval(taskTimerInterval); taskTimerInterval = null; }
  currentTaskIndex++;
  renderSteps();
  renderCurrentTask();
}

// ─── HELPERS: GUEST CLAIMS ──────────────────────────────────────────────────
function readGuestClaims() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUEST_CLAIMS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function recordGuestClaim(claim) {
  if (!claim?.taskId) return;
  const claims = readGuestClaims();
  if (claims.some(c => c.taskId === claim.taskId)) return;
  claims.push(claim);
  try { localStorage.setItem(GUEST_CLAIMS_KEY, JSON.stringify(claims.slice(-GUEST_TASK_LIMIT))); } catch (_) {}
}

function guestLocalXp() {
  return readGuestClaims().reduce((sum, c) => sum + (Number(c?.xp) || 0), 0);
}

// ─── COMPLETION SCREEN ──────────────────────────────────────────────────────
function showCompletion() {
  taskPlayer.hidden = true;
  completionScreen.hidden = false;
  progressTrack.hidden = true;
  progressFill.style.width = '100%';

  const completedCount = taskStates.filter(s => s === 'completed').length;
  const allSkipped = completedCount === 0;

  if (completionIcon) completionIcon.textContent = allSkipped ? '🏁' : '🎉';
  if (completionTitle) completionTitle.textContent = allSkipped ? t('all_skipped') : t('completed');
  if (completionText) {
    // A guest's XP is not on their account yet — never say that it is.
    completionText.textContent = allSkipped
      ? t('all_skipped_sub')
      : (currentUser ? t('completed_sub') : t('completed_guest_sub'));
  }

  if (currentUser) {
    totalXpEarnedEl.textContent = `+${totalXpEarned} ${t('xp_earned')}`;
    const weekly = lastWeeklyXp ?? ((Number(userProfile?.weeklyXp) || 0) + totalXpEarned);
    finalWeeklyXp.textContent = String(weekly);
    if (completionNote) completionNote.hidden = true;
    if (completionClaimBtn) completionClaimBtn.hidden = true;
    if (completionLeaderboardLink) completionLeaderboardLink.hidden = false;
  } else {
    // Guests have no account-level XP yet — never present a fake weekly total.
    const pending = guestLocalXp();
    totalXpEarnedEl.textContent = `${pending} ${t('guest_local_xp')}`;
    finalWeeklyXp.textContent = '—';
    if (completionNote) { completionNote.hidden = false; completionNote.textContent = t('guest_note'); }
    // Offer the sign-in path instead of forcing the modal over the result.
    if (completionClaimBtn) completionClaimBtn.hidden = allSkipped;
    if (completionLeaderboardLink) completionLeaderboardLink.hidden = true;
  }

  // Celebration only when something was genuinely verified.
  if (!allSkipped) SoundManager.success();
}

// ─── GUEST LIMIT ────────────────────────────────────────────────────────────
function showGuestLimit() {
  taskPlayer.hidden = true;
  completionScreen.hidden = true;
  progressTrack.hidden = true;
  guestLimitScreen.hidden = false;

  guestLimitScreen.innerHTML = `
    <div class="task-box" style="text-align:center; max-width:500px; margin:20px auto;">
      <span class="tag-pill">🔒 Guest Trial Completed</span>
      <h2 style="color:var(--color-accent); margin:18px 0 12px;">${t('guest_limit')}</h2>
      <p style="color:var(--color-ink-muted); font-size:16px; line-height:1.6;">${t('guest_msg')}</p>
      <p style="color:var(--color-ink-muted); font-size:14px;">${t('guest_note')}</p>
      <button type="button" id="guestLoginBtn" class="btn-task btn-complete" style="margin-top:16px; width:100%">${t('login_save')}</button>
      <a href="index.html" class="btn-task btn-skip" style="margin-top:10px; width:100%; text-decoration:none; display:block;">${t('back')}</a>
    </div>
  `;
  const btn = $('guestLoginBtn');
  if (btn) btn.addEventListener('click', showLoginModal);
}

// ─── LOGIN MODAL ────────────────────────────────────────────────────────────
const guestXpDisplay = $('guestXpDisplay');
const loginForm = $('loginForm');
const signupForm = $('signupForm');
const loginError = $('loginError');
const signupError = $('signupError');

function showLoginModal() {
  if (!loginModal) return;
  if (guestXpDisplay) guestXpDisplay.textContent = `${guestLocalXp()} XP`;
  loginModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function hideLoginModal() {
  if (!loginModal) return;
  loginModal.hidden = true;
  document.body.style.overflow = '';
  loginForm?.reset();
  signupForm?.reset();
  if (loginError) loginError.style.display = 'none';
  if (signupError) signupError.style.display = 'none';
}

if (completionClaimBtn) completionClaimBtn.addEventListener('click', showLoginModal);

if (loginModal) {
  loginModal.querySelector('#loginModalClose')?.addEventListener('click', hideLoginModal);
  loginModal.addEventListener('click', e => { if (e.target === loginModal) hideLoginModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideLoginModal(); });
  loginModal.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      loginModal.querySelectorAll('.modal-tab').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
      loginModal.querySelectorAll('.modal-panel').forEach(p => { p.hidden = true; });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const panel = loginModal.querySelector(`#${tab.dataset.tab}TabPanel`);
      if (panel) panel.hidden = false;
    });
  });
}

function prettyAuthError(err) {
  const code = err?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Email or password is incorrect.';
  if (code.includes('invalid-email')) return 'Please enter a valid email address.';
  if (code.includes('email-already-in-use')) return 'That email already has an account — try logging in.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a minute and try again.';
  return err?.message || t('error_generic');
}

function formBusy(form, busy, label) {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.textContent; btn.disabled = true; if (label) btn.textContent = label; }
  else { btn.disabled = false; if (btn.dataset.label) btn.textContent = btn.dataset.label; }
}

if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (loginError) loginError.style.display = 'none';
    formBusy(loginForm, true, 'Logging in…');
    try {
      await signInWithEmailAndPassword(auth, $('loginEmail').value.trim(), $('loginPassword').value);
      hideLoginModal();
      // Today is where guest progress is replayed and the dashboard lives.
      location.href = 'index.html';
    } catch (err) {
      if (loginError) { loginError.textContent = prettyAuthError(err); loginError.style.display = 'block'; }
    } finally { formBusy(loginForm, false); }
  });
}

if (signupForm) {
  signupForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (signupError) signupError.style.display = 'none';
    const name = $('signupName').value.trim();
    const email = $('signupEmail').value.trim();
    const password = $('signupPassword').value;
    if (!name || !email || password.length < 6) {
      if (signupError) { signupError.textContent = 'Enter a name, a valid email, and a 6+ character password.'; signupError.style.display = 'block'; }
      return;
    }
    formBusy(signupForm, true, 'Creating account…');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Profile creation is gamification-free (rules reject client XP writes).
      await ensureUserProfile(cred.user, name);
      hideLoginModal();
      location.href = 'index.html';
    } catch (err) {
      if (signupError) { signupError.textContent = prettyAuthError(err); signupError.style.display = 'block'; }
    } finally { formBusy(signupForm, false); }
  });
}

// ─── ERROR STATE ────────────────────────────────────────────────────────────
function showError(title, detail) {
  if (!loadingState) return;
  loadingState.hidden = false;
  loadingState.innerHTML = `
    <div class="task-box td-activity-state" style="text-align:center">
      <div class="td-activity-state-icon" aria-hidden="true">⚠️</div>
      <h3 class="td-activity-state-title">${esc(title || t('load_failed'))}</h3>
      ${detail ? `<p style="color:var(--color-ink-muted); margin:8px 0 0">${esc(detail)}</p>` : ''}
      <div class="td-activity-state-actions">
        <button type="button" class="btn secondary" id="playerRetryBtn">${esc(t('retry'))}</button>
        <a href="index.html" class="btn secondary">${esc(t('back'))}</a>
      </div>
    </div>
  `;
  $('playerRetryBtn')?.addEventListener('click', () => {
    if (activityId) location.reload();
    else location.href = 'index.html';
  });
  if (taskPlayer) taskPlayer.hidden = true;
  if (completionScreen) completionScreen.hidden = true;
  if (guestLimitScreen) guestLimitScreen.hidden = true;
  if (activityHeader) activityHeader.hidden = true;
  if (progressTrack) progressTrack.hidden = true;
  if (taskSteps) taskSteps.hidden = true;
}

// ─── COMPLETE/SKIP WIRING ───────────────────────────────────────────────────
btnComplete?.addEventListener('click', () => {
  const task = tasks[currentTaskIndex];
  if (task) handleComplete(task);
});
btnSkip?.addEventListener('click', handleSkip);
proofTextarea?.addEventListener('input', updateCharCount);
proofTextarea?.addEventListener('keydown', e => {
  // Ctrl/Cmd+Enter submits — handy on desktop, no accidental submits on mobile.
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    const task = tasks[currentTaskIndex];
    if (task) handleComplete(task);
  }
});
