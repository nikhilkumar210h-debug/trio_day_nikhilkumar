import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, doc, getDocs, getDoc, getCountFromServer, query, where, orderBy, limit,
  setDoc, addDoc, deleteDoc, serverTimestamp, onSnapshot, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { listCommunityTasks } from './gamification/community-tasks.js?v=20260921-fix2';
import { workerPost } from './gamification/worker-config.js';
import { getCachedUser } from './services/userCache.js';
import { showToast } from './ui/toast.js';
import { createSheet } from './ui/sheet.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'''}[c]));
const host = document.getElementById('challengeCard');
let currentUser = null;
let currentChallenge = null;

async function loadChallenge() {
  const params = new URLSearchParams(location.search);
  const challengeId = params.get('id') || params.get('challenge');
  if (!challengeId) { host.innerHTML = '<p style="padding:20px;text-align:center">Challenge not found</p>'; return; }

  try {
    let challenge = null;
    
    const communitySnap = await getDoc(doc(db, 'communityTasks', challengeId));
    if (communitySnap.exists()) {
      const data = communitySnap.data();
      if (data.kind === 'challenge' && data.interaction?.question && Array.isArray(data.interaction?.options)) {
        challenge = {
          id: challengeId,
          tag: data.category || 'COMMUNITY',
          q: data.interaction.question,
          o: data.interaction.options,
          creatorUid: data.creatorUid || '',
          creatorName: data.creatorName || 'Admin',
          creatorRole: data.creatorRole || (data.creatorUid ? 'Member' : 'Admin'),
          format: data.interaction.format || 'quick',
          twist: data.interaction.twist || '',
          createdAtMs: Number(data.createdAtMs || data.createdAt?.toMillis?.() || 0)
        };
      }
    }
    
    if (!challenge) {
      const BUILTINS = {
        trip: {id:'trip', tag:'CHOICE', q:'You get one free trip tomorrow. Where are you going?', o:['Japan 🇯🇵','Switzerland 🇨🇭','Somewhere unexpected 🌍']},
        hour: {id:'hour', tag:'MOOD', q:'You have one free hour tonight. What sounds better?', o:['Talk to someone 💬','Play something 🎮','Learn something 🧠']},
        weekend: {id:'weekend', tag:'MAKE', q:'You have one weekend to make something. What do you pick?', o:['An app 💻','A game 🎮','Something useful 🛠️']},
        food: {id:'food', tag:'LIFE', q:'Pick one forever.', o:['Street food 🌮','Home food 🍲','Restaurant food 🍽️']},
        'study-reset': {id:'study-reset', tag:'STUDY', q:'You have 30 minutes before an important test. What do you do?', o:['Review notes 📚','Solve questions ✍️','Take a short reset 🧠']},
        'career-path': {id:'career-path', tag:'CAREER', q:'You can try one career skill for a month. Which one?', o:['Build projects 💻','Communicate better 🎤','Analyze data 📊']},
        'college-day': {id:'college-day', tag:'CAMPUS', q:'Your ideal free hour on campus looks like what?', o:['Club activity 🎯','Friends & chai ☕','Quiet study 📖']},
        debug: {id:'debug', tag:'TECH', q:'Your code works but you do not know why. What is your next move?', o:['Read the docs 📘','Add small tests 🧪','Inspect it step by step 🔎']},
        'weekend-plan': {id:'weekend-plan', tag:'LIFE', q:'A completely free Sunday appears. What wins?', o:['Go outside 🌤️','Build something 🛠️','Stay in and recharge 🎧']},
        'movie-night': {id:'movie-night', tag:'FUN', q:'Pick the movie-night rule.', o:['One person chooses 🎬','Everyone votes 🗳️','Random pick 🎲']},
        'helping-hand': {id:'helping-hand', tag:'COMMUNITY', q:'Someone in your group is stuck. What help matters first?', o:['Explain the idea 💡','Do it together 🤝','Point them to a resource 🔗']},
        'first-step': {id:'first-step', tag:'CAREER', q:'You want to start a big goal today. What is the first move?', o:['Make a tiny plan 📝','Start immediately ⚡','Find someone to learn from 👥']},
        'focus-mode': {id:'focus-mode', tag:'STUDY', q:'What helps you protect a focused study session?', o:['Phone away 📵','Timed blocks ⏱️','Study with someone 👥']},
        'build-vs-watch': {id:'build-vs-watch', tag:'TECH', q:'You have one evening for tech. What sounds better?', o:['Build a mini tool 🔧','Learn a new concept 🧠','Explore a cool project 🔍']},
        'small-kindness': {id:'small-kindness', tag:'COMMUNITY', q:'What small action makes a group feel better?', o:['Welcome someone 👋','Share credit 🙌','Help without being asked ❤️']},
        'choose-fast': {id:'choose-fast', tag:'QUICK PICK', q:'Your friends give you three spontaneous plans. What do you choose?', o:['Food hunt 🍜','Game night 🎮','Random walk 🚶']}
      };
      challenge = BUILTINS[challengeId] || BUILTINS.trip;
    }
    
    currentChallenge = challenge;
    renderChallenge(challenge);
    hydrateChallenge(challenge);
    
  } catch (err) {
    console.error('loadChallenge:', err);
    host.innerHTML = '<p style="padding:20px;text-align:center;color:var(--color-ink-muted)">Could not load challenge</p>';
  }
}

