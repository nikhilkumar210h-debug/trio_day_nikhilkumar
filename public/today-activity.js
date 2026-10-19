/**
 * today-activity.js — Trio Day Activities dashboard (Today)
 *
 * Responsibilities
 * - Guest view: up to 3 free starter activities (Supabase is_guest_allowed=true)
 * - First-time onboarding: goal/category selection
 * - Dashboard: activities for the chosen category (with a real empty state)
 * - Guest trial bookkeeping (local) + server-side claim after sign-in
 * - Language toggle (EN/HI), persisted in localStorage
 *
 * The activity TASKS themselves are played on activity-player.html.
 *
 * Data note: Supabase `activities` columns are
 *   id, display_order, category, title_en, title_hi, description_en,
 *   description_hi, difficulty, total_xp, cover_image_url,
 *   is_guest_allowed, is_published, created_at
 * There is no `icon` column — card icons come from the category definition.
 *
 * Gamification note: XP/level/streak fields on users/{uid} are server-owned
 * (see firestore.rules `gamificationKeys()`), so this page NEVER writes them.
 * Guest progress is claimed through the gamification Worker instead.
 */

import { auth, db } from './firebase-init.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  doc, getDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
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

const GOAL_CATEGORIES = [
  { key: 'Learning', icon: '📚', title: 'Learning', sub: 'Core concepts & logic', colorClass: 'goal-learning' },
  { key: 'Digital Skill', icon: '💻', title: 'Digital Skill', sub: 'Code, AI & tech mastery', colorClass: 'goal-digital' },
  { key: 'Personal Growth', icon: '🌱', title: 'Personal Growth', sub: 'Habits & discipline', colorClass: 'goal-growth' },
  { key: 'Mind & Emotion', icon: '🧠', title: 'Mind & Emotion', sub: 'Focus & mindfulness', colorClass: 'goal-mind' },
  { key: 'Social Life', icon: '🤝', title: 'Social Life', sub: 'Network & communication', colorClass: 'goal-social' },
  { key: 'Career & Practical Life', icon: '🧭', title: 'Career & Practical Life', sub: 'Projects, decisions & everyday skills', colorClass: 'goal-career' },
];

// Icon for any category string that reaches the UI (including "Starter").
const CATEGORY_ICONS = { Starter: '🔥' };
GOAL_CATEGORIES.forEach(c => { CATEGORY_ICONS[c.key] = c.icon; });
const categoryIcon = key => CATEGORY_ICONS[key] || '⚡';

const ACTIVITY_SELECT = 'id,display_order,category,title_en,title_hi,description_en,description_hi,difficulty,total_xp,cover_image_url,is_guest_allowed,is_published,created_at';

const TRANSLATIONS = {
  EN: {
    welcome: 'Choose Your Growth Path',
    sub_welcome: 'Select a focus area to unlock personalized weekly activities:',
    banner_sub: 'Pick an activity to start earning Weekly XP.',
    change_goal: '🔄 Switch Goal',
    guest_trial: 'Free Tasks',
    leaderboard: '🏆 Leaderboard',
    guest_limit: '3/3 Free Tasks Completed!',
    guest_msg: 'You\'ve used your demo quota. Login to save your XP, unlock custom goals, and access all activities.',
    language: 'Language',
    loading: 'Loading activities…',
    retry: 'Try again',
    no_activities: 'No activities here yet',
    no_activities_hint: 'This category has no published activities.',
    show_all: 'Show all activities',
    all_activities: 'All activities',
    all_activities_sub: 'Every published activity across Trio Day.',
    login_to_save: 'Login to save your progress',
    guest_progress_saved: 'Your guest progress is saved on this device.',
    guest_claim_ok: 'Guest progress credited: +{xp} XP',
    guest_claim_offline: 'Guest progress saved locally — it will be credited automatically once you are online.',
    signup_saved: 'Welcome to Trio Day!',
  },
  HI: {
    welcome: 'Apna Growth Goal Chunein',
    sub_welcome: 'Apne hisab se best activities dekhne ke liye ek category select karein:',
    banner_sub: 'Weekly XP kamane ke liye activity chunein.',
    change_goal: '🔄 Goal Badlein',
    guest_trial: 'Free Tasks',
    leaderboard: '🏆 Ranking',
    guest_limit: '3/3 Free Tasks Pure Hue!',
    guest_msg: 'Aapna demo quota pura ho gaya. XP save karne aur saare activities unlock karne ke liye login karein.',
    language: 'Bhasha',
    loading: 'Activities load ho rahi hain…',
    retry: 'Dobara koshish karein',
    no_activities: 'Yahan abhi koi activity nahi hai',
    no_activities_hint: 'Is category me abhi koi published activity nahi hai.',
    show_all: 'Saari activities dekhein',
    all_activities: 'Saari activities',
    all_activities_sub: 'Trio Day ki har published activity.',
    login_to_save: 'Progress save karne ke liye login karein',
    guest_progress_saved: 'Aapka guest progress is device par saved hai.',
    guest_claim_ok: 'Guest progress credit hua: +{xp} XP',
    guest_claim_offline: 'Guest progress locally saved hai — online hone par credit ho jayega.',
    signup_saved: 'Trio Day me aapka swagat hai!',
  }
};

