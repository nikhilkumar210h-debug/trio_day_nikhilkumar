import { auth, db } from './firebase-init.js';
import { notifyUser } from './services/notificationHelpers.js';
import { uploadStoryMedia } from './image-upload.js';
import { trioCache } from './trio-cache.js';
import { getCachedUserProfile, getMyProfile, getCachedUser } from './services/userCache.js';
import { SoundManager } from './sound-manager.js';
import { onPostCreated, onLikeGiven, onLikeReceived, onCommentCreated } from './gamification/auto-metrics.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, addDoc, onSnapshot, serverTimestamp,
  doc, getDoc, setDoc, deleteDoc, query, orderBy,
  getDocs, limit, where, deleteField
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { makeUserId, escapeHtml, initials, formatTime, getFilterCSS } from './utils.js';
import { listCommunityTasks, isMember, getMyJoinedTaskIds } from './gamification/community-tasks.js';
import { activityCardHtml, normalizeActivityType } from './activity-ui.js';
import { activeCatalogActivities } from './activity-catalog.js';

const $ = id => document.getElementById(id);
let currentUser = null;
let storyPrivacy = 'public';

const FOCUS_MODES = {
  surprise: { label: 'Surprise' },
  quick: { label: 'Quick' },
  think: { label: 'Think' },
  make: { label: 'Make' },
  learn: { label: 'Learn' },
  social: { label: 'Social' }
};

function getFocusMode(uid = '') {
  const saved = localStorage.getItem('trio_focus_mode');
  if (saved && FOCUS_MODES[saved]) return saved;
  const seed = Array.from(String(uid || 'guest')).reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const modes = ['quick', 'think', 'make', 'learn', 'social'];
  return modes[Math.floor((Math.floor(Date.now() / 86400000) + seed) % modes.length)];
}

function setFocusMode(mode) {
  if (!FOCUS_MODES[mode]) return;
  localStorage.setItem('trio_focus_mode', mode);
  document.querySelectorAll('[data-focus-mode]').forEach(btn => {
    const active = btn.dataset.focusMode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  if (currentUser) renderFocusAndContinue(currentUser.uid);
}

function initFocusModePicker(uid) {
  const mode = getFocusMode(uid);
  document.querySelectorAll('[data-focus-mode]').forEach(btn => {
    const active = btn.dataset.focusMode === mode;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.classList.toggle('active', active);
    btn.addEventListener('click', () => setFocusMode(btn.dataset.focusMode));
  });
}

// Theme is global (theme.js); no per-page lock here.
SoundManager.init();

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    await ensureUserProfile(user);
    import('./gamification/reminders.js')
      .then(m => m.runAppOpenReminders(user.uid))
      .catch(() => { });
    initTodayScreen(user.uid);
    startNotificationDot(user.uid);
  } else {
    initTodayScreen(null);
  }
  if (feed && cachedPosts.length) render(cachedPosts);
});

async function initTodayScreen(uid) {
  renderGreeting();
  initFocusModePicker(uid || '');
  await renderStoryStrip(uid);
  if (uid) {
    await Promise.all([
      renderFocusAndContinue(uid),
      renderActiveChallenges(uid),
      renderPeople(uid),
    ]);
  }
  // Posts/feed are intentionally removed from Today. Stories and Today activities remain.
}

function renderGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const nameEl = $('greetingName');
  const subEl = $('greetingSub');
  if (nameEl) {
    const userName = currentUser?.displayName || 'Friend';
    nameEl.textContent = userName.split(' ')[0];
  }
  const avatarEl = $('todayAvatar');
  if (avatarEl) {
    const name = currentUser?.displayName || 'N';
    const initial = name.trim().charAt(0).toUpperCase() || 'N';
    if (currentUser?.photoURL) avatarEl.innerHTML = '<img src="' + escapeHtml(currentUser.photoURL) + '" alt="">';
    else avatarEl.textContent = initial;
    avatarEl.title = name;
    avatarEl.onclick = () => { location.href = 'profile.html'; };
  }
  if (subEl) {
    const messages = [
      'Small steps create big results.',
      'Every day is a fresh start.',
      'Progress over perfection.',
      'You\'re doing better than you think.',
      'Keep going — you\'ve got this.',
    ];
    subEl.textContent = messages[Math.floor(Math.random() * messages.length)];
  }
}

async function renderStoryStrip(uid) {
  const wrap = $('heroStories');
  const empty = $('heroStoriesEmpty');
  if (!wrap) return;
  wrap.innerHTML = '';

  const addBtn = document.createElement('button');
  addBtn.className = 'hero-story-circle add-story';
  addBtn.title = 'Add story';
  addBtn.setAttribute('aria-label', 'Add story');
  addBtn.innerHTML = '<span class="hero-story-circle-inner" style="background:var(--primary-soft); color:var(--primary); font-size:28px;">+</span>';
  addBtn.addEventListener('click', () => { SoundManager.click(); openStoryModal(); });
  wrap.appendChild(addBtn);

  try {
    const cacheKey = uid ? `feed_recent_${uid}` : null;
    const cachedFeed = cacheKey ? trioCache.get(cacheKey) : null;
    if (cachedFeed && cachedFeed.length) {
      const now = Date.now();
      const stories = cachedFeed
        .filter(p => p.isStory && p.createdAtMs && (now - p.createdAtMs) < 24 * 60 * 60 * 1000)
        .slice(0, 20);

      if (!stories.length) {
        if (empty) empty.style.display = 'block';
        return;
      }
      if (empty) empty.style.display = 'none';

      stories.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'hero-story-circle';
        btn.title = s.name || 'Story';
        btn.setAttribute('aria-label', `Story from ${s.name || 'User'}`);
        const seenKey = 'seenStories';
        const seenList = JSON.parse(localStorage.getItem(seenKey) || '[]');
        if (seenList.includes(s._id)) btn.classList.add('viewed');
        const inner = document.createElement('span');
        inner.className = 'hero-story-circle-inner';
        if (s.photoURL) {
          const img = document.createElement('img');
          img.src = s.photoURL;
          img.alt = '';
          img.loading = 'lazy';
          inner.appendChild(img);
        } else {
          inner.textContent = (s.name || 'U').charAt(0).toUpperCase();
          inner.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-strong))';
        }
        btn.appendChild(inner);
        btn.addEventListener('click', () => {
          SoundManager.storyTap();
          const cur = JSON.parse(localStorage.getItem(seenKey) || '[]');
          if (!cur.includes(s._id)) {
            cur.push(s._id);
            localStorage.setItem(seenKey, JSON.stringify(cur));
            btn.classList.add('viewed');
          }
          const card = document.querySelector(`[data-postId="${s._id}"]`);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          else openStoryViewer(s);
        });
        wrap.appendChild(btn);
      });
    } else {
      if (empty) empty.style.display = 'block';
    }
  } catch {
    if (empty) empty.style.display = 'block';
  }
  setTimeout(() => { wrap.scrollLeft = 0; }, 50);
}