function renderChallenge(c) {
  const formatLabels = {quick:'⚡ QUICK PICK',rather:'↔ WOULD YOU',hot:'🔥 HOT TAKE',scenario:'✦ SCENARIO'};
  const format = c.format || 'quick';
  const twist = c.twist || '';
  
  document.getElementById('challengeQuestion').textContent = c.q;
  document.getElementById('challengeQuestionDisplay').textContent = c.q;
  document.getElementById('challengeTag').textContent = c.tag || 'CHALLENGE';
  document.getElementById('challengeFormat').textContent = formatLabels[format] || '⚡ QUICK PICK';
  document.getElementById('challengeMeta').textContent = `${c.tag} · Quick interaction · under 60 seconds`;
  document.getElementById('challengeCreator').textContent = c.creatorName || 'Trio Day';
  document.querySelector('.challenge-next-btn').dataset.challengeId = c.id;
  
  const optsHtml = c.o.map((x,i) => `<button type="button" data-choice="${i}" aria-label="Option ${String.fromCharCode(65+i)}: ${esc(x)}"><span class="choice-letter">${String.fromCharCode(65+i)}</span><span>${esc(x)}</span></button>`).join('');
  document.getElementById('challengeOptions').innerHTML = optsHtml;
  
  document.querySelectorAll('[data-choice]').forEach(btn => btn.addEventListener('click', () => handleChoice(c.id, Number(btn.dataset.choice))));
  
  document.querySelector('.challenge-discuss-btn')?.addEventListener('click', () => toggleDiscussion(c));
  document.querySelector('.challenge-share-btn')?.addEventListener('click', () => shareChallenge(c));
  document.querySelector('.challenge-opposite-btn')?.addEventListener('click', () => handleOpposite(c));
  document.querySelector('.challenge-next-btn')?.addEventListener('click', () => goToNext(c.id));
}

async function hydrateChallenge(c) {
  const resultPreview = document.querySelector('.challenge-result-preview');
  const result = document.getElementById('challengeResult');
  
  const responses = await getResponses(c.id);
  const counts = countsFromResponses(responses);
  const mySnap = currentUser ? await getDoc(doc(db,'challengeAnswers',currentUser.uid + '_' + c.id)).catch(() => null) : null;
  const myChoice = mySnap?.exists() ? Number(mySnap.data().choice) : null;
  
  renderCommunityResult(result, c, counts, Number.isInteger(myChoice) ? myChoice : null);
  await renderResultPreview(resultPreview, c, responses);
  
  if (Number.isInteger(myChoice)) {
    document.querySelectorAll('[data-choice]').forEach((x,i) => x.classList.toggle('is-selected', i === myChoice));
    result.hidden = false;
    resultPreview.setAttribute('aria-expanded', 'true');
    resultPreview.classList.add('is-open');
  }
}

