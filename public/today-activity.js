/**
 * today-activity.js — Trio Day Activities Dashboard & Player
 * 
 * Handles:
 * - Guest View: 3 free starter activities (Supabase: is_guest_allowed=true)
 * - Logged-in Onboarding: 6 Goal Cards → Category selection
 * - Dashboard: Category activities with clickable cards
 * - Activity Player: Step-by-step tasks with timer, proof input, AI verification
 * - Language Toggle (EN/HI) with localStorage persistence
 * - Guest limit (3 tasks) → Login modal trigger + XP sync
 */

import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { SoundManager } from './sound-manager.js';
import { escapeHtml as esc, cloudinaryAutoUrl } from './utils.js';
import { setAdminFlag } from './ui/nav.js';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://vccypxwiqcuexxrhtgyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zJvP50wf3CW2PNfkOD9yCQ_ffFhsZEp';
const ADMIN_EMAILS = ['nikhilkumar210h@gmail.com', 'nikhilkumar45374@gmail.com'];

const GUEST_TASK_LIMIT = 3;
const GOAL_CATEGORIES = [
  { key: 'Learning', icon: '📚', title: 'Learning', sub: 'Core concepts & logic', colorClass: 'goal-learning' },
  { key: 'Digital Skill', icon: '💻', title: 'Digital Skill', sub: 'Code, AI & tech mastery', colorClass: 'goal-digital' },
  { key: 'Personal Growth', icon: '🌱', title: 'Personal Growth', sub: 'Habits & discipline', colorClass: 'goal-growth' },
  { key: 'Mind & Emotion', icon: '🧠', title: 'Mind & Emotion', sub: 'Focus & mindfulness', colorClass: 'goal-mind' },
  { key: 'Social Life', icon: '🤝', title: 'Social Life', sub: 'Network & communication', colorClass: 'goal-social' },
  { key: 'Career & Practical Life', icon: '🧭', title: 'Career & Practical Life', sub: 'Projects, decisions & everyday skills', colorClass: 'goal-career' },
];

// Supabase column mapping for real schema
const ACTIVITY_SELECT = 'id,display_order,category,title_en,title_hi,description_en,description_hi,difficulty,total_xp,cover_image_url,is_guest_allowed,is_published,created_at';
const TASK_SELECT = 'id,activity_id,task_number,task_type,title_en,title_hi,instructions_en,instructions_hi,min_time_seconds,xp_reward';

const TRANSLATIONS = {
  EN: {
    welcome: 'Choose Your Growth Path',
    sub_welcome: 'Select a focus area to unlock personalized weekly activities:',
    banner_sub: 'Click any activity card below to start earning Weekly XP!',
    change_goal: '🔄 Switch Goal',
    guest_trial: 'Free Tasks',
    rank_btn: '🏆 Leaderboard',
    login_save: 'Login to Save XP',
    guest_limit: '3/3 Free Tasks Completed!',
    guest_msg: 'You\'ve used your demo quota. Login to save your XP, unlock custom goals, and access all activities.',
    task_complete: 'Complete Task',
    task_skip: 'Skip Task (0 XP)',
    timer_min: 'min',
    timer_sec: 'sec',
    proof_placeholder: 'Describe what you did, paste a link, or share your reflection...',
    proof_label: 'Your Proof / Reflection',
    completed: 'Mission Accomplished!',
    xp_earned: 'XP Earned',
    back_dashboard: 'Back to Dashboard',
    view_leaderboard: 'View Leaderboard',
    language: 'Language',
    lang_switched: 'Language switched to',
  },
  HI: {
    welcome: 'Apna Growth Goal Chunein',
    sub_welcome: 'Apne hisab se best activities dekhne ke liye ek category select karein:',
    banner_sub: 'Niche kisi bhi activity card par click karein aur Weekly XP jeetein!',
    change_goal: '🔄 Goal Badlein',
    guest_trial: 'Free Tasks',
    rank_btn: '🏆 Ranking',
    login_save: 'XP Save Karne Login Karein',
    guest_limit: '3/3 Free Tasks Pure Hue!',
    guest_msg: 'Aapna demo quota pura ho gaya. Apna XP save karne aur saare activities unlock karne ke liye login karein.',
    task_complete: 'Task Complete Karein',
    task_skip: 'Skip Karein (0 XP)',
    timer_min: 'मिनट',
    timer_sec: 'सेकंड',
    proof_placeholder: 'Aapne kya kiya, link paste karein, ya apna reflection share karein...',
    proof_label: 'Aapka Proof / Reflection',
    completed: 'Mission Poora Hua!',
    xp_earned: 'XP Mila',
    back_dashboard: 'Dashboard Par Wapas',
    view_leaderboard: 'Leaderboard Dekhein',
    language: 'Bhasha',
    lang_switched: 'Bhasha badli gayi',
  }
};