function openStoryViewer(s) {
  const ov = document.createElement('div');
  ov.className = 'story-viewer-overlay';
  const safeN = escapeHtml(s.name || 'Story');
  const safeM = escapeHtml((s.message || '').slice(0, 120));
  const isOwn = s.uid && currentUser && s.uid === currentUser.uid;
  const isVoice = s.isVoice || s.type === 'voice';
  const mediaTag = isVoice
    ? `<div class="voice-post-player" style="margin:0;border-radius:0"><audio src="${s.mediaUrl}" autoplay controls class="story-viewer-media" style="width:100%;max-height:none"></audio><span class="voice-duration">🎙️ ${Number(s.duration) || 0}s voice</span></div>`
    : s.mediaUrl?.match(/\.mp4|\.webm|\.mov/i)
      ? `<video src="${s.mediaUrl}" controls autoplay playsinline class="story-viewer-media"></video>`
      : s.mediaUrl
        ? `<img src="${s.mediaUrl}" class="story-viewer-media" loading="eager" alt="Story">`
        : '';
  ov.innerHTML = `<div class="story-viewer-card"><div style="overflow:auto">${mediaTag}<div class="story-viewer-body"><strong>${safeN}</strong><p style="margin:6px 0;color:#94a3b8;font-size:13px">${safeM}</p><div class="story-viewer-reactions"><button type="button" class="action-btn mood-btn" data-mood="❤️">❤️</button><button type="button" class="action-btn mood-btn" data-mood="😂">😂</button><button type="button" class="action-btn mood-btn" data-mood="😍">😍</button><button type="button" class="action-btn mood-btn" data-mood="🔥">🔥</button><button type="button" class="action-btn mood-btn" data-mood="💯">💯</button><button type="button" class="action-btn mood-btn" data-mood="🎉">🎉</button></div><div class="story-viewer-reply"><input type="text" maxlength="200" placeholder="Reply to ${safeN}…"><button type="button" class="btn primary sm" data-send>Send</button></div><div class="story-viewer-actions"><button type="button" class="btn secondary" style="flex:1" data-close>Close</button>${isOwn ? '<button type="button" class="btn" style="flex:1;background:#ef4444;color:#fff;border:0" data-del>Delete Story</button>' : '<button type="button" class="btn ghost" style="flex:1" data-share>↗ Share</button>'}</div></div></div></div>`;

  ov.querySelector('[data-close]')?.addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });

  const delBtn = ov.querySelector('[data-del]');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this story?')) return;
      try {
        await deleteDoc(doc(db, 'posts', s._id));
        ov.remove();
      } catch (err) { alert(err.message || 'Delete failed'); }
    });
  }

  const shareBtn = ov.querySelector('[data-share]');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const url = new URL(`view_post.html?postId=${encodeURIComponent(s._id)}`, location.href).href;
      try {
        if (navigator.share) await navigator.share({ title: s.name || 'Story', url });
        else { await navigator.clipboard.writeText(url); alert('Link copied ✅'); }
      } catch {}
    });
  }

  const reacts = ov.querySelectorAll('.mood-btn');
  try {
    onSnapshot(collection(db, 'posts', s._id, 'moods'), snap => {
      const counts = {}; let my = null;
      snap.forEach(d => { const m = d.data()?.mood; if (m) counts[m] = (counts[m] || 0) + 1; if (d.id === currentUser?.uid) my = m; });
      reacts.forEach(b => {
        const mm = b.dataset.mood;
        const c = counts[mm] || 0;
        b.innerHTML = mm + (c ? ` <span style="font-size:10px;background:#6366f1;color:#fff;border-radius:999px;padding:0 4px;margin-left:2px">${c}</span>` : '');
        b.classList.toggle('liked', my === mm);
        if (my === mm) b.style.background = 'rgba(99,102,241,.18)'; else b.style.background = '';
      });
    }, () => {});
  } catch {}

  reacts.forEach(b => {
    b.addEventListener('click', async () => {
      if (!currentUser) return alert('Login karke react karo.');
      const mood = b.dataset.mood;
      const ref = doc(db, 'posts', s._id, 'moods', currentUser.uid);
      try {
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data()?.mood === mood) await deleteDoc(ref);
        else {
          await setDoc(ref, { uid: currentUser.uid, mood, createdAt: serverTimestamp() });
          if (!snap.exists()) {
            getMyProfile(currentUser.uid).then(me => notifyUser(s.uid, { type: 'like', actorUid: currentUser.uid, actorName: me?.name || currentUser.displayName || 'Someone', postId: s._id }).catch(() => {})).catch(() => {});
            onLikeGiven(currentUser.uid);
            if (s.uid && s.uid !== currentUser.uid) onLikeReceived(s.uid);
          }
        }
        SoundManager.moodSelect();
      } catch (e) { alert(e.message || 'React failed'); }
    });
  });

  const replyInput = ov.querySelector('.story-viewer-reply input');
  const sendBtn = ov.querySelector('[data-send]');
  const doReply = async () => {
    const text = replyInput.value.trim();
    if (!text) return;
    if (!currentUser) return alert('Login karke reply karo.');
    if (s.uid === currentUser.uid) return alert('Apni story pe reply nahi kar sakte.');
    if (text.length > 200) return alert('200 chars max');
    sendBtn.disabled = true; sendBtn.textContent = '…';
    try {
      const me = await getMyProfile(currentUser.uid);
      let allowedUids = [currentUser.uid];
      if (storyPrivacy === 'friends') {
        const [followingSnap, followersSnap] = await Promise.all([
          getDocs(query(collection(db, 'users', currentUser.uid, 'following'), limit(500))),
          getDocs(query(collection(db, 'users', currentUser.uid, 'followers'), limit(500)))
        ]);
        const following = new Set(followingSnap.docs.map(d => d.id));
        const mutual = followersSnap.docs.map(d => d.id).filter(id => following.has(id));
        allowedUids = [currentUser.uid, ...mutual].slice(0, 500);
      }
      const chatId = [currentUser.uid, s.uid].sort().join('_');
      await addDoc(collection(db, 'privateChats', chatId, 'messages'), {
        uid: currentUser.uid,
        name: me?.name || currentUser.displayName || 'User',
        userId: me?.userId || makeUserId(currentUser.uid),
        text: `↩️ Replied to your story: "${text}"`,
        replyToStoryId: s._id,
        storyPreview: s.mediaUrl || null,
        originalStoryText: s.message || '',
        createdAt: Date.now(),
        createdAtMs: Date.now()
      });
      await notifyUser(s.uid, { type: 'message', actorUid: currentUser.uid, actorName: me?.name || 'Someone', text, postId: s._id }).catch(() => {});
      SoundManager.send();
      replyInput.value = '';
      if (confirm('Reply sent! Chat me dikhega — chat kholo?')) location.href = `private-chat.html?uid=${encodeURIComponent(s.uid)}`;
      else ov.remove();
    } catch (e) { alert(e.message || 'Reply failed'); }
    finally { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
  };
  sendBtn?.addEventListener('click', doReply);
  replyInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doReply(); });

  document.body.appendChild(ov);
}