// ─── STATE ──────────────────────────────────────────────────────────────────
let currentUser = null;
let userProfile = null;
let isAdmin = false;
let currentLanguage = 'EN';
let guestTasksPlayed = 0;
let selectedCategory = null;
let showingAllActivities = false;
const activitiesCache = new Map();

// ─── DOM ELEMENTS ───────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const guestView = $('guestView');
const onboardingView = $('onboardingView');
const dashboardView = $('dashboardView');
const guestActivities = $('guestActivities');
const guestLimitNotice = $('guestLimitNotice');
const goalGrid = $('goalGrid');
const catName = $('catName');
const catSub = $('catSub');
const changeGoalBtn = $('changeGoalBtn');
const activityList = $('activityList');
const langToast = $('langToast');
const loginModal = $('loginModal');
const loginModalClose = $('loginModalClose');
const loginForm = $('loginForm');
const signupForm = $('signupForm');
const loginEmail = $('loginEmail');
const loginPassword = $('loginPassword');
const signupName = $('signupName');
const signupEmail = $('signupEmail');
const signupPassword = $('signupPassword');
const loginError = $('loginError');
const signupError = $('signupError');
const guestXpDisplay = $('guestXpDisplay');
const modalTabs = document.querySelectorAll('.modal-tab');
const modalPanels = document.querySelectorAll('.modal-panel');

// ─── INIT ───────────────────────────────────────────────────────────────────
SoundManager.init();
currentLanguage = localStorage.getItem('trio_language') === 'HI' ? 'HI' : 'EN';
guestTasksPlayed = parseInt(localStorage.getItem(GUEST_TASKS_KEY) || '0', 10) || 0;
selectedCategory = localStorage.getItem('trio_selected_category');

document.documentElement.setAttribute('data-lang', currentLanguage);

if (changeGoalBtn) changeGoalBtn.textContent = t('change_goal');

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      userProfile = userDoc.exists() ? userDoc.data() : null;
      isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase());
      setAdminFlag(isAdmin);

      const hasOnboarded = userProfile?.onboardingComplete === true;
      const hasCategory = userProfile?.selectedCategory;

      if (!hasOnboarded || !hasCategory) showOnboarding();
      else { selectedCategory = hasCategory; showDashboard(); }

      // Replay guest-trial progress server-side (once, idempotent).
      await claimGuestProgress();
    } catch (err) {
      console.error('[Today] Auth error:', err);
      showGuestView();
    }
  } else {
    isAdmin = false;
    setAdminFlag(false);
    userProfile = null;
    showGuestView();
  }
  mountHeaderExtras();
});