async function handleChoice(challengeId, choice) {
  if (!currentUser) { location.href = 'login.html?redirect=' + encodeURIComponent(location.href); return; }
  try {
    await updateChallengeCounter(challengeId, currentUser.uid, choice);
    const responses = await getResponses(challengeId);
    const counts = countsFromResponses(responses);
    const result = document.getElementById('challengeResult');
    renderCommunityResult(result, currentChallenge, counts, choice);
    document.querySelectorAll('[data-choice]').forEach((x,i) => x.classList.toggle('is-selected', i === choice));
    const resultPreview = document.querySelector('.challenge-result-preview');
    await renderResultPreview(resultPreview, currentChallenge, responses);
    result.hidden = false;
    resultPreview.setAttribute('aria-expanded', 'true');
    resultPreview.classList.add('is-open');
    await awardXpWithRetry(challengeId, currentUser);
    await bumpStreakWithRetry(challengeId, currentUser);
  } catch (err) {
    console.error(err);
    showToast('Could not save your answer', 'error');
  }
}

function toggleDiscussion(c) {
  const discussion = document.querySelector('.challenge-thread');
  const btn = document.querySelector('.challenge-discuss-btn');
  discussion.hidden = !discussion.hidden;
  btn.textContent = discussion.hidden ? '💬 Join the discussion' : '💬 Discussion open';
  if (!discussion.hidden) attachDiscussion(c, discussion);
}

function shareChallenge(c) {
  const url = new URL('c/index.html', location.origin);
  url.searchParams.set('id', c.id);
  
  const { sheet, open, close } = createSheet({
    title: 'Share Challenge',
    content: `<div style="display:flex;flex-direction:column;gap:10px"><button type="button" class="nkm-btn nkm-btn--primary" data-action="copy" style="justify-content:flex-start;text-align:left;width:100%"><span style="margin-right:10px">🔗</span> Copy Link</button><button type="button" class="nkm-btn nkm-btn--secondary" data-action="native" style="justify-content:flex-start;text-align:left;width:100%"><span style="margin-right:10px">↗</span> System Share</button></div>`,
    actions: ''
  });
  sheet.querySelector('[data-action="copy"]').onclick = async () => { close(); await navigator.clipboard.writeText(url.href); showToast('Challenge link copied ✓', 'success'); };
  sheet.querySelector('[data-action="native"]').onclick = async () => { close(); try { if (navigator.share) await navigator.share({title:'Trio Day Challenge', text:c.q, url:url.href}); else { await navigator.clipboard.writeText(url.href); showToast('Challenge link copied ✓', 'success'); } } catch (err) { if (err?.name !== 'AbortError') { try { await navigator.clipboard.writeText(url.href); showToast('Challenge link copied ✓', 'success'); } catch {} } } };
  open();
}

function handleOpposite(c) {
  if (!currentUser) return;
  // Use the engagement-loop import
  import('./engagement-loop.js?v=20261003').then(m => m.showOppositeChatSheet(c.id, ''));
}

function goToNext(currentId) {
  // Simple: go to challenge.html with next param
  location.href = 'challenge.html';
}

async function getResponses(id) {
  try {
    const snap = await getDocs(query(collection(db,'challengeAnswers'), where('challengeId','==',id)));
    return snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => (Number(b.createdAtMs)||0) - (Number(a.createdAtMs)||0));
  } catch (err) { console.warn('challenge responses unavailable', err); return []; }
}

async function getResponseCount(id) {
  if (!id) return 0;
  try {
    const snap = await getCountFromServer(query(collection(db, 'challengeAnswers'), where('challengeId', '==', id)));
    return Number(snap.data().count) || 0;
  } catch (_) { return 0; }
}

function countsFromResponses(responses) {
  const counts = {};
  responses.forEach(r => { const n = Number(r.choice); if (Number.isInteger(n)) counts[n] = (counts[n] || 0) + 1; });
  return counts;
}