async function renderFocusAndContinue(uid) {
  const focusPrimary = $('focusPrimary');
  const focusSecondary = $('focusSecondary');
  const continueList = $('continueList');
  const continueSection = $('continueSection');

  if (!focusPrimary || !focusSecondary) return;

  focusPrimary.innerHTML = '<div class="focus-skeleton" style="height:220px;border-radius:var(--radius-lg);"></div>';
  focusSecondary.innerHTML = '';

  try {
    const activeTasks = await listCommunityTasks({ status: 'active', max: 30 });
    const candidates = activeTasks
      .filter(t => !t.hidden)
      .map(t => ({ ...t, activityType: normalizeActivityType(t), source: 'community' }));

    // "Continue" is now based only on activities the user has actually joined
    // and has not completed. Generic daily/weekly goals are intentionally
    // kept out of this section because they are not activity progress.
    const resumeChecks = await Promise.all(candidates.slice(0, 20).map(async task => {
      const joined = await isMember(task.id, uid).catch(() => false);
      if (!joined) return null;
      const done = await getDoc(doc(db, 'communityTasks', task.id, 'completions', uid))
        .then(s => s.exists()).catch(() => false);
      return done ? null : task;
    }));
    const resumable = resumeChecks.filter(Boolean);

    const catalog = activeCatalogActivities()
      .filter(a => ['puzzle', 'build', 'learn', 'challenge', 'game'].includes(a.type))
      .map(a => ({ ...a, activityType: a.type, source: 'catalog' }));

    const selectedMode = getFocusMode(uid);
    const pool = [...candidates, ...catalog];
    const seen = new Set();
    const modeCycleType = ['puzzle', 'build', 'learn', 'challenge', 'game'][
      Math.floor((Date.now() / 86400000 + uid.length) % 5)
    ];
    const ranked = pool
      .filter(t => {
        if (!t?.id || seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      })
      .map(t => {
        const type = normalizeActivityType(t);
        const duration = Number(t.durationMin) || 20;
        let score = 0;
        if (selectedMode === 'quick') score += duration <= 20 ? 8 : duration <= 30 ? 3 : 0;
        if (selectedMode === 'think') score += type === 'puzzle' ? 8 : type === 'challenge' ? 4 : 1;
        if (selectedMode === 'make') score += type === 'build' ? 8 : 1;
        if (selectedMode === 'learn') score += type === 'learn' ? 8 : type === 'puzzle' ? 3 : 1;
        if (selectedMode === 'social') score += type === 'game' ? 8 : type === 'challenge' ? 5 : (t.source === 'community' ? 2 : 0);
        if (selectedMode === 'surprise') score += type === modeCycleType ? 5 : 0;
        if (t.featured) score += 2;
        if (t.source === 'community') score += 1;
        score += Math.max(0, 2 - Math.abs(20 - duration) / 20);
        return { task: t, score };
      })
      .sort((a, b) => b.score - a.score);
    const focus = resumable[0] || ranked[0]?.task || catalog[0];

    if (focus) {
      const type = normalizeActivityType(focus);
      const duration = Number(focus.durationMin) || 20;
      const difficulty = focus.difficulty || 'Open';
      const focusNote = resumable[0] && resumable[0].id === focus.id
        ? 'Picked up from where you left off.'
        : 'A clear activity you can finish in one focused session.';

      const focusHref = focus.source === 'community'
        ? 'task-detail.html?id=' + encodeURIComponent(focus.id)
        : 'activity.html?id=' + encodeURIComponent(focus.id);
      focusPrimary.innerHTML = `
        <div class="today-focus-frame">
          <div class="today-focus-context">
            <span><strong>${resumable[0] && resumable[0].id === focus.id ? 'RESUME' : 'PICKED FOR TODAY'}</strong></span>
            <span>${type} · ${duration} min · ${escapeHtml(difficulty)} · +${Number(focus.xpReward) || (difficulty === 'Hard' ? 60 : difficulty === 'Medium' ? 40 : 25)} XP</span>
          </div>
          <a class="today-focus-visual" href="${focusHref}" aria-label="Open ${escapeHtml(focus.title || 'today activity')}">
            <div class="today-focus-visual-grid"></div>
            <div class="today-focus-visual-core">${escapeHtml(focus.icon || '🎯')}</div>
            <div class="today-focus-visual-copy">
              <span>${resumable[0] && resumable[0].id === focus.id ? 'CONTINUE YOUR MOVE' : 'YOUR NEXT MOVE'}</span>
              <strong>${escapeHtml(focus.title || 'One meaningful move')}</strong>
              <small>${escapeHtml(type)} · ${duration} min · ${escapeHtml(focus.category || 'Trio Day')}</small>
            </div>
            <div class="today-focus-visual-signal"><i></i><i></i><i></i><i></i></div>
            <span class="today-focus-visual-cta">Open activity ↗</span>
          </a>
          <p class="today-focus-note">${escapeHtml(focusNote)}</p>
        </div>`;

      focusPrimary.classList.add('focus-activity-wrap');

      const visualTitle = $('todayVisualTitle');
      const visualMeta = $('todayVisualMeta');
      if (visualTitle) visualTitle.textContent = focus.title || 'One meaningful move';
      if (visualMeta) visualMeta.textContent = `${type} · ${duration} min · ${focus.source === 'community' ? 'Community' : 'Trio Day'}`;
    } else {
      focusPrimary.innerHTML = '<div class="focus-empty-card"><strong>Nothing is ready yet.</strong><p>Open Discover and choose a puzzle, build, lesson, challenge or game.</p><a class="nkm-btn nkm-btn--primary" href="all-users.html">Explore Discover</a></div>';
      focusPrimary.classList.remove('focus-activity-wrap');
      const visualTitle = $('todayVisualTitle');
      const visualMeta = $('todayVisualMeta');
      if (visualTitle) visualTitle.textContent = 'Choose your next move';
      if (visualMeta) visualMeta.textContent = 'Discover · Pick · Start';
    }

    focusSecondary.innerHTML = '';

    const continueItems = resumable
      .filter(t => !focus || t.id !== focus.id)
      .slice(0, 6);

    if (continueItems.length) {
      continueSection.hidden = false;
      continueList.innerHTML = continueItems.map(t => `
        <a class="continue-card continue-card--activity" href="${t.source === 'community' ? 'task-detail.html?id=' + encodeURIComponent(t.id) : 'activity.html?id=' + encodeURIComponent(t.id)}">
          <div class="continue-icon">${escapeHtml(t.icon || '🎯')}</div>
          <div class="continue-title">${escapeHtml(t.title || 'Activity')}</div>
          <div class="continue-meta">
            <span>${escapeHtml(normalizeActivityType(t))}</span>
            <span>${Number(t.durationMin) || 20} min</span>
            <span>Not finished</span>
          </div>
        </a>`).join('');
    } else {
      continueSection.hidden = true;
      continueList.innerHTML = '';
    }
  } catch (err) {
    console.error('renderFocusAndContinue failed', err);
    focusPrimary.innerHTML = '<div class="focus-empty-card"><strong>Focus is unavailable right now.</strong><p>Discover is still available while Today reconnects.</p><a class="nkm-btn nkm-btn--primary" href="all-users.html">Open Discover</a></div>';
    const visualTitle = $('todayVisualTitle');
    const visualMeta = $('todayVisualMeta');
    if (visualTitle) visualTitle.textContent = 'Open Discover';
    if (visualMeta) visualMeta.textContent = 'Today is ready when you are';
    continueSection.hidden = true;
  }
}

async function renderActiveChallenges(uid) {
  const listEl = $('challengesList');
  const emptyEl = $('challengesEmpty');
  const sectionEl = $('challengesSection');
  if (!listEl) return;

  listEl.innerHTML = '<div style="padding:16px; text-align:center; color:var(--color-ink-muted);">Loading challenges…</div>';

  try {
    const allChallenges = await listCommunityTasks({ status: 'active', max: 40 });
    if (!allChallenges.length) {
      listEl.innerHTML = '';
      sectionEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    // One collection-group query replaces one document read per challenge.
    const joinedTaskIds = await getMyJoinedTaskIds(uid, 100);
    const joinedChallenges = allChallenges.filter(c => joinedTaskIds.has(c.id));

    if (!joinedChallenges.length) {
      listEl.innerHTML = '';
      sectionEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    sectionEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;

    listEl.innerHTML = joinedChallenges.map(c => buildChallengeCard(c)).join('');
  } catch (err) {
    console.error('renderActiveChallenges failed', err);
    listEl.innerHTML = '<div style="padding:16px; text-align:center; color:var(--color-ink-muted);">Could not load challenges</div>';
    sectionEl.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
  }
}

function buildChallengeCard(c) {
  const progress = Math.min(100, Math.round(((c.completions || 0) / Math.max(1, c.target || 1)) * 100));
  const icon = escapeHtml(c.icon || '🎯');
  const xp = c.xpReward || 0;
  const members = c.joins || 0;
  return `
    <article class="challenge-card" data-task-id="${c.id}">
      <div class="challenge-icon">${icon}</div>
      <div class="challenge-content">
        <div class="challenge-title">${escapeHtml(c.title || 'Challenge')}</div>
        <div class="challenge-meta">
          ${xp ? `<span class="xp">+${xp} XP</span>` : ''}
          <span class="members">👥 ${members}</span>
        </div>
        <div class="challenge-progress"><div class="challenge-progress-bar" style="width:${progress}%"></div></div>
      </div>
      <a href="task-detail.html?id=${encodeURIComponent(c.id)}" class="challenge-cta nkm-btn nkm-btn--secondary">View</a>
    </article>
  `;
}

async function renderPeople(uid) {
  const listEl = $('peopleList');
  const sectionEl = $('peopleSection');
  if (!listEl) return;

  try {
    const cached = trioCache.get('lb_global') || trioCache.get('leaderboard_global');
    if (!cached || !cached.entries || !cached.entries.length) {
      sectionEl.hidden = true;
      return;
    }

    const me = await getCachedUser(uid);
    const followingIds = new Set(
      me?.following?.map(f => f.uid) || []
    );

    const others = cached.entries
      .filter(e => e.uid !== uid)
      .slice(0, 12);

    if (!others.length) {
      sectionEl.hidden = true;
      return;
    }

    sectionEl.hidden = false;
    listEl.innerHTML = others.map(u => `
      <article class="person-card" data-uid="${u.uid}">
        <div class="person-avatar">${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" alt="">` : (u.name || 'U').charAt(0).toUpperCase()}</div>
        <div class="person-name">${escapeHtml(u.name || 'User')}</div>
        <div class="person-id">${escapeHtml(u.userId || u.uid.slice(0, 8))}</div>
      </article>
    `).join('');

    listEl.querySelectorAll('.person-card').forEach(card => {
      card.addEventListener('click', () => {
        const targetUid = card.dataset.uid;
        if (targetUid) location.href = `profile.html?uid=${encodeURIComponent(targetUid)}`;
      });
    });
  } catch (err) {
    console.error('renderPeople failed', err);
    sectionEl.hidden = true;
  }
}

function startNotificationDot(uid) {
  if (!uid) return;
  try {
    const notifRef = collection(db, 'users', uid, 'notifications');
    const q = query(notifRef, where('read', '==', false), limit(1));
    onSnapshot(q, snap => {
      const dot = document.getElementById('headerNotifDot');
      if (dot) dot.hidden = snap.empty;
    }, () => {});
  } catch {}
}

function updateCommunityPulse() {
  // No-op: replaced by initTodayScreen sections
}

async function ensureUserProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref).catch(() => null);
  const baseName = user.displayName || user.email?.split('@')[0] || 'User';
  const existing = snap?.exists() ? snap.data() : {};
  const profileData = {
    uid:       user.uid,
    userId:    existing.userId   || makeUserId(user.uid),
    name:      existing.name     || baseName,
    email:     user.email        || existing.email    || null,
    photoURL:  existing.photoURL || user.photoURL     || null,
    bio:       existing.bio      || '',
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, profileData, { merge: true }).catch(err => console.error('Profile sync failed', err));
  trioCache.set(`user_${user.uid}`, { ...existing, ...profileData, updatedAt: Date.now() });
}

async function notifyPostOwner(post, type) {
  const me = await getMyProfile(currentUser.uid);
  return notifyUser(post.uid, {
    type,
    actorUid: currentUser?.uid,
    actorName: me?.name || currentUser?.displayName || 'Someone',
    postId: post._id
  });
}

const feed = $('feed'), feedLoading = $('feedLoading'), feedEmpty = $('feedEmpty'), feedError = $('feedError');
const storyOverlay = $('storyOverlay'), storyForm = $('storyForm'), storyMessage = $('storyMessage'),
  storyMedia = $('storyMedia'), storyPreview = $('storyPreview'), storyStatus = $('storyFormStatus'),
  storySubmit = $('storySubmitBtn');

let selectedFile = null;
let selectedPreviewUrl = null;
let cachedPosts = [];

function setStoryStatus(t = '', err = false) {
  if (storyStatus) {
    storyStatus.textContent = t;
    storyStatus.classList.toggle('error', err);
  }
}

function openStoryModal() {
  if (!storyOverlay) return;
  storyOverlay.hidden = false;
  storyOverlay.classList.remove('is-fullscreen');
  document.body.style.overflow = 'hidden';
  setTimeout(() => storyMessage?.focus(), 50);
}

function closeStoryModal() {
  if (!storyOverlay) return;
  storyOverlay.hidden = true;
  storyOverlay.classList.remove('is-fullscreen');
  document.body.style.overflow = '';
  storyForm?.reset();
  storyPreview.hidden = true;
  storyPreview.innerHTML = '';
  selectedFile = null;
  if (selectedPreviewUrl) {
    URL.revokeObjectURL(selectedPreviewUrl);
    selectedPreviewUrl = null;
  }
  editorState.textOverlays = [];
  editorState.stickers = [];
  editorState.filter = 'none';
  editorState.filterIntensity = 1;
  editorState.originalImage = null;
  const storyEditor = $('storyEditor');
  if (storyEditor) storyEditor.hidden = true;
  storyPrivacy = 'public';
  document.querySelectorAll('.story-privacy-btn').forEach(btn => {
    const active = btn.dataset.privacy === 'public';
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  setStoryStatus('');
}

$('storyModalClose')?.addEventListener('click', closeStoryModal);
$('storyCancelBtn')?.addEventListener('click', closeStoryModal);
storyOverlay?.addEventListener('click', e => { if (e.target === storyOverlay) closeStoryModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !storyOverlay.hidden) closeStoryModal(); });

// Legacy create triggers now open Story directly. No post composer remains.
document.querySelectorAll('[data-open-story], #storyPostBtn, #headerPlus, #heroStoryBtn, #fabStoryBtn')
  .forEach(b => b?.addEventListener('click', () => {
    SoundManager.click();
    openStoryModal();
  }));

document.querySelectorAll('.story-privacy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.story-privacy-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.story-privacy-btn').forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
    storyPrivacy = btn.dataset.privacy;
  });
});

storyMedia?.addEventListener('change', () => {
  const f = storyMedia.files?.[0];
  if (selectedPreviewUrl) { URL.revokeObjectURL(selectedPreviewUrl); selectedPreviewUrl = null; }
  storyPreview.innerHTML = '';
  if (!f) { selectedFile = null; storyPreview.hidden = true; storyOverlay?.classList.remove('is-fullscreen'); const ed=$('storyEditor'); if(ed) ed.hidden=true; return; }
  if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) { setStoryStatus('Please select an image or video.', true); storyMedia.value = ''; return; }
  if (f.type.startsWith('image/') && f.size > 12 * 1024 * 1024) { setStoryStatus('Story photo must be under 12MB.', true); storyMedia.value = ''; return; }
  if (f.type.startsWith('video/') && f.size > 100 * 1024 * 1024) { setStoryStatus('Story video must be under 100MB.', true); storyMedia.value = ''; return; }
  selectedFile = f;
  let mediaEl;
  if (f.type.startsWith('video/')) {
    selectedPreviewUrl = URL.createObjectURL(f);
    const video = document.createElement('video'); video.src = selectedPreviewUrl; video.controls = true; video.alt = 'Preview'; video.playsInline=true; video.width = 800; video.height = 600; video.style.aspectRatio = '4 / 3';
    storyPreview.appendChild(video); mediaEl=video;
    const ed=$('storyEditor'); if(ed) ed.hidden=true;
    storyOverlay?.classList.add('is-fullscreen');
    setStoryStatus('');
  } else {
    selectedPreviewUrl = URL.createObjectURL(f);
    const img = document.createElement('img'); img.src = selectedPreviewUrl; img.alt = 'Preview'; img.width = 800; img.height = 600; img.decoding = 'async'; img.style.aspectRatio = '4 / 3';
    storyPreview.appendChild(img); mediaEl=img;
    setStoryStatus('');
  }
  const rm = document.createElement('button'); rm.type='button'; rm.className='preview-remove'; rm.textContent='×'; rm.title='Remove';
  rm.addEventListener('click', ()=>{ storyPreview.innerHTML=''; storyPreview.hidden=true; selectedFile=null; storyMedia.value=''; if (selectedPreviewUrl) { URL.revokeObjectURL(selectedPreviewUrl); selectedPreviewUrl=null; } const ed=$('storyEditor'); if(ed) ed.hidden=true; editorState.originalImage=null; editorState.textOverlays=[]; editorState.stickers=[]; storyOverlay?.classList.remove('is-fullscreen'); setStoryStatus(''); });
  storyPreview.appendChild(rm);
  storyPreview.hidden = false;
});

// ── Story Editor ──────────────────────────────────────────────
const editorState = {
  activeTool: 'filters',
  filter: 'none',
  filterIntensity: 1,
  textOverlays: [],
  stickers: [],
  originalImage: null,
  isDraggingText: null,
  isDraggingSticker: null,
  dragOffset: { x: 0, y: 0 }
};

document.querySelectorAll('.editor-tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.editor-tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    editorState.activeTool = btn.dataset.tool;
    document.querySelectorAll('.editor-panel').forEach(p => p.hidden = true);
    const panelMap = { filters: 'filtersPanel', text: 'textPanel', stickers: 'stickersPanel' };
    const panel = $(panelMap[btn.dataset.tool]);
    if (panel) panel.hidden = false;
  });
});

document.querySelectorAll('#filtersPanel .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#filtersPanel .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    editorState.filter = btn.dataset.filter;
    renderStoryEditor();
  });
});

const filterIntensity = $('filterIntensity');
const filterIntensityValue = $('filterIntensityValue');
filterIntensity?.addEventListener('input', () => {
  editorState.filterIntensity = parseInt(filterIntensity.value) / 100;
  if (filterIntensityValue) filterIntensityValue.textContent = filterIntensity.value + '%';
  renderStoryEditor();
});

const textColorWheel = $('textColorWheel');
document.querySelectorAll('.text-color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.text-color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(textColorWheel) textColorWheel.value = btn.dataset.color;
  });
});
textColorWheel?.addEventListener('input', () => {
  document.querySelectorAll('.text-color-btn').forEach(b => b.classList.remove('active'));
});
textColorWheel?.addEventListener('change', () => {
  document.querySelectorAll('.text-color-btn').forEach(b => b.classList.remove('active'));
});

const textSize = $('textSize'), textSizeValue = $('textSizeValue');
textSize?.addEventListener('input', () => { if (textSizeValue) textSizeValue.textContent = textSize.value + 'px'; });

$('addTextBtn')?.addEventListener('click', () => {
  const textInput = $('textInput');
  if (!textInput || !textInput.value.trim()) return;
  const canvas = $('storyEditorCanvas');
  if (!canvas) return;
  const wheelActive = textColorWheel && !document.querySelector('.text-color-btn.active');
  const color = wheelActive ? textColorWheel.value : (document.querySelector('.text-color-btn.active')?.dataset.color || textColorWheel?.value || '#ffffff');
  const font = textSize?.value || '24';
  const fontFamily = document.querySelector('#textFont')?.value || 'Inter';
  const w = canvas.width, h = canvas.height;
  const x = w / 2, y = h / 2;
  editorState.textOverlays.push({ text: textInput.value.trim(), x, y, color, font: `${font}px ${fontFamily}`, fontSize: parseInt(font), originX: 'center', originY: 'center' });
  textInput.value = '';
  renderStoryEditor();
});

document.querySelectorAll('.sticker-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const canvas = $('storyEditorCanvas');
    if (!canvas) return;
    const w = canvas.width, h = canvas.height;
    editorState.stickers.push({ emoji: btn.dataset.sticker, x: w / 2, y: h / 2, size: 48, originX: 'center', originY: 'center' });
    renderStoryEditor();
  });
});

const editorCanvas = $('storyEditorCanvas');
editorCanvas?.addEventListener('mousedown', editorDragStart);
editorCanvas?.addEventListener('mousemove', editorDrag);
editorCanvas?.addEventListener('mouseup', editorDragEnd);
editorCanvas?.addEventListener('touchstart', e => { editorDragStart(e.touches[0]); }, { passive: true });
editorCanvas?.addEventListener('touchmove', e => { editorDrag(e.touches[0]); }, { passive: true });
editorCanvas?.addEventListener('touchend', editorDragEnd);

function editorDragStart(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (editorCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (editorCanvas.height / rect.height);
  for (let i = editorState.textOverlays.length - 1; i >= 0; i--) {
    const t = editorState.textOverlays[i];
    const tw = editorCanvas.getContext('2d').measureText(t.text).width;
    if (x > t.x - tw / 2 - 5 && x < t.x + tw / 2 + 5 && y > t.y - t.fontSize - 5 && y < t.y + 5) {
      editorState.isDraggingText = i;
      editorState.dragOffset = { x: x - t.x, y: y - t.y };
      editorCanvas.style.cursor = 'grabbing';
      return;
    }
  }
  for (let i = editorState.stickers.length - 1; i >= 0; i--) {
    const s = editorState.stickers[i];
    if (x > s.x - s.size && x < s.x + s.size && y > s.y - s.size && y < s.y + s.size) {
      editorState.isDraggingSticker = i;
      editorState.dragOffset = { x: x - s.x, y: y - s.y };
      editorCanvas.style.cursor = 'grabbing';
      return;
    }
  }
}

let editorRenderFrame = null;
function scheduleEditorRender() {
  if (editorRenderFrame === null) {
    editorRenderFrame = requestAnimationFrame(() => {
      editorRenderFrame = null;
      renderStoryEditor();
    });
  }
}

function editorDrag(e) {
  if (editorState.isDraggingText !== null) {
    const rect = editorCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (editorCanvas.width / rect.width);
    const y = (e.clientY - rect.top) * (editorCanvas.height / rect.height);
    editorState.textOverlays[editorState.isDraggingText].x = x - editorState.dragOffset.x;
    editorState.textOverlays[editorState.isDraggingText].y = y - editorState.dragOffset.y;
    scheduleEditorRender();
  } else if (editorState.isDraggingSticker !== null) {
    const rect = editorCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (editorCanvas.width / rect.width);
    const y = (e.clientY - rect.top) * (editorCanvas.height / rect.height);
    editorState.stickers[editorState.isDraggingSticker].x = x - editorState.dragOffset.x;
    editorState.stickers[editorState.isDraggingSticker].y = y - editorState.dragOffset.y;
    scheduleEditorRender();
  }
}

function editorDragEnd() {
  editorState.isDraggingText = null;
  editorState.isDraggingSticker = null;
  if (editorCanvas) editorCanvas.style.cursor = 'default';
}

function applyFilterToFile(file, filter, intensity) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.filter = getFilterCSS(filter, intensity);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          if (!blob) return resolve(null);
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.92);
      } catch { URL.revokeObjectURL(url); resolve(null); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function renderStoryEditor() {
  const canvas = $('storyEditorCanvas');
  if (!canvas || !editorState.originalImage) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.filter = getFilterCSS(editorState.filter, editorState.filterIntensity);
  ctx.drawImage(editorState.originalImage, 0, 0, w, h);
  ctx.filter = 'none';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  editorState.textOverlays.forEach(t => {
    ctx.fillStyle = t.color;
    ctx.font = t.font;
    ctx.fillText(t.text, t.x, t.y);
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  editorState.stickers.forEach(s => {
    ctx.font = `${s.size}px serif`;
    ctx.fillText(s.emoji, s.x, s.y);
  });
}

function loadEditorFromPreview() {
  const preview = $('storyPreview');
  if (!preview || !preview.querySelector('img')) return;
  const img = new Image();
  img.onload = () => {
    editorState.originalImage = img;
    const canvas = $('storyEditorCanvas');
    if (!canvas) return;
    const defaultW = 360, defaultH = 640;
    const scale = Math.min(defaultW / img.width, defaultH / img.height, 1);
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    canvas.width = w;
    canvas.height = h;
    editorState.textOverlays = [];
    editorState.stickers = [];
    editorState.filter = 'none';
    editorState.filterIntensity = 1;
    if (filterIntensity) { filterIntensity.value = 100; if (filterIntensityValue) filterIntensityValue.textContent = '100%'; }
    document.querySelectorAll('#filtersPanel .filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'none'));
    renderStoryEditor();
    const editor = $('storyEditor');
    if (editor) editor.hidden = false;
    preview.hidden = true;
    if(editor && !editor.querySelector('.preview-remove')){
      const rm2 = document.createElement('button'); rm2.type='button'; rm2.className='preview-remove'; rm2.textContent='×'; rm2.title='Remove photo';
      rm2.style.top='10px'; rm2.style.right='10px';
      rm2.addEventListener('click', ()=>{ editor.hidden=true; editorState.originalImage=null; editorState.textOverlays=[]; editorState.stickers=[]; selectedFile=null; const sm=$('storyMedia'); if(sm) sm.value=''; preview.innerHTML=''; preview.hidden=true; $('storyOverlay')?.classList.remove('is-fullscreen'); setStoryStatus(''); });
      const wrap = editor.querySelector('.editor-canvas-wrapper');
      if(wrap) wrap.style.position='relative', wrap.appendChild(rm2);
    }
    $('storyOverlay')?.classList.add('is-fullscreen');
    const modal = $('storyEditorCanvas')?.closest('.modal');
    if(modal) modal.scrollTop = 0;
  };
  img.src = preview.querySelector('img').src;
}

const storyPreviewObserver = new MutationObserver(loadEditorFromPreview);
const sp = $('storyPreview');
if (sp) storyPreviewObserver.observe(sp, { childList: true });
setTimeout(loadEditorFromPreview, 100);

storyForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentUser) { setStoryStatus('Please login first.', true); return; }
    const text = storyMessage.value.trim();
    if (!text && !selectedFile) return setStoryStatus('Write something or add a photo/video.', true);
    storySubmit.disabled = true; storySubmit.textContent = 'Sharing…';
    try {
      const me = await getMyProfile(currentUser.uid);
      let mediaUrl = null;
      const hasEditorEffects = editorState.filter !== 'none' || editorState.textOverlays.length > 0 || editorState.stickers.length > 0;
      if (selectedFile) {
        setStoryStatus('Processing…');
        const firebaseToken = await currentUser.getIdToken();
        if (hasEditorEffects && editorState.originalImage && selectedFile.type.startsWith('image/')) {
          const c = $('storyEditorCanvas');
          if (c) {
            const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
            setStoryStatus('Uploading…');
            if (blob) {
              mediaUrl = await uploadStoryMedia(
                currentUser.uid,
                new File([blob], `story-${Date.now()}.jpg`, { type: 'image/jpeg' }),
                firebaseToken
              );
            } else {
              mediaUrl = await uploadStoryMedia(currentUser.uid, selectedFile, firebaseToken);
            }
          }
        } else {
          setStoryStatus('Uploading…');
          mediaUrl = await uploadStoryMedia(currentUser.uid, selectedFile, firebaseToken);
        }
      }
      const expiresAt = serverTimestamp();
      const expiresAtMs = Date.now() + 24 * 60 * 60 * 1000;
      let allowedUids = [currentUser.uid];
      if (storyPrivacy === 'friends') {
        const [followingSnap, followersSnap] = await Promise.all([
          getDocs(query(collection(db, 'users', currentUser.uid, 'following'), limit(500))),
          getDocs(query(collection(db, 'users', currentUser.uid, 'followers'), limit(500)))
        ]);
        const following = new Set(followingSnap.docs.map(d => d.id));
        const mutual = followersSnap.docs.map(d => d.id).filter(uid => following.has(uid) && uid !== currentUser.uid);
        allowedUids = [currentUser.uid, ...mutual].slice(0, 500);
      }
      await addDoc(collection(db, 'posts'), {
        name: me?.name || currentUser.displayName || 'User',
        userId: me?.userId || makeUserId(currentUser.uid),
        uid: currentUser.uid,
        photoURL: me?.photoURL || currentUser.photoURL || null,
        message: text || '📸', mediaUrl, type: 'story',
        createdAt: serverTimestamp(), createdAtMs: Date.now(),
        expiresAt, expiresAtMs,
        isStory: true,
        privacy: storyPrivacy,
        allowedUids,
        editorMeta: {
          filter: editorState.filter,
          filterIntensity: editorState.filterIntensity,
          textOverlays: editorState.textOverlays,
          stickers: editorState.stickers.map(s => ({ emoji: s.emoji, x: s.x, y: s.y, size: s.size }))
        }
      });
      trioCache.invalidate(`posts_${currentUser.uid}`);
      onPostCreated(currentUser.uid);
      setStoryStatus('Story posted ✅');
      setTimeout(closeStoryModal, 300);
    } catch (err) { console.error(err); setStoryStatus(err.message || 'Could not save story.', true); }
    finally { storySubmit.disabled = false; storySubmit.textContent = 'Share Story'; }
  });

function buildFeedItem(data) {
  const postId = data._id;
  const item = document.createElement('article'); item.className = 'feed-item nkm-post'; item.dataset.postId = postId;
  const head = document.createElement('div'); head.className = 'feed-post-head nkm-post-head';
  const av = document.createElement('div'); av.className = 'feed-avatar nkm-post-avatar';
  if (data.photoURL) { const img = document.createElement('img'); img.src = data.photoURL; img.alt = ''; img.width = 36; img.height = 36; img.decoding = 'async'; img.loading = 'lazy'; av.appendChild(img); } else av.textContent = initials(data.name);
  const identity = document.createElement('div'); identity.className = 'feed-identity nkm-post-meta';
  const name = document.createElement('div'); name.className = 'pname nkm-post-name'; name.textContent = data.name || 'User'; name.title = 'Open profile';
  name.addEventListener('click', () => data.uid && (location.href = `profile.html?uid=${encodeURIComponent(data.uid)}`));
  const uid = document.createElement('div'); uid.className = 'puid nkm-post-id'; uid.textContent = data.userId || '';
  const time = document.createElement('div'); time.className = 'ptime nkm-post-time'; time.textContent = formatTime(data);
  identity.append(name, uid, time); head.append(av, identity);

  if (data.uid) {
    getCachedUserProfile(data.uid).then(latest => {
      if (!latest) return;
      if (latest.name) { name.textContent = latest.name; if (!data.photoURL) av.textContent = initials(latest.name); }
      if (latest.userId) uid.textContent = latest.userId;
      if (latest.photoURL) {
        let img = av.querySelector('img');
        if (!img) { av.textContent = ''; img = document.createElement('img'); img.alt = ''; img.width = 44; img.height = 44; img.decoding = 'async'; img.loading = 'lazy'; av.appendChild(img); }
        img.src = latest.photoURL;
      }
    }).catch(() => { });
  }

  const mediaWrap = document.createElement('div'); mediaWrap.className = 'feed-media nkm-post-media';
  if (data.mediaUrl) {
    const img = document.createElement('img'); img.className = 'media'; img.loading = 'lazy'; img.decoding = 'async'; img.src = data.mediaUrl; img.alt = `Photo from ${data.name || 'User'}`; img.width = 800; img.height = 450;
    img.style.aspectRatio = '16 / 9';
    mediaWrap.appendChild(img);
  } else {
    mediaWrap.classList.add('text-only-media');
    const quote = document.createElement('div'); quote.className = 'text-only-copy'; quote.textContent = data.message || '🇮🇳';
    mediaWrap.appendChild(quote);
  }

  const content = document.createElement('div'); content.className = 'feed-content-panel nkm-post-content'; content.appendChild(head);
  if (data.message) { const cap = document.createElement('p'); cap.className = 'feed-caption nkm-post-caption'; cap.textContent = data.message; content.appendChild(cap); }

  const commentsPreview = document.createElement('div'); commentsPreview.className = 'comments-preview';
  content.appendChild(commentsPreview);
  function renderCommentsPreview(arr) {
    commentsPreview.innerHTML = '';
    if (!arr.length) return;
    const c = arr[0]; if (!c) return;
    const p = document.createElement('div'); p.className = 'comment-preview-item';
    p.innerHTML = `<strong>${escapeHtml(c.name || 'User')}</strong> <span class="preview-txt">${escapeHtml(c.txt || '')}</span>`;
    commentsPreview.appendChild(p);
    commentsPreview.style.cursor = 'pointer';
    commentsPreview.onclick = (e) => { e.stopPropagation(); window.CommentWidget?.openFor(postId, data.name || 'Comments', data.uid); };
  }
  try {
    onSnapshot(query(collection(db, 'posts', postId, 'comments'), orderBy('createdAtMs', 'desc'), limit(1)),
      snap => { const arr = []; snap.forEach(d => arr.push(d.data())); renderCommentsPreview(arr); },
      () => { commentsPreview.innerHTML = ''; });
  } catch (e) { }

  const actions = document.createElement('div'); actions.className = 'post-actions nkm-post-actions';
  const reacts = ['❤️', '😂', '😍', '🔥', '💯', '🎉'];
  const reactWrap = document.createElement('div'); reactWrap.className = 'react-wrap'; reactWrap.style.position='relative';
  const reactBtn = document.createElement('button'); reactBtn.className='action-btn react-btn'; reactBtn.type='button';
  reactBtn.innerHTML='<span class="react-sample" aria-hidden="true"></span><span class="react-btn-text">React</span>';
  reactBtn.setAttribute('aria-haspopup','true'); reactBtn.setAttribute('aria-expanded','false');
  const reactionPicker = document.createElement('div'); reactionPicker.className='reaction-picker'; reactionPicker.hidden=true; reactionPicker.setAttribute('role','menu');
  reactionPicker.innerHTML = reacts.map(m => `<button class="action-btn mood-btn" type="button" role="menuitem" title="${m}" data-mood="${m}">${m} <span class="mood-count"></span></button>`).join('');
  reactWrap.append(reactBtn, reactionPicker);
  actions.append(reactWrap);

  onSnapshot(collection(db, 'posts', postId, 'moods'), moodSnap => {
    const moodCounts = {};
    let myMood = null; let total=0;
    moodSnap.forEach(d => {
      const m = d.data()?.mood;
      if (m) { moodCounts[m] = (moodCounts[m] || 0) + 1; total++; }
      if (d.id === currentUser?.uid) myMood = m;
    });
    reactionPicker.querySelectorAll('.mood-btn').forEach(btn => {
      const mood = btn.dataset.mood;
      const c = moodCounts[mood] || 0;
      const span = btn.querySelector('.mood-count');
      if (span) span.textContent = c > 0 ? String(c) : '';
      btn.classList.toggle('liked', myMood === mood);
    });
    const sample = reactBtn.querySelector('.react-sample');
    const rText = reactBtn.querySelector('.react-btn-text');
    if(sample){
      if(total>0){
        const sorted = Object.entries(moodCounts).sort((a,b)=> b[1]-a[1]).slice(0,3);
        sample.innerHTML = sorted.map(([emoji])=>`<span class="react-sample-emoji">${emoji}</span>`).join('') + `<span style="margin-left:4px;font-size:12px;color:var(--ink-muted)">${total}</span>`;
      } else sample.innerHTML='';
    }
    if(rText) rText.textContent = myMood ? `${myMood} React` : 'React';
    reactBtn.classList.toggle('liked', !!myMood);
    reactBtn.setAttribute('aria-expanded', String(!reactionPicker.hidden));
  }, () => { });

  reactBtn.addEventListener('click', e=>{
    e.stopPropagation(); SoundManager.moodSelect();
    document.querySelectorAll('.reaction-picker').forEach(p=>{ if(p!==reactionPicker) p.hidden=true; });
    document.querySelectorAll('.share-menu.open').forEach(m=>m.classList.remove('open'));
    const isHidden = reactionPicker.hidden;
    reactionPicker.hidden = !isHidden;
    reactBtn.setAttribute('aria-expanded', String(!reactionPicker.hidden));
  });

  reactionPicker.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      SoundManager.moodSelect();
      if (!currentUser) return alert('Login karke react karo.');
      const mood = btn.dataset.mood;
      const moodRef = doc(db, 'posts', postId, 'moods', currentUser.uid);
      try {
        const s = await getDoc(moodRef);
        if (s.exists() && s.data()?.mood === mood) {
          await deleteDoc(moodRef);
        } else {
          await setDoc(moodRef, { uid: currentUser.uid, mood, createdAt: serverTimestamp() });
          if (!s.exists()) {
            await notifyPostOwner(data, 'like').catch(() => {});
            onLikeGiven(currentUser.uid);
            if (data.uid && data.uid !== currentUser.uid) onLikeReceived(data.uid);
          }
        }
        reactionPicker.hidden=true;
      } catch (err) { console.error(err); alert(err.message || 'React failed.'); }
    });
  });

  const comment = document.createElement('button'); comment.className = 'action-btn comment-toggle-btn'; comment.type = 'button'; comment.innerHTML = '💬 <span>Comment</span>';
  comment.addEventListener('click', e => { e.stopPropagation(); window.CommentWidget?.openFor(postId, data.name || 'Comments', data.uid); });

  const share = document.createElement('button'); share.className = 'action-btn'; share.type = 'button'; share.innerHTML = '↗ <span>Share</span>';
  const menu = document.createElement('div'); menu.className = 'share-menu';
  const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy link';
  const native = document.createElement('button'); native.type = 'button'; native.textContent = 'Share…';
  const connectedTitle = document.createElement('div'); connectedTitle.className = 'share-title'; connectedTitle.textContent = 'Connected users';
  const connectedBox = document.createElement('div'); connectedBox.className = 'connected-share-list';
  menu.append(copy, native, connectedTitle, connectedBox);
  const postUrl = new URL(`view_post.html?postId=${encodeURIComponent(postId)}`, location.href).href;

  async function loadConnected() {
    connectedBox.innerHTML = '<div class="share-loading">Loading connections…</div>';
    if (!currentUser) { connectedBox.innerHTML = '<div class="share-loading">Login to share with connections.</div>'; return; }
    try {
      const cacheKey = `connections_${currentUser.uid}`;
      let followingIds = trioCache.get(cacheKey);
      if (!followingIds) {
        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'following'));
        followingIds = snap.docs.map(d => d.id);
        trioCache.set(cacheKey, followingIds, trioCache.TTL.SHORT);
      }
      if (!followingIds.length) { connectedBox.innerHTML = '<div class="share-loading">No connected users yet.</div>'; return; }
      const users = (await Promise.all(followingIds.map(id => getCachedUserProfile(id)))).filter(Boolean);
      connectedBox.innerHTML = '';
      users.forEach(u => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'connected-share-user';
        b.innerHTML = `<span class="user-avatar">${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" alt="">` : (u.name || 'U').charAt(0).toUpperCase()}</span><span><strong>${escapeHtml(u.name || 'User')}</strong><small>${escapeHtml(u.userId || u.uid)}</small></span><b>Send</b>`;
        b.onclick = async () => {
          b.disabled = true; b.lastElementChild.textContent = '…';
          try {
            const me = await getMyProfile(currentUser.uid);
            const cid = [currentUser.uid, u.uid].sort().join('_');
            await addDoc(collection(db, 'privateChats', cid, 'messages'), { uid: currentUser.uid, name: me?.name || currentUser.displayName || 'User', userId: me?.userId || makeUserId(currentUser.uid), text: `📎 Shared a post: ${postUrl}`, createdAt: Date.now(), createdAtMs: Date.now(), sharedPostId: postId });
            await Promise.all([notifyPostOwner(data, 'share'), notifyUser(u.uid, { type: 'share', actorUid: currentUser.uid, actorName: me?.name || currentUser.displayName || 'Someone', postId })]);
            b.lastElementChild.textContent = 'Sent ✓';
          } catch (err) { console.error(err); b.lastElementChild.textContent = 'Retry'; alert(err.message || 'Share failed.'); }
          finally { b.disabled = false; }
        };
        connectedBox.appendChild(b);
      });
    } catch (err) { console.error(err); connectedBox.innerHTML = '<div class="share-loading">Could not load connections.</div>'; }
  }

  copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(postUrl); await notifyPostOwner(data, 'share').catch(() => { }); alert('Post link copied ✅'); } catch { prompt('Copy link', postUrl); } menu.classList.remove('open'); });
  native.addEventListener('click', async () => { if (navigator.share) { try { await navigator.share({ title: `${data.name || 'Trio Day'} on Trio Day`, url: postUrl }); await notifyPostOwner(data, 'share').catch(() => { }); } catch { } } else { try { await navigator.clipboard.writeText(postUrl); await notifyPostOwner(data, 'share').catch(() => { }); alert('Link copied ✅'); } catch { prompt('Copy link', postUrl); } } menu.classList.remove('open'); });
  share.addEventListener('click', e => { e.stopPropagation(); document.querySelectorAll('.share-menu.open').forEach(m => m !== menu && m.classList.remove('open')); menu.classList.toggle('open'); if (menu.classList.contains('open')) loadConnected(); });

  if (data.uid && currentUser?.uid && data.uid === currentUser.uid) {
    const remove = document.createElement('button'); remove.className = 'action-btn danger-action'; remove.type = 'button'; remove.textContent = 'Delete';
    remove.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Is this post delete karna chahte ho?')) return;
      SoundManager.delete();
      try {
        await deleteDoc(doc(db, 'posts', postId));
        trioCache.invalidate(`posts_${currentUser.uid}`);
      } catch (err) {
        console.error(err);
        const msg = String(err?.code || err?.message || '');
        alert(/permission|insufficient/i.test(msg) ? 'Delete blocked: Firebase rules update karo.' : (err.message || 'Delete failed.'));
      }
    });
    actions.append(remove);
  }

  actions.append(comment, share, menu);
  item.append(mediaWrap, content, actions);
  return item;
}
window.buildFeedItem = buildFeedItem;
if(!window.__reactionGlobalClose){
  window.__reactionGlobalClose = true;
  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.react-wrap')) document.querySelectorAll('.reaction-picker').forEach(p=> p.hidden=true);
    document.querySelectorAll('.react-btn').forEach(b=> b.setAttribute('aria-expanded','false'));
  });
}