// ─── HEADER EXTRAS (page-specific controls only) ─────────────────────────────
// The global header chip (avatar + streak + weekly XP, or Login) is rendered by
// auth-ui.js. Today only appends what is unique to this page: the language
// toggle and the guest free-task counter.
function mountHeaderExtras() {
  const el = $('authStatus');
  if (!el) return;
  el.querySelectorAll('[data-today-extra]').forEach(n => n.remove());

  const lang = document.createElement('button');
  lang.type = 'button';
  lang.className = 'lang-toggle';
  lang.dataset.todayExtra = 'lang';
  lang.setAttribute('aria-label', t('language'));
  lang.textContent = currentLanguage;
  lang.addEventListener('click', toggleLanguage);
  el.appendChild(lang);

  if (!currentUser) {
    const remaining = Math.max(0, GUEST_TASK_LIMIT - guestTasksPlayed);
    const chip = document.createElement('a');
    chip.className = 'guest-trial-chip';
    chip.dataset.todayExtra = 'guest';
    chip.href = 'login.html';
    chip.textContent = `${remaining}/${GUEST_TASK_LIMIT} ${t('guest_trial')}`;
    el.appendChild(chip);
  }
}
window.addEventListener('trio-auth-status-rendered', mountHeaderExtras);

// ─── LANGUAGE ───────────────────────────────────────────────────────────────
function toggleLanguage() {
  currentLanguage = currentLanguage === 'EN' ? 'HI' : 'EN';
  localStorage.setItem('trio_language', currentLanguage);
  document.documentElement.setAttribute('data-lang', currentLanguage);
  location.reload();
}

function t(key) {
  return TRANSLATIONS[currentLanguage][key] || TRANSLATIONS.EN[key] || key;
}

function showToast(msg) {
  if (!langToast) return;
  langToast.textContent = msg;
  langToast.hidden = false;
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => { langToast.hidden = true; }, 3200);
}

// ─── VIEW SWITCHING ─────────────────────────────────────────────────────────
function hideAllViews() {
  [guestView, onboardingView, dashboardView].forEach(v => { if (v) v.hidden = true; });
}

function showGuestView() {
  hideAllViews();
  if (!guestView) return;
  guestView.hidden = false;
  renderGuestActivities();
}

function showOnboarding() {
  hideAllViews();
  if (!onboardingView) return;
  onboardingView.hidden = false;
  renderGoalCards();
}

function showDashboard() {
  hideAllViews();
  if (!dashboardView) return;
  showingAllActivities = false;
  dashboardView.hidden = false;
  renderDashboard();
}

// ─── SHARED STATE MARKUP ────────────────────────────────────────────────────
const skeleton = (n = 3) => Array.from({ length: n }, () => '<div class="activity-skeleton"></div>').join('');

function stateBox({ icon = '', title = '', body = '', actions = '' }) {
  return `<div class="task-box td-activity-state" style="text-align:center">
    ${icon ? `<div class="td-activity-state-icon" aria-hidden="true">${icon}</div>` : ''}
    ${title ? `<h3 class="td-activity-state-title">${esc(title)}</h3>` : ''}
    ${body ? `<p style="color:var(--color-ink-muted); margin:8px 0 0">${esc(body)}</p>` : ''}
    ${actions ? `<div class="td-activity-state-actions">${actions}</div>` : ''}
  </div>`;
}

// Retry / empty-state buttons are wired through one delegated listener so they
// work with module-scoped functions (inline `onclick` attributes could not).
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'retry-guest') { e.preventDefault(); renderGuestActivities(); }
  else if (action === 'retry-dashboard') { e.preventDefault(); renderDashboard(); }
  else if (action === 'show-all') { e.preventDefault(); showAllActivities(); }
  else if (action === 'switch-goal') { e.preventDefault(); showingAllActivities = false; showOnboarding(); }
});