function renderCommunityResult(result, c, counts, selectedChoice) {
  const total = Object.values(counts).reduce((a,b) => a + b, 0);
  const safeTotal = Math.max(1, total);
  const same = Number.isInteger(selectedChoice) ? (counts[selectedChoice] || 0) : 0;
  const enoughForPercent = total >= 5;
  const rows = c.o.map((label, index) => {
    const count = counts[index] || 0;
    const pct = Math.round((count / safeTotal) * 100);
    const value = pct + '% · ' + count + (count === 1 ? ' person' : ' people');
    return '<div class="result-bar-row" data-result-option="' + index + '"><span class="result-bar-label">' + esc(label) + '</span><span class="result-track"><span class="result-fill" style="width:' + Math.max(2, pct) + '%"></span></span><span class="result-voter-slot" aria-label="People who chose this option"></span><span class="result-bar-value">' + value + '</span></div>';
  }).join('');
  result.innerHTML = '<div class="result-summary"><strong>' + (Number.isInteger(selectedChoice) ? same + ' ' + (same === 1 ? 'person' : 'people') + ' chose your answer' : 'Community choices') + '</strong><span>' + total + ' total response' + (total === 1 ? '' : 's') + (enoughForPercent ? ' · community split' : '') + '</span></div><div class="result-bars">' + rows + '</div>';
  result.hidden = true;
}

async function renderResultPreview(preview, c, responses) {
  const latest = responses.slice(0, 2);
  const responseCount = await getResponseCount(c.id);
  const avatars = await loadProfilesForPeople(latest, latest.length);
  preview.innerHTML = '<span class="challenge-result-preview-label">' + responseCount + ' ' + (responseCount === 1 ? 'response' : 'responses') + '</span><span class="challenge-result-preview-avatars">' + latest.map(r => { const u = avatars.get(r.uid) || {}; const name = u.name || 'Trio member'; return '<span class="challenge-result-preview-avatar" title="' + esc(name) + '">' + avatarMarkup(u, name) + '</span>'; }).join('') + '</span><span class="challenge-result-preview-arrow">⌄</span>';
  preview.hidden = false;
}

async function loadProfilesForPeople(people, count = 2) {
  const visible = people.slice(0, count);
  const entries = await Promise.all(visible.map(async r => [r.uid, await getCachedUser(r.uid).catch(() => null)]));
  return new Map(entries);
}

function avatarMarkup(profile, fallbackName) {
  const name = profile?.name || fallbackName || 'Trio member';
  return profile?.photoURL ? '<img src="' + esc(profile.photoURL) + '" alt="" loading="lazy">' : '<span class="challenge-voter-initial">' + esc(name.charAt(0).toUpperCase()) + '</span>';
}

async function updateChallengeCounter(challengeId, uid, choice) {
  const answerRef = doc(db, 'challengeAnswers', uid + '_' + challengeId);
  const statsRef = doc(db, 'challengeStats', challengeId);
  try {
    await runTransaction(db, async tx => {
      const [answerSnap, statsSnap] = await Promise.all([tx.get(answerRef), tx.get(statsRef)]);
      const previous = answerSnap.exists() ? Number(answerSnap.data()?.choice) : null;
      const current = statsSnap.exists() ? statsSnap.data() : {};
      const counts = Array.from({length: 5}, (_, i) => Math.max(0, Number(current['choice' + i]) || 0));
      let total = Math.max(0, Number(current.total) || 0);
      if (previous !== choice) {
        if (Number.isInteger(previous) && counts[previous] > 0) counts[previous]--;
        if (!Number.isInteger(previous)) total++;
        counts[choice]++;
      }
      tx.set(statsRef, { total, choice0: counts[0], choice1: counts[1], choice2: counts[2], choice3: counts[3], choice4: counts[4], updatedAt: serverTimestamp(), updatedAtMs: Date.now() }, {merge:true});
      tx.set(answerRef, { challengeId, uid, choice, createdAt: serverTimestamp(), createdAtMs: Date.now() }, {merge:true});
    });
    return true;
  } catch (err) {
    console.warn('[Challenge] counter transaction unavailable', err);
    await setDoc(answerRef, { challengeId, uid, choice, createdAt: serverTimestamp(), createdAtMs: Date.now() }, {merge:true});
    return false;
  }
}