function buildStoryCard(data) {
  const postId = data._id;
  const item = document.createElement('article'); item.className = 'feed-item story-item';
  const head = document.createElement('div'); head.className = 'feed-post-head';
  const av = document.createElement('div'); av.className = 'feed-avatar';
  if (data.photoURL) { const img = document.createElement('img'); img.src = data.photoURL; img.alt = ''; img.width = 44; img.height = 44; img.decoding = 'async'; img.loading = 'lazy'; av.appendChild(img); } else av.textContent = initials(data.name);
  const identity = document.createElement('div'); identity.className = 'feed-identity';
  const name = document.createElement('div'); name.className = 'pname'; name.textContent = data.name || 'User'; name.title = 'Open profile';
  const uid = document.createElement('div'); uid.className = 'puid'; uid.textContent = data.userId || '';
  const time = document.createElement('div'); time.className = 'ptime'; time.textContent = formatTime(data);
  identity.append(name, uid, time); head.append(av, identity);

  const mediaWrap = document.createElement('div'); mediaWrap.className = 'feed-media';
  if (data.type === 'voice' || data.isVoice) {
    const voicePlayer = document.createElement('div'); voicePlayer.className = 'voice-post-player';
    const playBtn = document.createElement('button'); playBtn.className = 'voice-play-btn'; playBtn.type = 'button'; playBtn.setAttribute('aria-label', 'Play voice status'); playBtn.textContent = '▶';
    const audio = document.createElement('audio'); audio.src = data.mediaUrl || ''; audio.preload = 'none';
    const info = document.createElement('div'); info.className = 'voice-post-info';
    const dur = document.createElement('span'); dur.className = 'voice-duration'; dur.textContent = `🎙️ ${Number(data.duration) || 0}s voice status`;
    info.appendChild(dur);
    voicePlayer.append(playBtn, audio, info);
    playBtn.addEventListener('click', () => {
      if (audio.paused) { audio.play().then(()=>{ playBtn.textContent='⏸'; }).catch(()=>{}); }
      else { audio.pause(); playBtn.textContent='▶'; }
    });
    audio.addEventListener('ended', () => { playBtn.textContent='▶'; });
    audio.addEventListener('pause', () => { playBtn.textContent='▶'; });
    audio.addEventListener('play', () => { playBtn.textContent='⏸'; });
    mediaWrap.appendChild(voicePlayer);
  } else if (data.mediaUrl) {
    const img = document.createElement('img'); img.className = 'media'; img.loading = 'lazy'; img.decoding = 'async'; img.src = data.mediaUrl; img.alt = `Story from ${data.name || 'User'}`; img.width = 800; img.height = 600; img.style.aspectRatio = '4 / 3';
    mediaWrap.appendChild(img);
  } else {
    mediaWrap.classList.add('text-only-media');
    const quote = document.createElement('div'); quote.className = 'text-only-copy'; quote.textContent = data.message || '📸';
    mediaWrap.appendChild(quote);
  }

  const content = document.createElement('div'); content.className = 'feed-content-panel'; content.appendChild(head);
  if (data.message) { const cap = document.createElement('p'); cap.className = 'feed-caption'; cap.textContent = data.message; content.appendChild(cap); }

  const privacyBadge = document.createElement('span');
  privacyBadge.className = `action-btn story-badge ${data.privacy === 'public' ? 'public' : 'friends'}`;
  privacyBadge.textContent = data.privacy === 'public' ? 'Public' : 'Friends';
  content.appendChild(privacyBadge);

  if (data.editorMeta?.filter && data.editorMeta.filter !== 'none') {
    const filterTag = document.createElement('span');
    filterTag.className = 'story-editor-tag';
    filterTag.textContent = `✨ ${data.editorMeta.filter}`;
    content.appendChild(filterTag);
  }

  // —— Story actions: React + Reply (shows in chat) + professional button layout ——
  const actions = document.createElement('div'); actions.className = 'post-actions story-actions';
  const reacts = ['❤️','😂','😍','🔥','💯','🎉'];
  const reactWrap = document.createElement('div'); reactWrap.className = 'react-wrap story-react-wrap';
  const reactBtn = document.createElement('button'); reactBtn.className='action-btn react-btn'; reactBtn.type='button';
  reactBtn.innerHTML='<span class="react-sample" aria-hidden="true"></span><span class="react-btn-text">React</span>';
  reactBtn.setAttribute('aria-haspopup','true'); reactBtn.setAttribute('aria-expanded','false');
  const reactionPicker = document.createElement('div'); reactionPicker.className='reaction-picker'; reactionPicker.hidden=true; reactionPicker.setAttribute('role','menu');
  reactionPicker.innerHTML = reacts.map(m => `<button class="action-btn mood-btn" type="button" role="menuitem" title="${m}" data-mood="${m}">${m} <span class="mood-count"></span></button>`).join('');
  reactWrap.append(reactBtn, reactionPicker);

  const replyBtn = document.createElement('button'); replyBtn.className='action-btn story-reply-btn'; replyBtn.type='button'; replyBtn.innerHTML='💬 <span>Reply</span>'; replyBtn.title='Reply in chat';

  const shareBtn = document.createElement('button'); shareBtn.className='action-btn story-share-btn'; shareBtn.type='button'; shareBtn.innerHTML='↗ <span>Share</span>';
  const views = document.createElement('div'); views.className = 'like-count story-views'; views.textContent = 'Viewers';
  views.style.marginLeft='auto';
  actions.append(reactWrap, replyBtn, shareBtn, views);

  // Reply composer (inline, shows directly in chat after send)
  const replyComposer = document.createElement('div'); replyComposer.className='story-reply-composer'; replyComposer.hidden=true;
  replyComposer.innerHTML = `<input type="text" maxlength="200" placeholder="Reply to ${escapeHtml(data.name||'story')}…" aria-label="Reply text"><button type="button" class="btn primary sm">Send</button><button type="button" class="btn ghost sm cancel-reply">Cancel</button>`;

  // —— Reaction logic (same as posts, per-story moods) ——
  onSnapshot(collection(db, 'posts', postId, 'moods'), moodSnap => {
    const moodCounts = {}; let myMood=null, total=0;
    moodSnap.forEach(d=>{ const m=d.data()?.mood; if(m){ moodCounts[m]=(moodCounts[m]||0)+1; total++; } if(d.id===currentUser?.uid) myMood=m; });
    reactionPicker.querySelectorAll('.mood-btn').forEach(btn=>{
      const mood=btn.dataset.mood, c=moodCounts[mood]||0;
      const span=btn.querySelector('.mood-count'); if(span) span.textContent=c>0?String(c):'';
      btn.classList.toggle('liked', myMood===mood);
    });
    const sample=reactBtn.querySelector('.react-sample'); const rText=reactBtn.querySelector('.react-btn-text');
    if(sample){
      if(total>0){ const sorted=Object.entries(moodCounts).sort((a,b)=>b[1]-a[1]).slice(0,3); sample.innerHTML=sorted.map(([e])=>`<span class="react-sample-emoji">${e}</span>`).join('')+`<span style="margin-left:4px;font-size:12px;color:var(--ink-muted)">${total}</span>`; } else sample.innerHTML='';
    }
    if(rText) rText.textContent=myMood?`${myMood} React`:'React';
    reactBtn.classList.toggle('liked', !!myMood);
    reactBtn.setAttribute('aria-expanded', String(!reactionPicker.hidden));
  }, ()=>{});

  reactBtn.addEventListener('click', e=>{
    e.stopPropagation(); SoundManager.moodSelect();
    document.querySelectorAll('.reaction-picker').forEach(p=>{ if(p!==reactionPicker) p.hidden=true; });
    document.querySelectorAll('.share-menu.open').forEach(m=>m.classList.remove('open'));
    const isHidden=reactionPicker.hidden; reactionPicker.hidden=!isHidden; reactBtn.setAttribute('aria-expanded', String(!reactionPicker.hidden));
  });
  reactionPicker.querySelectorAll('.mood-btn').forEach(btn=>{
    btn.addEventListener('click', async e=>{
      e.stopPropagation(); SoundManager.moodSelect();
      if(!currentUser) return alert('Login karke react karo.');
      const mood=btn.dataset.mood; const moodRef=doc(db,'posts',postId,'moods',currentUser.uid);
      try{
        const s=await getDoc(moodRef);
        if(s.exists() && s.data()?.mood===mood){ await deleteDoc(moodRef); }
        else{
          await setDoc(moodRef,{uid:currentUser.uid, mood, createdAt: serverTimestamp()});
          if(!s.exists()){
            const me=await getMyProfile(currentUser.uid);
            await notifyUser(data.uid, {type:'like', actorUid:currentUser.uid, actorName: me?.name||currentUser.displayName||'Someone', postId}).catch(()=>{});
            onLikeGiven(currentUser.uid); if(data.uid && data.uid!==currentUser.uid) onLikeReceived(data.uid);
          }
        }
        reactionPicker.hidden=true;
      }catch(err){ console.error(err); alert(err.message||'React failed.'); }
    });
  });

  // —— Reply in chat (direct private message) ——
  replyBtn.addEventListener('click', e=>{
    e.stopPropagation(); SoundManager.click();
    if(!currentUser) return alert('Login karke reply karo.');
    if(data.uid===currentUser.uid) return alert('Apni story pe reply nahi kar sakte.');
    replyComposer.hidden=!replyComposer.hidden;
    if(!replyComposer.hidden) replyComposer.querySelector('input')?.focus();
  });
  const replyInput = replyComposer.querySelector('input');
  const replySend = replyComposer.querySelector('.btn.primary');
  const replyCancel = replyComposer.querySelector('.cancel-reply');
  replyCancel.addEventListener('click', ()=>{ replyComposer.hidden=true; if(replyInput) replyInput.value=''; });
  replyInput?.addEventListener('keydown', e=>{ if(e.key==='Enter') replySend.click(); if(e.key==='Escape') replyCancel.click(); });
  replySend.addEventListener('click', async ()=>{
    const text = replyInput.value.trim();
    if(!text) return;
    if(text.length>200) return alert('Reply 200 characters se kam rakho.');
    replySend.disabled=true; replySend.textContent='Sending…';
    try{
      const me=await getMyProfile(currentUser.uid);
      const chatId=[currentUser.uid, data.uid].sort().join('_');
      const storyUrl = new URL(`view_post.html?postId=${encodeURIComponent(postId)}`, location.href).href;
      const msgText = `↩️ Replied to your story: "${text}"`;
      await addDoc(collection(db,'privateChats', chatId, 'messages'),{
        uid: currentUser.uid,
        name: me?.name || currentUser.displayName || 'User',
        userId: me?.userId || makeUserId(currentUser.uid),
        text: msgText,
        replyToStoryId: postId,
        storyPreview: data.mediaUrl || null,
        originalStoryText: data.message || '',
        createdAt: Date.now(),
        createdAtMs: Date.now()
      });
      await notifyUser(data.uid, {type:'message', actorUid: currentUser.uid, actorName: me?.name||currentUser.displayName||'Someone', text, postId}).catch(()=>{});
      SoundManager.send();
      replyInput.value=''; replyComposer.hidden=true;
      // Quick action: open chat
      if(confirm('Reply sent! Chat me dikhega — chat kholo?')) location.href=`private-chat.html?uid=${encodeURIComponent(data.uid)}`;
    }catch(err){ console.error(err); alert(err.message||'Reply failed.'); }
    finally{ replySend.disabled=false; replySend.textContent='Send'; }
  });

  // —— Share story (copy link / native share / send to connection) ——
  shareBtn.addEventListener('click', async e=>{
    e.stopPropagation();
    const storyUrl = new URL(`view_post.html?postId=${encodeURIComponent(postId)}`, location.href).href;
    if(navigator.share){
      try{ await navigator.share({title: `${data.name||'Story'} on Trio Day`, url: storyUrl}); }catch{}
    } else {
      try{ await navigator.clipboard.writeText(storyUrl); alert('Story link copied ✅'); }catch{ prompt('Copy link', storyUrl); }
    }
  });

  mediaWrap.addEventListener('click', () => SoundManager.storyTap());
  item.append(mediaWrap, content, actions, replyComposer);
  return item;
}