// ─── GUEST VIEW ─────────────────────────────────────────────────────────────
async function renderGuestActivities() {
  if (!guestActivities) return;
  const remaining = Math.max(0, GUEST_TASK_LIMIT - guestTasksPlayed);

  if (remaining <= 0) {
    guestActivities.innerHTML = '';
    if (guestLimitNotice) {
      guestLimitNotice.hidden = false;
      const msg = guestLimitNotice.querySelector('p');
      if (msg) msg.textContent = t('guest_msg');
    }
    mountHeaderExtras();
    return;
  }
  if (guestLimitNotice) guestLimitNotice.hidden = true;

  guestActivities.innerHTML = skeleton(3);
  try {
    const activities = await fetchActivities({ guestAllowed: true, limit: GUEST_TASK_LIMIT });
    if (!activities.length) {
      guestActivities.innerHTML = stateBox({
        icon: '🚧',
        title: t('no_activities'),
        body: t('no_activities_hint'),
        actions: `<button type="button" class="btn secondary" data-action="retry-guest">${esc(t('retry'))}</button>`
      });
      return;
    }
    guestActivities.innerHTML = activities.map((act, i) => renderActivityCard(act, i + 1, false)).join('');
    attachActivityCardListeners();
  } catch (err) {
    console.error('[Today] Failed to load guest activities:', err);
    guestActivities.innerHTML = stateBox({
      icon: '📡',
      title: 'Could not load activities',
      body: 'Check your connection and try again.',
      actions: `<button type="button" class="btn secondary" data-action="retry-guest">${esc(t('retry'))}</button>`
    });
  }
  mountHeaderExtras();
}

// ─── ONBOARDING ─────────────────────────────────────────────────────────────
function renderGoalCards() {
  if (!goalGrid) return;
  goalGrid.innerHTML = GOAL_CATEGORIES.map((cat, i) => `
    <a href="#" class="goal-card" data-category="${esc(cat.key)}" style="animation-delay: ${i * 80}ms;">
      <span class="goal-icon">${cat.icon}</span>
      <div class="goal-title">${esc(cat.title)}</div>
      <div class="goal-sub">${esc(cat.sub)}</div>
    </a>
  `).join('');

  goalGrid.querySelectorAll('.goal-card').forEach(card => {
    card.addEventListener('click', e => {
      e.preventDefault();
      selectCategory(card.dataset.category);
    });
  });
}

async function selectCategory(category) {
  selectedCategory = category;
  showingAllActivities = false;
  localStorage.setItem('trio_selected_category', category);

  if (currentUser) {
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        selectedCategory: category,
        onboardingComplete: true,
        updatedAt: serverTimestamp()
      });
      if (userProfile) userProfile.selectedCategory = category;
    } catch (err) {
      console.warn('[Today] Failed to save category:', err);
    }
  }
  showDashboard();
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
async function renderDashboard() {
  if (!activityList) return;
  if (!selectedCategory) { showOnboarding(); return; }

  const cat = GOAL_CATEGORIES.find(c => c.key === selectedCategory);
  catName.textContent = `${cat?.icon || '⚡'} ${cat?.title || selectedCategory}`;
  catSub.textContent = t('banner_sub');
  changeGoalBtn.textContent = t('change_goal');

  activityList.innerHTML = skeleton(3);
  try {
    const activities = await fetchActivities({ category: selectedCategory, limit: 12 });
    if (!activities.length) {
      activityList.innerHTML = stateBox({
        icon: cat?.icon || '🎯',
        title: t('no_activities'),
        body: `${t('no_activities_hint')} (${selectedCategory})`,
        actions: `<button type="button" class="btn secondary" data-action="show-all">${esc(t('show_all'))}</button>
                  <button type="button" class="btn secondary" data-action="switch-goal">${esc(t('change_goal'))}</button>`
      });
      return;
    }
    activityList.innerHTML = activities.map((act, i) => renderActivityCard(act, i + 1, true)).join('');
    attachActivityCardListeners();
  } catch (err) {
    console.error('[Today] Failed to load activities:', err);
    activityList.innerHTML = stateBox({
      icon: '📡',
      title: 'Could not load activities',
      body: 'Check your connection and try again.',
      actions: `<button type="button" class="btn secondary" data-action="retry-dashboard">${esc(t('retry'))}</button>`
    });
  }
}