async function awardXpWithRetry(challengeId, user) {
  if (!user) return;
  const maxRetries = 2;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await import('./gamification/worker-config.js?v=20261003').then(m => m.workerPost('/gamification/award-xp', { meta: { challengeId } }, user));
      window.dispatchEvent(new CustomEvent('trio-xp-changed', { detail: { uid: user.uid } }));
      return;
    } catch (err) { if (attempt === maxRetries - 1) { setTimeout(() => awardXpWithRetry(challengeId, user), 5000); } }
  }
}

async function bumpStreakWithRetry(challengeId, user) {
  if (!user) return;
  const maxRetries = 2;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await import('./gamification/worker-config.js?v=20261003').then(m => m.workerPost('/gamification/bump-streak', { challengeId }, user));
      return;
    } catch (err) { if (attempt === maxRetries - 1) { setTimeout(() => bumpStreakWithRetry(challengeId, user), 5000); } }
  }
}

function attachDiscussion(c, discussion) {
  const feed = discussion.querySelector('.challenge-thread-feed');
  const input = discussion.querySelector('.challenge-thread-input');
  const send = discussion.querySelector('.challenge-thread-send');
  const count = discussion.querySelector('.challenge-thread-count');
  const empty = discussion.querySelector('.challenge-thread-empty');
  const threadQuery = query(collection(db,'challengeThreads',c.id,'messages'), orderBy('createdAtMs','desc'), limit(30));
  
  const unsub = onSnapshot(threadQuery, async snap => {
    const rows = snap.docs.map(d => ({id:d.id, ...d.data()}));
    feed.innerHTML = '';
    if (!rows.length) { empty.hidden = false; }
    else {
      empty.hidden = true;
      const [profiles, answers] = await Promise.all([
        Promise.all(rows.map(async m => [m.uid, await getCachedUser(m.uid).catch(() => null)])),
        getDocs(query(collection(db,'challengeAnswers'), where('challengeId','==',c.id)))
      ]);
      const profileMap = new Map(profiles);
      const answerMap = new Map(answers.docs.map(d => { const data = d.data(); return [data.uid, Number.isInteger(Number(data.choice)) ? c.o[Number(data.choice)] : '']; }));
      for (const m of rows) {
        const replies = await getThreadReplies(c.id, m.id);
        const node = await renderThreadMessage(m, c.id, profileMap.get(m.uid), answerMap.get(m.uid) || '', replies);
        feed.appendChild(node);
      }
    }
    count.textContent = rows.length ? rows.length + ' ' + (rows.length === 1 ? 'voice' : 'voices') : 'Be the first voice';
    feed.scrollTop = 0;
  });
  
  send.onclick = async () => {
    if (!currentUser) return;
    const text = input.value.trim();
    if (!text) return;
    if (text.length > 280) return showToast('Keep the message under 280 characters.', 'warn');
    send.disabled = true;
    try {
      const profileSnap = await getDoc(doc(db,'users',currentUser.uid));
      const profile = profileSnap.exists() ? profileSnap.data() : {};
      const answerSnap = await getDoc(doc(db,'challengeAnswers',currentUser.uid + '_' + c.id));
      const answer = answerSnap.exists() ? answerSnap.data() : {};
      const selectedChoice = Number(answer.choice);
      await addDoc(collection(db,'challengeThreads',c.id,'messages'), { uid: currentUser.uid, name: profile.name || currentUser.displayName || 'User', text, choice: Number.isInteger(selectedChoice) ? selectedChoice : null, choiceLabel: Number.isInteger(selectedChoice) ? (c.o[selectedChoice] || '') : '', createdAt: serverTimestamp(), createdAtMs: Date.now() });
      input.value = '';
    } catch (err) { console.error('challenge discussion send failed', err); showToast('Message could not be posted', 'error'); } finally { send.disabled = false; }
  };
  input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send.click(); } };
}

async function getThreadReplies(challengeId, messageId) {
  try {
    const snap = await getDocs(query(collection(db,'challengeThreads',challengeId,'messages',messageId,'replies'), orderBy('createdAtMs','asc'), limit(20)));
    return snap.docs.map(d => ({id:d.id, ...d.data()}));
  } catch (err) { console.warn('challenge replies unavailable', err); return []; }
}

