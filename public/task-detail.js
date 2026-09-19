import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import {
  getCommunityTask, joinTask, leaveTask, isMember, toggleLike,
  addComment, listComments, completeTask,
  setChallengeFeatured, setChallengeHidden, removeChallenge, archiveTask
} from './gamification/community-tasks.js';
import { isAdmin } from './gamification/templates.js';
import { trioCache } from './trio-cache.js';
import { escapeHtml as esc } from './utils.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const taskId = params.get('id');
let me = null;
let profile = null;
let task = null;
let admin = false;

async function followCreator(creatorUid) {
  if (!me || !creatorUid || me.uid === creatorUid) return;
  await setDoc(doc(db, 'users', me.uid, 'following', creatorUid), {
    uid: creatorUid, createdAt: serverTimestamp()
  });
  await setDoc(doc(db, 'users', creatorUid, 'followers', me.uid), {
    uid: me.uid, createdAt: serverTimestamp()
  });
  trioCache.invalidatePrefix(`following_${me.uid}`);
  trioCache.invalidatePrefix(`followers_${creatorUid}`);
  alert('Following creator ✅');
}

async function shareCompletionToStory() {
  if (!me || !task) throw new Error('Login required');
  const userName = profile?.name || me.displayName || 'User';
  const message = `🏁 Completed: ${task.title}`.slice(0, 500);
  await setDoc(doc(db, 'posts', `${me.uid}_challenge_${task.id}_${Date.now()}`), {
    uid: me.uid,
    name: userName,
    photoURL: profile?.photoURL || me.photoURL || null,
    message,
    type: 'story',
    isStory: true,
    privacy: 'public',
    expiresAtMs: Date.now() + 24 * 60 * 60 * 1000,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
    challengeId: task.id,
    challengeTitle: task.title,
    challengeIcon: task.icon || '🏁',
    challengeCompleted: true,
    challengeXp: Number(task.xpReward) || 0
  });
}