// Fallback used by the empty state: every published activity, regardless of the
// selected category, so a user is never stuck on a dead end.
async function showAllActivities() {
  if (!activityList) return;
  showingAllActivities = true;
  catName.textContent = `⚡ ${t('all_activities')}`;
  catSub.textContent = t('all_activities_sub');
  activityList.innerHTML = skeleton(3);
  try {
    const activities = await fetchActivities({ limit: 12 });
    if (!activities.length) {
      activityList.innerHTML = stateBox({
        icon: '🚧', title: t('no_activities'), body: t('no_activities_hint'),
        actions: `<button type="button" class="btn secondary" data-action="switch-goal">${esc(t('change_goal'))}</button>`
      });
      return;
    }
    activityList.innerHTML = activities.map((act, i) => renderActivityCard(act, i + 1, true)).join('');
    attachActivityCardListeners();
  } catch (err) {
    console.error('[Today] Failed to load all activities:', err);
    activityList.innerHTML = stateBox({
      icon: '📡', title: 'Could not load activities', body: 'Check your connection and try again.',
      actions: `<button type="button" class="btn secondary" data-action="retry-dashboard">${esc(t('retry'))}</button>`
    });
  }
}

// ─── ACTIVITY CARD ──────────────────────────────────────────────────────────
function renderActivityCard(act, index, isLoggedIn) {
  const title = currentLanguage === 'HI' ? (act.title_hi || act.title_en) : act.title_en;
  const description = currentLanguage === 'HI' ? (act.description_hi || act.description_en) : act.description_en;
  const icon = categoryIcon(act.category);

  const imgHtml = act.cover_image_url
    ? `<img src="${esc(act.cover_image_url)}" alt="" loading="lazy">`
    : `<div class="card-img-placeholder">${icon}</div>`;

  const difficultyLabel = act.difficulty || 'Mixed';
  const xpLabel = act.total_xp ? `+${act.total_xp} XP` : 'XP on completion';

  return `
    <a href="activity-player.html?act=${esc(act.id)}" class="activity-card" data-activity-id="${esc(act.id)}" data-logged-in="${isLoggedIn}">
      <div class="card-left">
        <span class="card-number">${String(index).padStart(2, '0')}</span>
        <div class="card-info">
          <h2>${esc(title || 'Activity')}</h2>
          <p>${esc(description || 'Complete the tasks to earn XP')}</p>
          <div class="card-tags">
            <span class="tag-pill">🎯 ${esc(difficultyLabel)}</span>
            <span class="tag-xp">⚡ ${esc(xpLabel)}</span>
          </div>
        </div>
      </div>
      <div class="card-right">${imgHtml}</div>
    </a>
  `;
}

function attachActivityCardListeners() {
  document.querySelectorAll('.activity-card').forEach(card => {
    card.addEventListener('click', e => {
      e.preventDefault();
      startActivity(card.dataset.activityId, card.dataset.loggedIn === 'true');
    });
  });
}

// ─── PLAYER NAVIGATION ──────────────────────────────────────────────────────
function startActivity(activityId, isLoggedIn) {
  if (!activityId) return;
  if (!isLoggedIn && guestTasksPlayed >= GUEST_TASK_LIMIT) {
    showLoginModal();
    return;
  }
  location.href = `activity-player.html?act=${encodeURIComponent(activityId)}`;
}

// ─── SUPABASE FETCH ─────────────────────────────────────────────────────────
async function fetchActivities({ category, guestAllowed, limit: lim = 10 } = {}) {
  const cacheKey = `${category || 'all'}-${guestAllowed ? 'guest' : 'any'}-${lim}`;
  if (activitiesCache.has(cacheKey)) return activitiesCache.get(cacheKey);

  let url = `${SUPABASE_URL}/rest/v1/activities?select=${ACTIVITY_SELECT}&is_published=eq.true&order=display_order.asc&limit=${lim}`;
  if (category) url += `&category=eq.${encodeURIComponent(category)}`;
  if (guestAllowed) url += `&is_guest_allowed=eq.true`;

  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Unexpected activities payload');

  activitiesCache.set(cacheKey, data);
  return data;
}