window.buildStoryCard = buildStoryCard;

function renderHeroStories(stories){
  const wrap = document.getElementById('heroStories');
  const empty = document.getElementById('heroStoriesEmpty');
  if(!wrap) return;
  wrap.innerHTML = '';
  const addBtn = document.createElement('button');
  addBtn.className = 'hero-story-circle hero-story-add';
  addBtn.title = 'Add story';
  addBtn.setAttribute('aria-label','Add story');
  addBtn.innerHTML = '<span class="hero-story-circle-inner" style="background:var(--primary-soft); color:var(--primary); font-size:28px;">+</span>';
  addBtn.addEventListener('click', ()=>{ SoundManager.click(); openStoryModal(); });
  wrap.appendChild(addBtn);
  if(!stories.length){
    if(empty) empty.style.display='block';
    return;
  }
  if(empty) empty.style.display='none';
  stories.forEach(s=>{
    const btn = document.createElement('button');
    btn.className = 'hero-story-circle';
    btn.title = s.name || 'Story';
    btn.setAttribute('aria-label', `Story from ${s.name || 'User'}`);
    const seenKey='seenStories'; const seenList=JSON.parse(localStorage.getItem(seenKey)||'[]');
    if(seenList.includes(s._id)) btn.classList.add('viewed');
    const inner = document.createElement('span');
    inner.className = 'hero-story-circle-inner';
    if(s.photoURL){
      const img=document.createElement('img'); img.src=s.photoURL; img.alt=''; img.loading='lazy';
      inner.appendChild(img);
    } else {
      inner.textContent = (s.name||'U').charAt(0).toUpperCase();
      inner.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-strong))';
    }
    btn.appendChild(inner);
    btn.addEventListener('click', ()=>{
      SoundManager.storyTap();
      const cur=JSON.parse(localStorage.getItem(seenKey)||'[]');
      if(!cur.includes(s._id)){ cur.push(s._id); localStorage.setItem(seenKey, JSON.stringify(cur)); btn.classList.add('viewed'); }
      const card = document.querySelector(`[data-postId="${s._id}"]`);
      if(card) card.scrollIntoView({behavior:'smooth', block:'center'});
      else {
        if(s.mediaUrl){
          const ov=document.createElement('div'); ov.className='story-viewer-overlay';
          const safeN=(s.name||'Story').replace(/</g,'&lt;'); const safeM=(s.message||'').slice(0,120).replace(/</g,'&lt;');
          const isOwn = s.uid && currentUser && s.uid===currentUser.uid;
          const isVoice = s.isVoice || s.type==='voice';
          const mediaTag = isVoice ? `<div class="voice-post-player" style="margin:0;border-radius:0"><audio src="${s.mediaUrl}" autoplay controls class="story-viewer-media" style="width:100%;max-height:none"></audio><span class="voice-duration">🎙️ ${Number(s.duration)||0}s voice</span></div>` : s.mediaUrl.match(/\.mp4|\.webm|\.mov/i) ? `<video src="${s.mediaUrl}" controls autoplay playsinline class="story-viewer-media"></video>` : `<img src="${s.mediaUrl}" class="story-viewer-media" loading="eager" alt="Story">`;
          ov.innerHTML='<div class="story-viewer-card"><div style="overflow:auto">'+mediaTag+'<div class="story-viewer-body"><strong>'+safeN+'</strong><p style="margin:6px 0;color:#94a3b8;font-size:13px">'+safeM+'</p><div class="story-viewer-reactions"><button type="button" class="action-btn mood-btn" data-mood="❤️">❤️</button><button type="button" class="action-btn mood-btn" data-mood="😂">😂</button><button type="button" class="action-btn mood-btn" data-mood="😍">😍</button><button type="button" class="action-btn mood-btn" data-mood="🔥">🔥</button><button type="button" class="action-btn mood-btn" data-mood="💯">💯</button><button type="button" class="action-btn mood-btn" data-mood="🎉">🎉</button></div><div class="story-viewer-reply"><input type="text" maxlength="200" placeholder="Reply to '+safeN+'…"><button type="button" class="btn primary sm" data-send>Send</button></div><div class="story-viewer-actions"><button type="button" class="btn secondary" style="flex:1" data-close>Close</button>'+(isOwn?'<button type="button" class="btn" style="flex:1;background:#ef4444;color:#fff;border:0" data-del>Delete Story</button>':'<button type="button" class="btn ghost" style="flex:1" data-share>↗ Share</button>')+'</div></div></div></div>';
          // Close
          ov.querySelector('[data-close]').addEventListener('click',()=>ov.remove());
          ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
          const delBtn=ov.querySelector('[data-del]'); if(delBtn){ delBtn.addEventListener('click', async ()=>{ if(!confirm('Delete this story?')) return; try{ await deleteDoc(doc(db,'posts', s._id)); ov.remove(); }catch(err){ alert(err.message||'Delete failed'); } }); }
          const shareBtn=ov.querySelector('[data-share]'); if(shareBtn){ shareBtn.addEventListener('click', async ()=>{ const url=new URL(`view_post.html?postId=${encodeURIComponent(s._id)}`,location.href).href; try{ if(navigator.share) await navigator.share({title:s.name||'Story',url}); else { await navigator.clipboard.writeText(url); alert('Link copied ✅'); } }catch{} }); }
          // React logic for viewer
          const reacts=ov.querySelectorAll('.mood-btn');
          // Live counts
          try{ onSnapshot(collection(db,'posts',s._id,'moods'), snap=>{ const counts={}; let my=null; snap.forEach(d=>{ const m=d.data()?.mood; if(m) counts[m]=(counts[m]||0)+1; if(d.id===currentUser?.uid) my=m; }); reacts.forEach(b=>{ const mm=b.dataset.mood; const c=counts[mm]||0; b.innerHTML= mm + (c?` <span style="font-size:10px;background:#6366f1;color:#fff;border-radius:999px;padding:0 4px;margin-left:2px">${c}</span>`:''); b.classList.toggle('liked', my===mm); if(my===mm) b.style.background='rgba(99,102,241,.18)'; else b.style.background=''; }); }, ()=>{}); }catch{}
          reacts.forEach(b=>{ b.addEventListener('click', async ()=>{ if(!currentUser) return alert('Login karke react karo.'); const mood=b.dataset.mood; const ref=doc(db,'posts',s._id,'moods',currentUser.uid); try{ const snap=await getDoc(ref); if(snap.exists() && snap.data()?.mood===mood) await deleteDoc(ref); else { await setDoc(ref,{uid:currentUser.uid, mood, createdAt: serverTimestamp()}); if(!snap.exists()){ const me=await getMyProfile(currentUser.uid); await notifyUser(s.uid,{type:'like',actorUid:currentUser.uid,actorName: me?.name||currentUser.displayName||'Someone', postId:s._id}).catch(()=>{}); } } SoundManager.moodSelect(); }catch(e){ alert(e.message||'React failed'); } }); });
          // Reply logic — direct chat
          const replyInput=ov.querySelector('.story-viewer-reply input'); const sendBtn=ov.querySelector('[data-send]');
          const doReply=async()=>{ const text=replyInput.value.trim(); if(!text) return; if(!currentUser) return alert('Login karke reply karo.'); if(s.uid===currentUser.uid) return alert('Apni story pe reply nahi kar sakte.'); if(text.length>200) return alert('200 chars max'); sendBtn.disabled=true; sendBtn.textContent='…'; try{ const me=await getMyProfile(currentUser.uid); const chatId=[currentUser.uid,s.uid].sort().join('_'); await addDoc(collection(db,'privateChats',chatId,'messages'),{uid:currentUser.uid, name:me?.name||currentUser.displayName||'User', userId:me?.userId||makeUserId(currentUser.uid), text:`↩️ Replied to your story: "${text}"`, replyToStoryId:s._id, storyPreview:s.mediaUrl||null, originalStoryText:s.message||'', createdAt:Date.now(), createdAtMs:Date.now()}); await notifyUser(s.uid,{type:'message',actorUid:currentUser.uid,actorName: me?.name||'Someone', text, postId:s._id}).catch(()=>{}); SoundManager.send(); replyInput.value=''; if(confirm('Reply sent! Chat me dikhega — chat kholo?')) location.href=`private-chat.html?uid=${encodeURIComponent(s.uid)}`; else { ov.remove(); } }catch(e){ alert(e.message||'Reply failed'); } finally{ sendBtn.disabled=false; sendBtn.textContent='Send'; } };
          sendBtn.addEventListener('click', doReply); replyInput.addEventListener('keydown', e=>{ if(e.key==='Enter') doReply(); });
          document.body.appendChild(ov);
        }
      }
    });
    wrap.appendChild(btn);
  });
  setTimeout(()=>{ wrap.scrollLeft = 0; }, 50);
}

