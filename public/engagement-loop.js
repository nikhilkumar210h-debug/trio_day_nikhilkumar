import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, limit,
  serverTimestamp, writeBatch, increment
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getCachedUser, getCachedUserProfile } from './services/userCache.js';
import { showToast } from './ui/toast.js';
import { createSheet } from './ui/sheet.js';

const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'''}[c]));

const AGG_DOC = 'engagement/aggregates';
const DAILY_SEED_KEY = 'engagement_daily_seed';
const PICK_MATCH_CACHE = 'pick_match_';

function todayKey() { return new Date().toISOString().slice(0,10); }

async function ensureAggregates() {
  const ref = doc(db, AGG_DOC);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      totalAnswers: 0,
      totalChallenges: 0,
      totalUsers: 0,
      todayAnswers: 0,
      todayKey: todayKey(),
      updatedAt: serverTimestamp()
    });
  }
}

async function incrementTodayAnswers() {
  await ensureAggregates();
  const ref = doc(db, AGG_DOC);
  const today = todayKey();
  const snap = await getDoc(ref);
  const data = snap.data() || {};
  if (data.todayKey !== today) {
    await setDoc(ref, { todayAnswers: 1, todayKey: today, totalAnswers: increment(1), updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await setDoc(ref, { todayAnswers: increment(1), totalAnswers: increment(1), updatedAt: serverTimestamp() }, { merge: true });
  }
}

export async function getAggregateCounts() {
  await ensureAggregates();
  const snap = await getDoc(doc(db, AGG_DOC));
  return snap.data() || {};
}

export async function recordAnswerAndTriggerRewards(challengeId, choice, user) {
  await incrementTodayAnswers();
  
  const responses = await getDocs(query(
    collection(db, 'challengeAnswers'),
    where('challengeId', '==', challengeId),
    where('choice', '==', choice),
    where('uid', '!=', user.uid)
  ));
  
  const sameCount = responses.size;
  
  if (sameCount > 0) {
    const pickMatchKey = PICK_MATCH_CACHE + challengeId + '_' + choice;
    const cached = localStorage.getItem(pickMatchKey);
    if (!cached) {
      localStorage.setItem(pickMatchKey, 'shown');
      setTimeout(() => {
        showToast(`${sameCount} ${sameCount===1?'person':'people'} picked the same as you! 🎉`, 'success');
      }, 800);
    }
  }
  
  return { sameCount };
}

async function seedDailyContentIfNeeded() {
  const key = todayKey();
  const cached = localStorage.getItem(DAILY_SEED_KEY);
  if (cached === key) return;
  
  try {
    const challengesSnap = await getDocs(query(
      collection(db, 'communityTasks'),
      where('status', '==', 'active'),
      where('kind', '==', 'challenge'),
      limit(20)
    ));
    
    if (challengesSnap.empty) {
      await seedBuiltInChallenges();
    }
    
    await seedSampleUsersIfEmpty();
    localStorage.setItem(DAILY_SEED_KEY, key);
  } catch (err) {
    console.warn('seedDailyContentIfNeeded:', err);
  }
}

async function seedBuiltInChallenges() {
  const builtIn = [
    { id:'trip', tag:'CHOICE', q:'You get one free trip tomorrow. Where are you going?', o:['Japan 🇯🇵','Switzerland 🇨🇭','Somewhere unexpected 🌍'], tagLabel:'QUICK PICK' },
    { id:'hour', tag:'MOOD', q:'You have one free hour tonight. What sounds better?', o:['Talk to someone 💬','Play something 🎮','Learn something 🧠'], tagLabel:'MOOD' },
    { id:'weekend', tag:'MAKE', q:'You have one weekend to make something. What do you pick?', o:['An app 💻','A game 🎮','Something useful 🛠️'], tagLabel:'MAKE' },
    { id:'food', tag:'LIFE', q:'Pick one forever.', o:['Street food 🌮','Home food 🍲','Restaurant food 🍽️'], tagLabel:'LIFE' },
    { id:'study-reset', tag:'STUDY', q:'You have 30 minutes before an important test. What do you do?', o:['Review notes 📚','Solve questions ✍️','Take a short reset 🧠'], tagLabel:'STUDY' },
    { id:'career-path', tag:'CAREER', q:'You can try one career skill for a month. Which one?', o:['Build projects 💻','Communicate better 🎤','Analyze data 📊'], tagLabel:'CAREER' },
    { id:'focus-mode', tag:'STUDY', q:'What helps you protect a focused study session?', o:['Phone away 📵','Timed blocks ⏱️','Study with someone 👥'], tagLabel:'STUDY' },
    { id:'build-vs-watch', tag:'TECH', q:'You have one evening for tech. What sounds better?', o:['Build a mini tool 🔧','Learn a new concept 🧠','Explore a cool project 🔍'], tagLabel:'TECH' }
  ];
  
  const batch = writeBatch(db);
  const now = Date.now();
  for (const c of builtIn) {
    const ref = doc(db, 'communityTasks', c.id);
    batch.set(ref, {
      title: c.q.slice(0, 100),
      description: c.q,
      icon: '⚡',
      kind: 'challenge',
      activityType: 'challenge',
      category: 'Community',
      mechanic: 'choice',
      durationMin: 2,
      difficulty: 'Easy',
      goal: 'Choose an answer and compare your thinking with other people.',
      instructions: 'Pick one choice, then join the public discussion.',
      expiresInDays: 14,
      metric: 'manual',
      target: 1,
      xpReward: 25,
      interaction: { kind: 'choice', question: c.q, options: c.o, correct: null, proofRequired: false, format: 'quick' },
      creatorUid: 'system',
      creatorName: 'Trio Day',
      creatorPhoto: null,
      startAtMs: now,
      endAtMs: now + 14 * 86400000,
      status: 'active',
      featured: false,
      hidden: false,
      joins: 0,
      likes: 0,
      comments: 0,
      completions: 0,
      createdAt: serverTimestamp(),
      createdAtMs: now
    }, { merge: true });
  }
  await batch.commit();
}

async function seedSampleUsersIfEmpty() {
  const usersSnap = await getDocs(query(collection(db, 'users'), limit(5)));
  if (usersSnap.size >= 5) return;
  
  const sampleUsers = [
    { uid: 'seed_user_1', name: 'Priya Sharma', userId: 'TRIO-A1B2C3D4', bio: 'Building cool things 🚀', xp: 250, level: 3, streakCurrent: 7, streakBest: 12 },
    { uid: 'seed_user_2', name: 'Arjun Patel', userId: 'TRIO-E5F6G7H8', bio: 'Student • Developer', xp: 180, level: 2, streakCurrent: 3, streakBest: 8 },
    { uid: 'seed_user_3', name: 'Ananya Reddy', userId: 'TRIO-I9J0K1L2', bio: 'Design • Code • Coffee', xp: 420, level: 5, streakCurrent: 15, streakBest: 21 },
    { uid: 'seed_user_4', name: 'Rohan Gupta', userId: 'TRIO-M3N4O5P6', bio: 'Full-stack dreamer', xp: 95, level: 1, streakCurrent: 1, streakBest: 4 },
    { uid: 'seed_user_5', name: 'Kavya Nair', userId: 'TRIO-Q7R8S9T0', bio: 'Making learning fun', xp: 310, level: 4, streakCurrent: 10, streakBest: 18 }
  ];
  
  const batch = writeBatch(db);
  for (const u of sampleUsers) {
    const ref = doc(db, 'users', u.uid);
    batch.set(ref, { ...u, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  }
  await batch.commit();
}

export async function initializeEngagementLoop(user) {
  await seedDailyContentIfNeeded();
  await ensureAggregates();
  
  const aggregates = await getAggregateCounts();
  updateTodayLiveCounter(aggregates);
  
  if (user) {
    setupFriendActivityListener(user.uid);
    checkStreakAtRisk(user.uid);
  }
  
  window.addEventListener('trio-xp-changed', e => {
    if (e.detail?.uid === user?.uid) {
      updateProfileXPDisplay();
    }
  });
}

function updateTodayLiveCounter(aggregates) {
  const el = document.getElementById('todayLiveCounter');
  if (el && aggregates.todayAnswers) {
    el.textContent = `${aggregates.todayAnswers} answers today`;
  }
}

function checkStreakAtRisk(uid) {
  const lastActive = localStorage.getItem(`streak_last_active_${uid}`);
  const now = Date.now();
  if (lastActive) {
    const diff = now - parseInt(lastActive);
    if (diff > 20 * 60 * 60 * 1000 && diff < 24 * 60 * 60 * 1000) {
      showStreakAtRiskNotification();
    }
  }
}

function showStreakAtRiskNotification() {
  if (document.getElementById('streakRiskToast')) return;
  const toast = document.createElement('div');
  toast.id = 'streakRiskToast';
  toast.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom,0)+5rem);left:50%;transform:translateX(-50%);background:#f59e0b;color:#fff;padding:0.75rem 1.35rem;border-radius:2rem;font-weight:600;z-index:9999;max-width:calc(100vw-2rem);text-align:center;animation:trioToastIn 0.25s ease';
  toast.innerHTML = '⚠️ Your streak is at risk! Answer a challenge before midnight to keep it.';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}

function setupFriendActivityListener(uid) {
  const friendsRef = collection(db, 'users', uid, 'following');
  const unsubscribe = onSnapshot(query(friendsRef, limit(50)), snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        const friendUid = change.doc.id;
        listenToFriendAnswers(friendUid);
      }
    });
  });
}

async function listenToFriendAnswers(friendUid) {
  const answersRef = collection(db, 'challengeAnswers');
  const q = query(answersRef, where('uid', '==', friendUid), orderBy('createdAtMs', 'desc'), limit(1));
  const unsubscribe = onSnapshot(q, async snap => {
    const doc = snap.docs[0];
    if (!doc) return;
    const data = doc.data();
    if (!data) return;
    
    const challengeSnap = await getDoc(doc(db, 'communityTasks', data.challengeId)).catch(() => null);
    if (!challengeSnap?.exists()) return;
    const challenge = challengeSnap.data();
    
    const profile = await getCachedUserProfile(friendUid).catch(() => null);
    const name = profile?.name || 'A friend';
    
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom,0)+5rem);left:50%;transform:translateX(-50%);background:var(--color-primary);color:#fff;padding:0.75rem 1.35rem;border-radius:2rem;font-weight:600;z-index:9999;max-width:calc(100vw-2rem);text-align:center;animation:trioToastIn 0.25s ease;cursor:pointer';
    toast.innerHTML = `${name} answered "${challenge.interaction?.question || 'a challenge'}"`;
    toast.onclick = () => { location.href = `challenge.html?challenge=${encodeURIComponent(data.challengeId)}`; };
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  });
  
  return unsubscribe;
}

export function showInviteFriendSheet(challengeId) {
  const url = new URL('challenge.html', location.origin);
  url.searchParams.set('challenge', challengeId);
  
  const { sheet, open, close } = createSheet({
    title: 'Invite a Friend',
    content: `
      <div style="text-align:center;padding:1rem">
        <p style="margin-bottom:1rem;color:var(--color-ink-muted)">Share this challenge link:</p>
        <div style="display:flex;gap:8px;justify-content:center;margin-bottom:1rem">
          <input id="inviteLink" value="${esc(url.href)}" readonly style="flex:1;padding:10px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-glass);color:var(--color-ink);font-size:13px" aria-label="Challenge invite link">
          <button type="button" class="nkm-btn nkm-btn--primary" id="copyInviteLink" style="white-space:nowrap">Copy</button>
        </div>
        <button type="button" class="nkm-btn nkm-btn--secondary" id="nativeShareInvite" style="width:100%">Share via System Sheet</button>
      </div>
    `,
    actions: ''
  });
  
  sheet.querySelector('#copyInviteLink').onclick = async () => {
    await navigator.clipboard.writeText(url.href);
    showToast('Invite link copied ✓', 'success');
  };
  
  sheet.querySelector('#nativeShareInvite').onclick = async () => {
    close();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Trio Day Challenge', url: url.href });
      } else {
        await navigator.clipboard.writeText(url.href);
        showToast('Link copied ✓', 'success');
      }
    } catch (err) {
      if (err.name !== 'AbortError') showToast('Could not share', 'error');
    }
  };
  
  open();
}

export function showOppositeChatSheet(challengeId, otherUid) {
  const { sheet, open, close } = createSheet({
    title: 'Opposite Chat',
    content: `
      <div style="text-align:center;padding:1rem">
        <p style="margin-bottom:1rem;color:var(--color-ink-muted)">You picked differently. Want to chat?</p>
        <button type="button" class="nkm-btn nkm-btn--primary" data-action="chat" style="margin-bottom:8px;width:100%">💬 Start Chat</button>
        <button type="button" class="nkm-btn nkm-btn--secondary" data-action="async" style="width:100%">⏳ Async Reply (they'll get notified)</button>
      </div>
    `,
    actions: ''
  });
  
  sheet.querySelector('[data-action="chat"]').onclick = () => {
    close();
    location.href = `temp-chat.html?challenge=${encodeURIComponent(challengeId)}&other=${encodeURIComponent(otherUid)}`;
  };
  
  sheet.querySelector('[data-action="async"]').onclick = async () => {
    close();
    try {
      const me = await getCachedUser(auth.currentUser.uid);
      await setDoc(doc(db, 'tempChatInvites', `${challengeId}_${auth.currentUser.uid}_${otherUid}`), {
        challengeId,
        fromUid: auth.currentUser.uid,
        fromName: me?.name || 'Someone',
        toUid: otherUid,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      showToast('They\'ll be notified to reply when they\'re back', 'success');
    } catch (err) {
      showToast('Could not send invite', 'error');
    }
  };
  
  open();
}

export function showTomorrowTeaser() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const key = tomorrow.toISOString().slice(0,10);
  
  const { sheet, open, close } = createSheet({
    title: 'Tomorrow\'s Challenge',
    content: `
      <div style="text-align:center;padding:1rem">
        <p style="margin-bottom:1rem;color:var(--color-ink-muted)">Coming tomorrow:</p>
        <div style="background:var(--color-primary-soft);border:1px solid var(--color-primary);border-radius:12px;padding:1rem;margin-bottom:1rem">
          <strong style="color:var(--color-primary-text)">New Daily Question</strong>
          <p style="margin:8px 0 0;color:var(--color-ink)">A fresh question for everyone. Be the first to answer.</p>
        </div>
        <button type="button" class="nkm-btn nkm-btn--primary" data-action="remind" style="width:100%">🔔 Remind Me Tomorrow</button>
      </div>
    `,
    actions: ''
  });
  
  sheet.querySelector('[data-action="remind"]').onclick = () => {
    close();
    localStorage.setItem('tomorrow_reminder', 'true');
    showToast('We\'ll remind you tomorrow morning', 'success');
  };
  
  open();
}

function updateProfileXPDisplay() {
  const xpEl = document.getElementById('pgXp');
  const levelEl = document.getElementById('pgLevel');
  if (xpEl || levelEl) {
    const xp = parseInt(localStorage.getItem('current_xp') || '0');
    const level = Math.floor(xp / 100) + 1;
    if (xpEl) xpEl.textContent = xp;
    if (levelEl) levelEl.textContent = level;
  }
}

onAuthStateChanged(auth, async user => {
  if (user) {
    localStorage.setItem(`streak_last_active_${user.uid}`, Date.now().toString());
    await initializeEngagementLoop(user);
  }
});

export { todayKey, getAggregateCounts, recordAnswerAndTriggerRewards, showInviteFriendSheet, showOppositeChatSheet, showTomorrowTeaser };