// ─── STATE ──────────────────────────────────────────────────────────────────
let currentUser = null;
let userProfile = null;
let isAdmin = false;
let currentLanguage = 'EN';
let guestTasksPlayed = 0;
let selectedCategory = null;
let currentActivityId = null;
let currentTaskIndex = 0;
let taskTimerInterval = null;
let taskStartTime = null;
let activitiesCache = new Map();

// ─── DOM ELEMENTS ───────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const guestView = $('guestView');
const onboardingView = $('onboardingView');
const dashboardView = $('dashboardView');
const guestActivities = $('guestActivities');
const guestLimitNotice = $('guestLimitNotice');
const goalGrid = $('goalGrid');
const categoryBanner = $('categoryBanner');
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
currentLanguage = localStorage.getItem('trio_language') || 'EN';
guestTasksPlayed = parseInt(localStorage.getItem('trio_guest_tasks') || '0', 10);
selectedCategory = localStorage.getItem('trio_selected_category');

document.documentElement.setAttribute('data-lang', currentLanguage);
if (typeof applyTranslations === 'function') applyTranslations();

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      userProfile = userDoc.exists() ? userDoc.data() : null;
      isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase());
      setAdminFlag(isAdmin);
      
      // Check if user has completed onboarding
      const hasOnboarded = userProfile?.onboardingComplete === true;
      const hasCategory = userProfile?.selectedCategory;
      
      if (!hasOnboarded || !hasCategory) {
        showOnboarding();
      } else {
        selectedCategory = hasCategory;
        showDashboard();
      }
      
      // Sync guest XP if any
      if (guestTasksPlayed > 0) {
        await syncGuestXP();
      }
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
  
  renderAuthStatus();
});