// ─── GUEST TRIAL BOOKKEEPING ────────────────────────────────────────────────
// Guests complete tasks locally. Each completion is recorded with the real
// task id so the server (not the client) decides the XP value later.
function readGuestClaims() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUEST_CLAIMS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function clearGuestData() {
  guestTasksPlayed = 0;
  localStorage.removeItem(GUEST_TASKS_KEY);
  localStorage.removeItem(GUEST_CLAIMS_KEY);
}

async function claimGuestProgress() {
  if (!currentUser) return;
  const claims = readGuestClaims();

  if (!claims.length) {
    if (guestTasksPlayed > 0) clearGuestData();
    return;
  }

  try {
    const result = await workerPost('/api/activity/claim-guest-xp', {
      claims,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }, currentUser);

    clearGuestData();
    const awarded = Number(result?.awarded) || 0;
    if (awarded > 0) {
      showToast(t('guest_claim_ok').replace('{xp}', String(awarded)));
      // Reload so the header/profile badges show the freshly credited XP.
      window.setTimeout(() => location.reload(), 900);
    }
  } catch (err) {
    // Endpoint not deployed / offline: keep the local claims and try again next
    // session. Never discard a guest's progress on a network failure.
    console.warn('[Today] Guest claim deferred:', err.message);
    showToast(t('guest_claim_offline'));
  }
}

// ─── LOGIN MODAL ────────────────────────────────────────────────────────────
function guestLocalXp() {
  return readGuestClaims().reduce((sum, c) => sum + (Number(c?.xp) || 0), 0);
}

function showLoginModal() {
  if (!loginModal) return;
  if (guestXpDisplay) guestXpDisplay.textContent = `${guestLocalXp()} XP`;
  loginModal.hidden = false;
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => loginEmail?.focus(), 60);
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

if (loginModalClose) loginModalClose.addEventListener('click', hideLoginModal);
if (loginModal) loginModal.addEventListener('click', e => { if (e.target === loginModal) hideLoginModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && loginModal && !loginModal.hidden) hideLoginModal();
});

if (modalTabs.length) {
  modalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      modalTabs.forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
      modalPanels.forEach(p => { p.hidden = true; });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const panel = $(`${tab.dataset.tab}TabPanel`);
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
  if (code.includes('network')) return 'Network problem. Check your connection and try again.';
  return err?.message || 'Something went wrong. Please try again.';
}

function setBusy(form, busy, busyLabel) {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.textContent;
    btn.disabled = true;
    if (busyLabel) btn.textContent = busyLabel;
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.textContent = btn.dataset.label;
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (loginError) loginError.style.display = 'none';
    if (!loginEmail.value.trim() || !loginPassword.value) {
      if (loginError) { loginError.textContent = 'Enter your email and password.'; loginError.style.display = 'block'; }
      return;
    }
    setBusy(loginForm, true, 'Logging in…');
    try {
      await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
      hideLoginModal();
    } catch (err) {
      if (loginError) { loginError.textContent = prettyAuthError(err); loginError.style.display = 'block'; }
    } finally {
      setBusy(loginForm, false);
    }
  });
}

if (signupForm) {
  signupForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (signupError) signupError.style.display = 'none';
    const name = signupName.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value;
    if (!name || !email || password.length < 6) {
      if (signupError) { signupError.textContent = 'Enter a name, a valid email, and a 6+ character password.'; signupError.style.display = 'block'; }
      return;
    }
    setBusy(signupForm, true, 'Creating account…');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Profile creation is gamification-free (firestore.rules rejects client
      // writes to xp/level/streak). Guest XP is credited by the Worker instead.
      await ensureUserProfile(cred.user, name);
      hideLoginModal();
    } catch (err) {
      if (signupError) { signupError.textContent = prettyAuthError(err); signupError.style.display = 'block'; }
    } finally {
      setBusy(signupForm, false);
    }
  });
}

// ─── EXPORTS (for the activity player / inline handlers) ────────────────────
window.showLoginModal = showLoginModal;
window.toggleLanguage = toggleLanguage;