async function render() {
  task = await getCommunityTask(taskId);
  if (!task) {
    $('detail').innerHTML = '<h2>Challenge not found</h2><a href="tasks.html">Back</a>';
    return;
  }
  if (task.hidden && !admin && me?.uid !== task.creatorUid) {
    $('detail').innerHTML = '<h2>This challenge is unavailable</h2><a href="tasks.html">Back</a>';
    $('actions').innerHTML = '';
    return;
  }
  const ends = task.endAtMs ? new Date(task.endAtMs).toLocaleString() : '—';
  $('detail').innerHTML = `
    <span class="eyebrow">${esc(task.kind || 'challenge')} · ${esc(task.status || 'active')}${task.featured ? ' · featured' : ''}${task.hidden ? ' · hidden' : ''}</span>
    <h1 style="margin:0.35rem 0">${esc(task.icon || '🏁')} ${esc(task.title)}</h1>
    <p>${esc(task.description || '')}</p>
    <div class="community-stats">
      <span>${task.joins || 0} joined</span>
      <span>${task.likes || 0} likes</span>
      <span>${task.comments || 0} comments</span>
      <span>${task.completions || 0} completed</span>
      <span>+${task.xpReward || 0} XP</span>
    </div>
    <p style="font-size:0.8rem;opacity:0.7;margin-top:0.75rem">
      By <a href="profile.html?uid=${encodeURIComponent(task.creatorUid || '')}">${esc(task.creatorName || 'User')}</a>
      · Ends ${esc(ends)}
    </p>`;

  const joined = me ? await isMember(taskId, me.uid) : false;
  const completionSnap = me ? await getDoc(doc(db, 'communityTasks', taskId, 'completions', me.uid)) : null;
  const completed = !!completionSnap?.exists();
  const actions = $('actions');
  actions.innerHTML = `
    <button type="button" class="btn primary" id="joinBtn">${joined ? 'Leave' : 'Join'}</button>
    <button type="button" class="btn secondary" id="likeBtn">Like</button>
    <button type="button" class="btn primary" id="completeBtn" ${completed ? 'disabled' : ''}>${completed ? 'Completed ✓' : 'Complete (+XP)'}</button>
    ${completed ? '<button type="button" class="btn secondary" id="storyBtn">📸 Share to Story</button>' : ''}
    <button type="button" class="btn secondary" id="followBtn">Follow creator</button>
    <a class="btn secondary" href="tasks.html">Back</a>
    ${admin ? `
      <button type="button" class="btn secondary" id="featBtn">${task.featured ? 'Unfeature' : 'Feature'}</button>
      <button type="button" class="btn secondary" id="hideBtn">${task.hidden ? 'Unhide' : 'Hide'}</button>
      <button type="button" class="btn secondary" id="archiveBtn">Archive</button>
      <button type="button" class="btn secondary danger-action" id="removeBtn">Remove</button>
    ` : ''}`;

  $('joinBtn').onclick = async () => {
    if (!me) return alert('Login first');
    if (joined) await leaveTask(taskId, me.uid);
    else await joinTask(taskId, me.uid, profile);
    await render();
  };
  $('likeBtn').onclick = async () => {
    if (!me) return alert('Login first');
    await toggleLike(taskId, me.uid);
    await render();
  };
  $('storyBtn')?.addEventListener('click', async () => {
    if (!me || !completed) return;
    const btn = $('storyBtn');
    btn.disabled = true;
    btn.textContent = 'Sharing…';
    try {
      await shareCompletionToStory();
      btn.textContent = 'Shared to Story ✓';
      alert('Challenge completion shared to your Story 🎉');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Could not share to Story');
      btn.disabled = false;
      btn.textContent = '📸 Share to Story';
    }
  });

  $('completeBtn').onclick = async () => {
    if (!me) return alert('Login first');
    const btn = $('completeBtn');
    const prevText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Completing…';
    try {
      const r = await completeTask(taskId, me.uid, profile);
      if (r.already) {
        alert('Already completed');
        btn.textContent = 'Done';
        btn.disabled = true;
        return;
      }
      // Optimistic: bump local count immediately before re-render
      if (task) task.completions = (Number(task.completions) || 0) + 1;
      await render();
      // Ensure button reflects done state after render
      const newBtn = $('completeBtn');
      if (newBtn) { newBtn.textContent = 'Done'; newBtn.disabled = true; }
    } catch (err) {
      alert(err.message || 'Failed');
      btn.textContent = prevText;
      btn.disabled = false;
    }
  };
  $('followBtn').onclick = () => followCreator(task.creatorUid);

  if (admin) {
    $('featBtn').onclick = async () => { await setChallengeFeatured(taskId, !task.featured); await render(); };
    $('hideBtn').onclick = async () => { await setChallengeHidden(taskId, !task.hidden); await render(); };
    $('archiveBtn').onclick = async () => { await archiveTask(taskId); location.href = 'tasks.html'; };
    $('removeBtn').onclick = async () => {
      if (!confirm('Permanently remove this challenge?')) return;
      await removeChallenge(taskId);
      location.href = 'tasks.html';
    };
  }

  const comments = await listComments(taskId);
  $('commentsList').innerHTML = comments.length
    ? comments.map(c => `<li><strong><a href="profile.html?uid=${encodeURIComponent(c.uid || '')}">${esc(c.name)}</a></strong> ${esc(c.txt)}</li>`).join('')
    : '<li class="muted">No comments yet.</li>';
}

$('commentBtn').addEventListener('click', async () => {
  if (!me) return alert('Login first');
  const txt = $('commentInput').value.trim();
  if (!txt) return;
  try {
    await addComment(taskId, me.uid, profile, txt);
    $('commentInput').value = '';
    await render();
  } catch (err) { alert(err.message || 'Failed'); }
});

onAuthStateChanged(auth, async user => {
  me = user;
  if (user) {
    const snap = await getDoc(doc(db, 'users', user.uid));
    profile = snap.exists() ? snap.data() : {};
    admin = await isAdmin(user.uid);
  }
  if (!taskId) {
    $('detail').innerHTML = '<h2>Missing challenge id</h2>';
    return;
  }
  await render();
});