// ─── AUTH STATUS (Navbar) ───────────────────────────────────────────────────
function renderAuthStatus() {
  const authStatus = $('authStatus');
  if (!authStatus) return;
  
  if (currentUser) {
    const name = userProfile?.displayName || userProfile?.name || currentUser.displayName || 'You';
    const initial = name.trim().charAt(0).toUpperCase();
    const photo = userProfile?.photoURL || currentUser.photoURL;
    
    authStatus.innerHTML = `
      <span class="streak-badge">🔥 ${userProfile?.streakCurrent || 0}d Streak</span>
      <a href="leaderboard.html" class="status-badge">${t('rank_btn')}</a>
      <span class="xp-badge-nav">⚡ ${userProfile?.weeklyXp || 0} XP</span>
      <button id="langToggleBtn" class="lang-toggle" aria-label="${t('language')}">${currentLanguage}</button>
      <div style="position:relative">
        <button id="profileAvatarBtn" class="profile-pic-btn" aria-label="Profile" style="background:none;border:none;padding:0;cursor:pointer">
          ${photo ? `<img src="${cloudinaryAutoUrl(esc(photo))}" alt="" style="width:42px;height:42px;border-radius:50%;border:2px solid #00FFCC;object-fit:cover">` : `<div class="profile-avatar-placeholder" style="width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#8B5CF6,#00FFCC);color:#05070B;font-weight:900;font-size:16px;border:2px solid #00FFCC">${esc(initial)}</div>`}
        </button>
      </div>
    `;
    
    // Profile avatar click -> profile.html
    const avatarBtn = $('profileAvatarBtn');
    if (avatarBtn) avatarBtn.onclick = () => location.href = 'profile.html';
    
    // Language toggle
    const langBtn = $('langToggleBtn');
    if (langBtn) langBtn.onclick = toggleLanguage;
    
  } else {
    const remaining = Math.max(0, GUEST_TASK_LIMIT - guestTasksPlayed);
    authStatus.innerHTML = `
      <span class="streak-badge">🔥 0d Streak</span>
      <a href="leaderboard.html" class="status-badge">${t('rank_btn')}</a>
      <span class="xp-badge-nav">⚡ 0 XP</span>
      <button id="langToggleBtn" class="lang-toggle" aria-label="${t('language')}">${currentLanguage}</button>
      <a href="login.html" class="status-badge">🔑 Login (${remaining}/${GUEST_TASK_LIMIT} ${t('guest_trial')})</a>
      <a href="login.html"><img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80" alt="Profile" class="profile-pic" style="width:42px;height:42px;border-radius:50%;border:2px solid #00FFCC;object-fit:cover"></a>
    `;
    
    const langBtn = $('langToggleBtn');
    if (langBtn) langBtn.onclick = toggleLanguage;
  }
}

// ─── LANGUAGE TOGGLE ────────────────────────────────────────────────────────
function toggleLanguage() {
  currentLanguage = currentLanguage === 'EN' ? 'HI' : 'EN';
  localStorage.setItem('trio_language', currentLanguage);
  document.documentElement.setAttribute('data-lang', currentLanguage);
  location.reload(); // Simple and reliable - full page reload for language change
}

function t(key) {
  return TRANSLATIONS[currentLanguage][key] || key;
}

function showToast(msg) {
  langToast.textContent = msg;
  langToast.hidden = false;
  setTimeout(() => { langToast.hidden = true; }, 2500);
}

// ─── VIEW SWITCHING ─────────────────────────────────────────────────────────
function hideAllViews() {
  [guestView, onboardingView, dashboardView].forEach(v => { if (v) v.hidden = true; });
}

function showGuestView() {
  hideAllViews();
  guestView.hidden = false;
  renderGuestActivities();
  updateGuestLimitUI();
}

function showOnboarding() {
  hideAllViews();
  onboardingView.hidden = false;
  renderGoalCards();
}

function showDashboard() {
  hideAllViews();
  dashboardView.hidden = false;
  renderDashboard();
}

function reRenderCurrentView() {
  if (!guestView.hidden) renderGuestActivities();
  else if (!onboardingView.hidden) renderGoalCards();
  else if (!dashboardView.hidden) renderDashboard();
}

// ─── GUEST VIEW ─────────────────────────────────────────────────────────────
async function renderGuestActivities() {
  guestActivities.innerHTML = '<div class="activity-skeleton"></div><div class="activity-skeleton"></div><div class="activity-skeleton"></div>';
  
  try {
    const activities = await fetchActivities({ guestAllowed: true, limit: 3 });
    guestActivities.innerHTML = activities.map((act, i) => renderActivityCard(act, i + 1, false)).join('');
    attachActivityCardListeners();
  } catch (err) {
    console.error('[Today] Failed to load guest activities:', err);
    guestActivities.innerHTML = `
      <div class="task-box" style="text-align:center">
        <p style="color:var(--color-ink-muted)">Failed to load activities. <button class="btn secondary" onclick="renderGuestActivities()">Retry</button></p>
      </div>
    `;
  }
}