document.addEventListener('click', e => {
  if (!e.target.closest('.share-btn') && !e.target.closest('.share-menu'))
    document.querySelectorAll('.share-menu.open').forEach(m => m.classList.remove('open'));
});

// ── Comment widget ────────────────────────────────────────────────────────────
(function () {
  const panel = document.createElement('div'); panel.className = 'comment-modal'; panel.style.display = 'none';
  panel.innerHTML = `<div class="comment-modal-inner" role="dialog" aria-modal="true"><div class="comment-modal-head"><h3>Comments</h3><button class="close-btn" type="button" aria-label="Close comments">✕</button></div><ul class="comments-list"></ul><div class="comment-form"><textarea maxlength="199" placeholder="Write a comment…"></textarea><div class="comment-footer"><span class="char-count">0 / 199</span><button class="btn primary">Send</button></div></div></div>`;
  document.body.appendChild(panel);
  const list = panel.querySelector('.comments-list'), input = panel.querySelector('textarea'), submitBtn = panel.querySelector('.comment-footer button'), counter = panel.querySelector('.char-count');
  let active = null, activeOwnerUid = null, unsub = null;
  function renderComments(arr) {
    list.innerHTML = '';
    if (!arr.length) { list.innerHTML = '<li class="empty-comment">No comments yet.</li>'; return; }
    arr.slice(0, 50).forEach(c => {
      const li = document.createElement('li'); li.className = 'comment-item';
      const row = document.createElement('div'); row.className = 'comment-row';
      const name = document.createElement('a'); name.className = 'comment-name'; name.href = `profile.html?uid=${encodeURIComponent(c.uid || '')}`; name.textContent = c.name || 'User';
      const txt = document.createElement('span'); txt.className = 'comment-text'; txt.textContent = c.txt || '';
      const t = document.createElement('span'); t.className = 'comment-time'; t.textContent = new Date(c.createdAtMs || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      row.append(name, txt, t); li.appendChild(row); list.appendChild(li);
    });
  }
  async function openFor(postId, title, ownerUid = null) {
    active = postId; activeOwnerUid = ownerUid;
    panel.querySelector('h3').textContent = 'Comments · ' + title;
    panel.style.display = 'block'; panel.style.position = 'fixed'; panel.style.left = '0px'; panel.style.right = '0px'; panel.style.top = 'auto'; panel.style.bottom = '0px'; panel.style.width = '100%'; panel.style.height = '44vh';
    panel.classList.add('open');
    if (unsub) unsub();
    const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAtMs', 'desc'), limit(20));
    unsub = onSnapshot(q, snap => { const arr = []; snap.forEach(d => arr.push(d.data())); renderComments(arr); }, () => renderComments([]));
    input.value = ''; counter.textContent = '0 / 199'; setTimeout(() => input.focus(), 80);
  }
  function close() { panel.classList.remove('open'); if (unsub) unsub(); unsub = null; active = null; activeOwnerUid = null; setTimeout(() => { panel.style.display = 'none'; }, 320); }
  panel.querySelector('.close-btn').addEventListener('click', close);
  panel.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => { if (panel.classList.contains('open')) close(); });
  window.addEventListener('pageshow', () => { if (panel.classList.contains('open')) close(); });
  input.addEventListener('input', () => counter.textContent = `${input.value.length} / 199`);
  submitBtn.addEventListener('click', async () => {
    if (!active || !currentUser) return alert('Login karke comment karo.');
    const txt = input.value.trim(); if (!txt) return; if (txt.length >= 200) return alert('Comment 199 characters se chhota rakho.');
    submitBtn.disabled = true;
    try {
      const me = await getMyProfile(currentUser.uid);
      await addDoc(collection(db, 'posts', active, 'comments'), { txt, name: me?.name || currentUser.displayName || 'User', uid: currentUser.uid, userId: me?.userId || makeUserId(currentUser.uid), createdAt: serverTimestamp(), createdAtMs: Date.now() });
      await notifyUser(activeOwnerUid, { type: 'comment', actorUid: currentUser.uid, actorName: me?.name || currentUser.displayName || 'Someone', postId: active });
      onCommentCreated(currentUser.uid);
      input.value = ''; counter.textContent = '0 / 199';
    } catch (err) { console.error(err); alert('Comment save nahi ho paya.'); }
    finally { submitBtn.disabled = false; }
  });
  window.CommentWidget = { openFor, close };
})();

if ('serviceWorker' in navigator) {
  // Production and correct local serve (public/ as root) — /service-worker.js should be at site root.
  // VS Code Live Preview serves project root, so /service-worker.js 404s — handle gracefully, no console error.
  // Correct local command: `npx serve public -p 3000` or `firebase emulators:start --only hosting`
  const swPath = '/service-worker.js';
  navigator.serviceWorker.register(swPath, { scope: '/' })
    .then(() => console.log('Service worker registered'))
    .catch(() => {
      // No SW at this path (likely serving project root locally) — clean up stale registrations
      navigator.serviceWorker.getRegistrations?.().then(rs => rs.forEach(r => r.unregister()));
    });
}
