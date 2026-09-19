import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc, onSnapshot, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import {
  getCommunityTask, joinTask, leaveTask, isMember, toggleLike,
  addComment, listComments, completeTask,
  setChallengeFeatured, setChallengeHidden, removeChallenge, archiveTask,
  submitProof, listSubmissions, reviewSubmission, setChallengePresence, rateChallenge as saveChallengeRating
} from './gamification/community-tasks.js';
import { isAdmin } from './gamification/templates.js';
import { trioCache } from './trio-cache.js';
import { escapeHtml as esc } from './utils.js';
import { renderMysteryInvestigation, bindMysteryInteractions } from './mystery-case.js';

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

async function rateChallenge(rating, feedback) {
  if (!me || !task) return;
  return saveChallengeRating(taskId, me.uid, rating, feedback);
}

let presenceTimer = null;
let presenceActive = false;
let roomUnsub = null;

function renderChallengeRoom(taskId, activePeerMode) {
  const mount = $('challengeRoomMount');
  roomUnsub?.();
  roomUnsub = null;
  if (!mount) return;
  if (!me || !task || !activePeerMode || activePeerMode !== 'together') {
    mount.hidden = true;
    mount.innerHTML = '';
    return;
  }

  mount.hidden = false;
  mount.innerHTML = `
    <section class="challenge-room">
      <div class="challenge-room-head">
        <div><h3>Solve Together</h3><p>Discuss clues with everyone accepted into this challenge.</p></div>
        <span class="nkm-badge">${Number(task.joins || 0)} players</span>
      </div>
      <div id="challengeRoomMessages" class="challenge-room-messages"><div class="muted">Loading room…</div></div>
      <form id="challengeRoomForm" class="challenge-room-form">
        <input id="challengeRoomInput" maxlength="500" autocomplete="off" placeholder="Share a clue, theory or question…">
        <button class="btn primary" type="submit">Send</button>
      </form>
    </section>`;

  const messagesBox = $('challengeRoomMessages');
  const form = $('challengeRoomForm');
  const input = $('challengeRoomInput');
  if (!messagesBox || !form || !input) return;

  const roomQuery = query(
    collection(db, 'communityTasks', taskId, 'roomMessages'),
    orderBy('createdAtMs', 'asc'),
    limit(120)
  );
  roomUnsub = onSnapshot(roomQuery, snap => {
    messagesBox.innerHTML = '';
    if (snap.empty) {
      messagesBox.innerHTML = '<div class="muted">No messages yet. Start the investigation together.</div>';
      return;
    }
    snap.forEach(d => {
      const m = d.data();
      const row = document.createElement('article');
      row.className = 'challenge-room-message' + (m.uid === me.uid ? ' mine' : '');
      const safeName = esc(m.name || 'Player');
      const safeText = esc(m.text || '');
      row.innerHTML = `<span class="challenge-room-author">${safeName}</span><span>${safeText}</span><span class="challenge-room-time">${esc(new Date(Number(m.createdAtMs)||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</span>`;
      messagesBox.appendChild(row);
    });
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }, err => {
    console.error('Challenge room listener:', err);
    messagesBox.innerHTML = '<div class="muted">The room is unavailable right now.</div>';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || !me) return;
    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      await addDoc(collection(db, 'communityTasks', taskId, 'roomMessages'), {
        uid: me.uid,
        name: profile?.name || me.displayName || 'Player',
        text: text.slice(0, 500),
        createdAtMs: Date.now(),
        createdAt: serverTimestamp()
      });
      input.value = '';
      input.focus();
    } catch (err) {
      alert(err.message || 'Could not send room message.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
    }
  });
}