function updateGuestLimitUI() {
  const remaining = Math.max(0, GUEST_TASK_LIMIT - guestTasksPlayed);
  const authStatus = $('authStatus');
  if (authStatus) {
    const loginLink = authStatus.querySelector('a[href="login.html"]');
    if (loginLink) loginLink.textContent = `🔑 Login (${remaining}/${GUEST_TASK_LIMIT} ${t('guest_trial')})`;
  }
  
  if (guestTasksPlayed >= GUEST_TASK_LIMIT) {
    guestLimitNotice.hidden = false;
    guestActivities.innerHTML = '';
  } else {
    guestLimitNotice.hidden = true;
  }
}

// ─── ONBOARDING ─────────────────────────────────────────────────────────────
function renderGoalCards() {
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
  localStorage.setItem('trio_selected_category', category);
  
  if (currentUser) {
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        selectedCategory: category,
        onboardingComplete: true,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('[Today] Failed to save category:', err);
    }
  }
  
  showDashboard();
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
async function renderDashboard() {
  if (!selectedCategory) { showOnboarding(); return; }
  
  const cat = GOAL_CATEGORIES.find(c => c.key === selectedCategory) || GOAL_CATEGORIES[0];
  catName.textContent = `${cat.icon} ${cat.title} Activities`;
  catSub.textContent = t('banner_sub');
  changeGoalBtn.textContent = t('change_goal');
  changeGoalBtn.onclick = (e) => { e.preventDefault(); showOnboarding(); };
  
  activityList.innerHTML = '<div class="activity-skeleton"></div><div class="activity-skeleton"></div><div class="activity-skeleton"></div>';
  
  try {
    const activities = await fetchActivities({ category: selectedCategory, limit: 10 });
    activityList.innerHTML = activities.map((act, i) => renderActivityCard(act, i + 1, true)).join('');
    attachActivityCardListeners();
  } catch (err) {
    console.error('[Today] Failed to load activities:', err);
    activityList.innerHTML = `
      <div class="task-box" style="text-align:center">
        <p style="color:var(--color-ink-muted)">Failed to load activities. <button class="btn secondary" onclick="renderDashboard()">Retry</button></p>
      </div>
    `;
  }
}

// ─── ACTIVITY CARD RENDER ───────────────────────────────────────────────────
function renderActivityCard(act, index, isLoggedIn) {
  const title = currentLanguage === 'HI' ? (act.title_hi || act.title_en) : act.title_en;
  const description = currentLanguage === 'HI' ? (act.description_hi || act.description_en) : act.description_en;
  
  const imgHtml = act.cover_image_url 
    ? `<img src="${esc(act.cover_image_url)}" alt="${esc(title)}" loading="lazy">`
    : `<div class="card-img-placeholder">${act.icon || '⚡'}</div>`;
  
  const difficultyLabel = act.difficulty || '3 Tasks';
  const xpLabel = act.total_xp ? `+${act.total_xp} XP` : '+100 XP';
  
  return `
    <a href="#" class="activity-card" data-activity-id="${act.id}" data-logged-in="${isLoggedIn}">
      <div class="card-left">
        <span class="card-number">${String(index).padStart(2, '0')}</span>
        <div class="card-info">
          <h2>${esc(title)}</h2>
          <p>${esc(description || 'Complete tasks to earn XP')}</p>
          <div class="card-tags">
            <span class="tag-pill">🎯 ${esc(difficultyLabel)}</span>
            <span class="tag-xp">⚡ ${esc(xpLabel)}</span>
          </div>
        </div>
      </div>
      <div class="card-right">
        ${imgHtml}
      </div>
    </a>
  `;
}

function attachActivityCardListeners() {
  document.querySelectorAll('.activity-card').forEach(card => {
    card.addEventListener('click', e => {
      e.preventDefault();
      const actId = card.dataset.activityId;
      const isLoggedIn = card.dataset.loggedIn === 'true';
      startActivity(actId, isLoggedIn);
    });
  });
}

// ─── ACTIVITY PLAYER NAVIGATION ─────────────────────────────────────────────
function startActivity(activityId, isLoggedIn) {
  if (!isLoggedIn && guestTasksPlayed >= GUEST_TASK_LIMIT) {
    showLoginModal();
    return;
  }
  
  currentActivityId = activityId;
  currentTaskIndex = 0;
  // Navigate to activity player page with activity ID
  location.href = `activity-player.html?act=${encodeURIComponent(activityId)}`;
}