async function renderThreadMessage(m, challengeId, profile = null, choiceLabel = '', replies = []) {
  const row = document.createElement('article');
  row.className = 'challenge-thread-message';
  const resolved = profile || {};
  const name = resolved.name || m.name || 'User';
  const avatar = resolved.photoURL ? '<img src="' + esc(resolved.photoURL) + '" alt="" loading="lazy">' : '<span class="challenge-thread-avatar-initial">' + esc(name.charAt(0).toUpperCase()) + '</span>';
  const mine = currentUser && m.uid === currentUser.uid;
  const answerChip = choiceLabel ? '<span class="challenge-thread-choice">' + esc(choiceLabel) + '</span>' : '';
  row.innerHTML = '<a class="challenge-thread-avatar" href="profile.html?uid=' + encodeURIComponent(m.uid || '') + '" aria-label="Open ' + esc(name) + ' profile">' + avatar + '</a><div class="challenge-thread-body">' + answerChip + '<div class="challenge-thread-meta"><a class="challenge-thread-author" href="profile.html?uid=' + encodeURIComponent(m.uid || '') + '">' + esc(name) + '</a><span>' + esc(formatTime(m.createdAtMs)) + '</span>' + (mine ? '<button type="button" class="thread-message-menu" aria-label="Message options">•••</button>' : '') + '</div><p>' + esc(m.text || '') + '</p><div class="challenge-thread-actions"><button type="button" class="challenge-thread-reply" data-reply>Reply</button>' + (replies.length ? '<span class="challenge-thread-reply-count">' + replies.length + ' ' + (replies.length === 1 ? 'reply' : 'replies') + '</span>' : '') + '</div><div class="challenge-thread-replies" data-replies>' + replies.map(reply => '<div class="challenge-thread-reply-row"><span class="challenge-thread-reply-name">' + esc(reply.name || 'User') + '</span><span class="challenge-thread-reply-text">' + esc(reply.text || '') + '</span></div>').join('') + '</div><div class="challenge-thread-reply-compose" data-reply-compose hidden><input maxlength="280" placeholder="Reply to ' + esc(name) + '"><button type="button" class="challenge-thread-reply-send">Send</button></div></div>';
  if (mine) { const menu = row.querySelector('.thread-message-menu'); menu.addEventListener('click', async () => { if (!confirm('Delete this comment?')) return; menu.disabled = true; try { await deleteDoc(doc(db, 'challengeThreads', challengeId, 'messages', m.id)); } catch (err) { console.error('comment delete failed', err); menu.disabled = false; alert('Could not delete the comment.'); } }); }
  const replyBtn = row.querySelector('[data-reply]');
  const replyCompose = row.querySelector('[data-reply-compose]');
  const replyInput = replyCompose.querySelector('input');
  const replySend = replyCompose.querySelector('button');
  replyBtn.addEventListener('click', () => { replyCompose.hidden = !replyCompose.hidden; if (!replyCompose.hidden) replyInput.focus(); });
  replySend.addEventListener('click', async () => { if (!currentUser) return; const text = replyInput.value.trim(); if (!text) return; replySend.disabled = true; try { const profileSnap = await getDoc(doc(db,'users',currentUser.uid)); const profile = profileSnap.exists() ? profileSnap.data() : {}; await addDoc(collection(db,'challengeThreads',challengeId,'messages',m.id,'replies'), { uid: currentUser.uid, name: profile.name || currentUser.displayName || 'User', text, createdAt: serverTimestamp(), createdAtMs: Date.now() }); replyInput.value = ''; replyCompose.hidden = true; } catch (err) { console.error('challenge reply failed', err); showToast('Reply could not be posted', 'error'); } finally { replySend.disabled = false; } });
  replyInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); replySend.click(); } });
  return row;
}

function formatTime(ms) { if (!ms) return ''; return new Date(ms).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }

onAuthStateChanged(auth, u => { currentUser = u; if (u) hydrateChallenge(currentChallenge); });
loadChallenge();