async function syncChallengePresence(active) {
  if (!me || !taskId) return;
  if (!active) {
    if (!presenceActive) return;
    presenceActive = false;
    clearInterval(presenceTimer);
    presenceTimer = null;
    await setChallengePresence(taskId, false).catch(() => {});
    return;
  }
  if (presenceActive) return;
  presenceActive = true;
  await setChallengePresence(taskId, true).catch(() => {});
  clearInterval(presenceTimer);
  presenceTimer = setInterval(() => setChallengePresence(taskId, true).catch(() => {}), 45 * 1000);
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
    $('detail').innerHTML = '<h2>Challenge not found</h2><a href="all-users.html">Back</a>';
    return;
  }
  if (task.hidden && !admin && me?.uid !== task.creatorUid) {
    $('detail').innerHTML = '<h2>This challenge is unavailable</h2><a href="all-users.html">Back</a>';
    $('actions').innerHTML = '';
    return;
  }
  const ends = task.endAtMs ? new Date(task.endAtMs).toLocaleString() : '—';
  const duration = Number(task.durationMinutes || 0);
  const category = task.category || 'Challenge';
  const difficulty = task.difficulty || 'Medium';
  $('detail').innerHTML = `
    <span class="eyebrow">${esc(category)} · ${esc(difficulty)} · ${duration ? duration + ' min · ' : ''}${esc(task.status || 'active')}${task.featured ? ' · featured' : ''}${task.hidden ? ' · hidden' : ''}</span>
    <h1 style="margin:0.35rem 0">${esc(task.icon || '🏁')} ${esc(task.title)}</h1>
    <p>${esc(task.description || '')}</p>
    <div class="community-stats">
      <span>${task.joins || 0} joined</span>
      <span>${task.likes || 0} likes</span>
      <span>${task.comments || 0} comments</span>
      <span>${task.completions || 0} completed</span>
      <span>+${task.xpReward || 0} XP</span><span>${Number(task.ratingAverage || 0) ? Number(task.ratingAverage).toFixed(1) + ' ★' : 'Not rated'}</span>
    </div>
    <p style="font-size:0.8rem;opacity:0.7;margin-top:0.75rem">
      By <a href="profile.html?uid=${encodeURIComponent(task.creatorUid || '')}">${esc(task.creatorName || 'User')}</a>
      · Ends ${esc(ends)}
    </p>`;

  const joined = me ? await isMember(taskId, me.uid) : false;
  const completionSnap = me ? await getDoc(doc(db, 'communityTasks', taskId, 'completions', me.uid)) : null;
  const completed = !!completionSnap?.exists();
  const actions = $('actions');
  const startedKey = me ? `challenge_started_${me.uid}_${taskId}` : '';
  const modeKey = me ? `challenge_mode_${me.uid}_${taskId}` : '';
  const started = startedKey ? localStorage.getItem(startedKey) === '1' : false;
  const activeMode = modeKey ? (localStorage.getItem(modeKey) || 'solo') : 'solo';
  const isMystery = task.challengeType === 'mystery';
  const verificationType = task.verificationType === 'answer' ? 'answer' : 'proof';
  syncChallengePresence(!!(joined && started && !completed));
  const proofInstruction = task.proofInstruction || 'Explain what you did and provide enough evidence for the creator to verify it.';
  if (isMystery) {
    const existingCase = $('mysteryCaseMount');
    if (existingCase) existingCase.remove();
    const mount = document.createElement('div');
    mount.id = 'mysteryCaseMount';
    mount.innerHTML = renderMysteryInvestigation(task.caseData || {}, started, completed, taskId);
    $('detail').appendChild(mount);
  }

  actions.innerHTML = `
    <button type="button" class="btn primary" id="joinBtn">${joined ? 'REJECT' : 'ACCEPT'}</button>
    ${joined && !completed && !started ? `
      <div class="start-mode-grid">
        <button type="button" class="start-mode-card" data-start-mode="solo"><strong>Start Solo</strong><span>Investigate at your own pace.</span></button>
        <button type="button" class="start-mode-card" data-start-mode="together"><strong>Solve Together</strong><span>Open a live room with accepted players.</span></button>
      </div>` : ''}
    ${joined && !completed && started ? `<button type="button" class="btn primary" id="startBtn">${activeMode === 'together' ? 'Open Room' : 'Continue Solo'}</button>` : ''}
    ${joined && started && !completed && !isMystery && verificationType === 'answer' ? `
      <div class="challenge-submit-box">
        <strong>Submit your answer</strong>
        <input id="challengeAnswer" maxlength="200" placeholder="Your answer">
        <button type="button" class="btn primary" id="submitAnswerBtn">Check answer</button>
        <small class="muted">You only complete the challenge when the answer is verified.</small>
      </div>` : ''}
    ${joined && started && !completed && !isMystery && verificationType === 'proof' ? `
      <div class="challenge-submit-box">
        <strong>Proof required</strong>
        <p class="muted">${esc(proofInstruction)}</p>
        <textarea id="proofText" rows="4" maxlength="1000" placeholder="Show your reasoning / evidence…"></textarea>
        <button type="button" class="btn primary" id="submitProofBtn">Submit proof</button>
        <small class="muted">The creator reviews this before completion is awarded.</small>
      </div>` : ''}
    ${isMystery && joined && !started && !completed ? '<span class="muted">Accept this case to begin.</span>' : ''}
    ${completed ? '<div class="challenge-complete-note">Verified completion ✓</div><button type="button" class="btn secondary" id="storyBtn">📸 Share to Story</button>' : ''}
    <a class="btn secondary" href="all-users.html">Back to Discover</a>
    ${admin ? `
      <button type="button" class="btn secondary" id="featBtn">${task.featured ? 'Unfeature' : 'Feature'}</button>
      <button type="button" class="btn secondary" id="hideBtn">${task.hidden ? 'Unhide' : 'Hide'}</button>
      <button type="button" class="btn secondary" id="archiveBtn">Archive</button>
      <button type="button" class="btn secondary danger-action" id="removeBtn">Remove</button>
    ` : ''}`;


  $('joinBtn')?.addEventListener('click', async () => {
    if (!me) return alert('Login first');
    if (joined) {
      const ok = confirm('Reject this challenge? Your accepted state will be removed.');
      if (!ok) return;
      await leaveTask(taskId, me.uid);
      if (startedKey) localStorage.removeItem(startedKey);
      if (modeKey) localStorage.removeItem(modeKey);
    } else {
      await joinTask(taskId, me.uid, profile);
    }
    await render();
  });
  actions.querySelectorAll('[data-start-mode]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!me || !joined || completed) return;
      const mode = btn.dataset.startMode === 'together' ? 'together' : 'solo';
      localStorage.setItem(startedKey, '1');
      if (modeKey) localStorage.setItem(modeKey, mode);
      await syncChallengePresence(true);
      await render();
    });
  });

  $('startBtn')?.addEventListener('click', async () => {
    if (!me || !joined || completed) return;
    await syncChallengePresence(true);
    renderChallengeRoom(taskId, activeMode);
    $('challengeRoomMount')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
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

  renderChallengeRoom(taskId, joined && started && !completed ? activeMode : null);

  if (completed && !document.getElementById('ratingBtn')) {
    actions.insertAdjacentHTML('beforeend', '<button type="button" class="btn secondary" id="ratingBtn">Rate challenge</button>');
    $('ratingBtn').onclick = async () => {
      const value = Number(prompt('Rate this challenge from 1 to 5'));
      if (!value || value < 1 || value > 5) return;
      const feedback = prompt('What did you think? (optional)') || '';
      try { await rateChallenge(value, feedback); alert('Rating saved ✓'); await render(); }
      catch (e) { alert(e.message || 'Could not save rating'); }
    };
  }

  $('submitAnswerBtn')?.addEventListener('click', async () => {
    const answer = $('challengeAnswer').value.trim();
    if (!answer) return alert('Enter your answer first.');
    const btn = $('submitAnswerBtn');
    btn.disabled = true;
    btn.textContent = 'Checking…';
    try {
      const result = await completeTask(taskId, me.uid, profile, { answer });
      if (result.correct === false) {
        alert(result.message || 'Not correct yet.');
        btn.disabled = false;
        btn.textContent = 'Check answer';
        return;
      }
      if (result.verified || result.already) {
        alert(result.already ? 'Already completed.' : 'Correct — challenge completed ✓');
        await render();
      }
    } catch (err) {
      alert(err.message || 'Could not verify the answer.');
      btn.disabled = false;
      btn.textContent = 'Check answer';
    }
  });

  $('submitProofBtn')?.addEventListener('click', async () => {
    const proof = $('proofText').value.trim();
    if (proof.length < 10) return alert('Add enough proof for the creator to review.');
    const btn = $('submitProofBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    try {
      await submitProof(taskId, me.uid, profile, proof);
      alert('Proof submitted. The creator will review it.');
      await render();
    } catch (err) {
      alert(err.message || 'Could not submit proof.');
      btn.disabled = false;
      btn.textContent = 'Submit proof';
    }
  });


  if (me?.uid === task.creatorUid && !completed) {
    const submissions = await listSubmissions(taskId);
    const pending = submissions.filter(x => x.status === 'pending');
    if (pending.length) {
      actions.insertAdjacentHTML('beforeend', `
        <section class="challenge-review-box">
          <strong>Proof submissions</strong>
          ${pending.map(x => `<article class="proof-review-item">
            <div><strong>${esc(x.name || 'Player')}</strong><p>${esc(x.proofText || '')}</p></div>
            <div class="proof-review-actions">
              <button type="button" class="btn primary" data-review="approved" data-uid="${esc(x.uid)}">Approve</button>
              <button type="button" class="btn secondary" data-review="rejected" data-uid="${esc(x.uid)}">Reject</button>
            </div>
          </article>`).join('')}
        </section>`);
      actions.querySelectorAll('[data-review]').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await reviewSubmission(taskId, btn.dataset.uid, btn.dataset.review);
            await render();
          } catch (err) {
            alert(err.message || 'Could not review proof.');
            btn.disabled = false;
          }
        });
      });
    }
  }

  if (isMystery && started && !completed) {
    bindMysteryInteractions(taskId, task.caseData || {});
  }

  if (admin) {
    $('featBtn').onclick = async () => { await setChallengeFeatured(taskId, !task.featured); await render(); };
    $('hideBtn').onclick = async () => { await setChallengeHidden(taskId, !task.hidden); await render(); };
    $('archiveBtn').onclick = async () => { await archiveTask(taskId); location.href = 'all-users.html'; };
    $('removeBtn').onclick = async () => {
      if (!confirm('Permanently remove this challenge?')) return;
      await removeChallenge(taskId);
      location.href = 'all-users.html';
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

window.addEventListener('trio-mystery-complete', () => { render().catch(console.error); });
window.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    syncChallengePresence(false).catch(() => {});
  } else if (me && task) {
    const startedKey = `challenge_started_${me.uid}_${taskId}`;
    isMember(taskId, me.uid).then(joined => {
      const completedRef = doc(db, 'communityTasks', taskId, 'completions', me.uid);
      return getDoc(completedRef).then(snap => syncChallengePresence(!!(joined && localStorage.getItem(startedKey) === '1' && !snap.exists())));
    }).catch(() => {});
  }
});
window.addEventListener('pagehide', () => { syncChallengePresence(false).catch(() => {}); });

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