// ─── SUPABASE FETCH ─────────────────────────────────────────────────────────
async function fetchActivities({ category, guestAllowed, limit: lim = 10 } = {}) {
  const cacheKey = `${category || 'guest'}-${guestAllowed}-${lim}`;
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
  activitiesCache.set(cacheKey, data);
  return data;
}

// ─── GUEST XP SYNC ──────────────────────────────────────────────────────────
async function syncGuestXP() {
  if (!currentUser || guestTasksPlayed === 0) return;
  
  try {
    // Check if already synced via user_sync_meta table
    const metaDoc = await getDoc(doc(db, 'user_sync_meta', currentUser.uid));
    if (metaDoc.exists() && metaDoc.data().guest_xp_claimed) return;
    
    const guestXP = guestTasksPlayed * 50; // Estimate
    const userRef = doc(db, 'users', currentUser.uid);
    const userSnap = await getDoc(userRef);
    const currentXP = userSnap.exists() ? (userSnap.data().weeklyXp || 0) : 0;
    const newXP = currentXP + guestXP;
    
    await updateDoc(userRef, {
      weeklyXp: newXP,
      xp: newXP, // Assuming total XP = weekly for new users
      guestXpSynced: true,
      updatedAt: serverTimestamp()
    });
    
    // Mark as synced in user_sync_meta
    await setDoc(doc(db, 'user_sync_meta', currentUser.uid), {
      guest_xp_claimed: true,
      guest_tasks_synced: guestTasksPlayed,
      claimed_at: serverTimestamp()
    });
    
    // Clear guest data
    guestTasksPlayed = 0;
    localStorage.removeItem('trio_guest_tasks');
    localStorage.removeItem('trio_guest_xp');
    
    renderAuthStatus();
    showToast(`Synced ${guestXP} XP from guest session!`);
  } catch (err) {
    console.error('[Today] Guest XP sync failed:', err);
  }
}

// ─── LOGIN MODAL ────────────────────────────────────────────────────────────
function showLoginModal() {
  guestXpDisplay.textContent = guestTasksPlayed * 50;
  loginModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function hideLoginModal() {
  loginModal.hidden = true;
  document.body.style.overflow = '';
  loginForm.reset();
  signupForm.reset();
  loginError.style.display = 'none';
  signupError.style.display = 'none';
}

loginModalClose.onclick = hideLoginModal;
loginModal.onclick = e => { if (e.target === loginModal) hideLoginModal(); };

modalTabs.forEach(tab => {
  tab.onclick = () => {
    modalTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    modalPanels.forEach(p => p.hidden = true);
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    $(`${tab.dataset.tab}TabPanel`).hidden = false;
  };
});

loginForm.onsubmit = async e => {
  e.preventDefault();
  loginError.style.display = 'none';
  try {
    await auth.signInWithEmailAndPassword(loginEmail.value, loginPassword.value);
    hideLoginModal();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.style.display = 'block';
  }
};

signupForm.onsubmit = async e => {
  e.preventDefault();
  signupError.style.display = 'none';
  try {
    const cred = await auth.createUserWithEmailAndPassword(signupEmail.value, signupPassword.value);
    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName: signupName.value,
      email: signupEmail.value,
      weeklyXp: guestTasksPlayed * 50,
      xp: guestTasksPlayed * 50,
      streakCurrent: 0,
      onboardingComplete: false,
      createdAt: serverTimestamp()
    });
    hideLoginModal();
  } catch (err) {
    signupError.textContent = err.message;
    signupError.style.display = 'block';
  }
};

// ─── EXPORTS ────────────────────────────────────────────────────────────────
window.startActivity = startActivity;
window.showLoginModal = showLoginModal;
window.toggleLanguage = toggleLanguage;