import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, doc, getDocs, getDoc, query, where, orderBy, limit,
  setDoc, addDoc, serverTimestamp, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { listCommunityTasks } from './gamification/community-tasks.js?v=20260919-community5';
import { workerPost } from './gamification/worker-config.js';

const CHALLENGES = [
  {id:'trip', tag:'CHOICE', q:'You get one free trip tomorrow. Where are you going?', o:['Japan 🇯🇵','Switzerland 🇨🇭','Somewhere unexpected 🌍']},
  {id:'hour', tag:'MOOD', q:'You have one free hour tonight. What sounds better?', o:['Talk to someone 💬','Play something 🎮','Learn something 🧠']},
  {id:'weekend', tag:'MAKE', q:'You have one weekend to make something. What do you pick?', o:['An app 💻','A game 🎮','Something useful 🛠️']},
  {id:'food', tag:'LIFE', q:'Pick one forever.', o:['Street food 🌮','Home food 🍲','Restaurant food 🍽️']}
];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const host = document.getElementById('challengeList');
let currentUser = null;
const cards = new Map();
const threadUnsubs = new Map();

async function getCounts(id) {
  try {
    const snap = await getDocs(query(collection(db,'challengeAnswers'), where('challengeId','==',id)));
    const counts = {};
    snap.forEach(d => {
      const n = Number(d.data().choice);
      if (Number.isInteger(n)) counts[n] = (counts[n] || 0) + 1;
    });
    return counts;
  } catch (err) {
    console.warn('challenge counts unavailable', err);
    return {};
  }
}

function renderAnswerCounts(card, c, counts) {
  card.querySelectorAll('[data-choice]').forEach((x,i) => {
    x.textContent = c.o[i] + (counts[i] ? ' · ' + counts[i] : '');
  });
}

function formatTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function renderThreadMessage(m) {
  const row = document.createElement('article');
  row.className = 'challenge-thread-message';
  const initial = (m.name || 'U').charAt(0).toUpperCase();
  row.innerHTML =
    '<div class="challenge-thread-avatar">' + esc(initial) + '</div>' +
    '<div class="challenge-thread-body">' +
      '<div class="challenge-thread-meta"><strong>' + esc(m.name || 'User') + '</strong><span>' + esc(formatTime(m.createdAtMs)) + '</span></div>' +
      '<p>' + esc(m.text || '') + '</p>' +
    '</div>';
  return row;
}

function attachDiscussion(c, card, discussion) {
  const feed = discussion.querySelector('.challenge-thread-feed');
  const input = discussion.querySelector('.challenge-thread-input');
  const send = discussion.querySelector('.challenge-thread-send');
  const count = discussion.querySelector('.challenge-thread-count');
  const empty = discussion.querySelector('.challenge-thread-empty');
  const threadQuery = query(
    collection(db,'challengeThreads',c.id,'messages'),
    orderBy('createdAtMs','desc'),
    limit(30)
  );

  const oldUnsub = threadUnsubs.get(c.id);
  if (oldUnsub) oldUnsub();

  const unsub = onSnapshot(threadQuery, snap => {
    const rows = snap.docs.map(d => ({id:d.id, ...d.data()})).reverse();
    feed.innerHTML = '';
    if (!rows.length) {
      empty.hidden = false;
    } else {
      empty.hidden = true;
      rows.forEach(m => feed.appendChild(renderThreadMessage(m)));
    }
    count.textContent = rows.length ? rows.length + ' voices' : 'Be the first voice';
    feed.scrollTop = feed.scrollHeight;
  }, err => {
    console.warn('challenge discussion unavailable', err);
    empty.hidden = false;
    empty.textContent = 'Discussion is temporarily unavailable.';
  });
  threadUnsubs.set(c.id, unsub);

  send.onclick = async () => {
    if (!currentUser) return;
    const text = input.value.trim();
    if (!text) return;
    if (text.length > 280) return alert('Keep the message under 280 characters.');
    send.disabled = true;
    try {
      const profileSnap = await getDoc(doc(db,'users',currentUser.uid));
      const profile = profileSnap.exists() ? profileSnap.data() : {};
      await addDoc(collection(db,'challengeThreads',c.id,'messages'), {
        uid: currentUser.uid,
        name: profile.name || currentUser.displayName || 'User',
        text,
        createdAt: serverTimestamp(),
        createdAtMs: Date.now()
      });
      input.value = '';
    } catch (err) {
      console.error('challenge discussion send failed', err);
      alert('Message could not be posted.');
    } finally {
      send.disabled = false;
    }
  };
  input.onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send.click();
    }
  };
}

function addCard(c, autoOpen = false) {
  const card = document.createElement('article');
  card.className = 'challenge-main-card';
  card.dataset.challengeId = c.id;
  const currentIndex = CHALLENGES.findIndex(x => x.id === c.id);
  const nextChallenge = currentIndex >= 0
    ? CHALLENGES[(currentIndex + 1) % CHALLENGES.length]
    : CHALLENGES[0];

  card.innerHTML =
    '<span class="challenge-tag">' + esc(c.tag || 'COMMUNITY') + '</span>' +
    '<h2>' + esc(c.q) + '</h2>' +
    '<div class="challenge-main-options">' +
      c.o.map((x,i) => '<button type="button" data-choice="' + i + '">' + esc(x) + '</button>').join('') +
    '</div>' +
    '<div class="challenge-result" hidden></div>' +
    '<div class="challenge-links">' +
      '<button type="button" class="nkm-btn nkm-btn--secondary challenge-discuss-btn">💬 Join the discussion</button>' +
      '<a class="nkm-btn nkm-btn--primary" href="challenge.html?challenge=' + encodeURIComponent(nextChallenge.id) + '">Next Challenge →</a>' +
    '</div>' +
    '<section class="challenge-thread" hidden aria-label="Public challenge discussion">' +
      '<div class="challenge-thread-head"><div><strong>Open discussion</strong><span>Everyone answering this challenge can join.</span></div><span class="challenge-thread-count">Be the first voice</span></div>' +
      '<div class="challenge-thread-feed"></div>' +
      '<div class="challenge-thread-empty">No one has said their piece yet. Start the debate.</div>' +
      '<div class="challenge-thread-compose"><input class="challenge-thread-input" maxlength="280" placeholder="Why did you pick that?"><button type="button" class="nkm-btn nkm-btn--primary challenge-thread-send">Send</button></div>' +
    '</section>';

  const result = card.querySelector('.challenge-result');
  const discussion = card.querySelector('.challenge-thread');
  const discussBtn = card.querySelector('.challenge-discuss-btn');
  cards.set(c.id, {card, result, discussion, c});

  card.querySelectorAll('[data-choice]').forEach(btn => btn.addEventListener('click', async () => {
    if (!currentUser) return;
    const choice = Number(btn.dataset.choice);
    try {
      await setDoc(doc(db,'challengeAnswers',currentUser.uid + '_' + c.id), {
        challengeId:c.id, uid:currentUser.uid, choice,
        createdAt:serverTimestamp(), createdAtMs:Date.now()
      }, {merge:true});
      localStorage.setItem('trio_last_challenge', JSON.stringify({id:c.id,choice,at:Date.now()}));
      try {
        const gamificationUser = auth.currentUser;
        if (gamificationUser) {
          await workerPost('/gamification/award-xp', { meta: { challengeId: c.id } }, gamificationUser);
          await workerPost('/gamification/bump-streak', {}, gamificationUser);
          window.dispatchEvent(new CustomEvent('trio-xp-changed', { detail: { uid: gamificationUser.uid } }));
        }
      } catch (gamErr) {
        console.warn('[Challenge] gamification sync failed:', gamErr);
      }

      card.querySelectorAll('[data-choice]').forEach(x => x.disabled = true);
      const counts = await getCounts(c.id);
      const total = Object.values(counts).reduce((a,b) => a+b, 0);
      const same = counts[choice] || 1;
      result.hidden = false;
      result.innerHTML = '<strong>' + same + ' people</strong> chose this answer · ' + total + ' total response' + (total === 1 ? '' : 's');
      renderAnswerCounts(card, c, counts);
      discussion.hidden = false;
      discussBtn.textContent = '💬 Discussion open';
      inputFocusIfNeeded(discussion);
    } catch (err) {
      console.error(err);
      result.hidden = false;
      result.textContent = 'Could not save your answer. Please try again.';
    }
  }));

  discussBtn.addEventListener('click', () => {
    discussion.hidden = !discussion.hidden;
    discussBtn.textContent = discussion.hidden ? '💬 Join the discussion' : '💬 Discussion open';
    if (!discussion.hidden) {
      attachDiscussion(c, card, discussion);
      inputFocusIfNeeded(discussion);
    }
  });

  if (autoOpen) {
    discussion.hidden = false;
    attachDiscussion(c, card, discussion);
    setTimeout(() => card.scrollIntoView({behavior:'smooth', block:'center'}), 60);
  }

  host?.appendChild(card);
}

function inputFocusIfNeeded(discussion) {
  setTimeout(() => discussion.querySelector('.challenge-thread-input')?.focus(), 80);
}

async function hydrateCounts() {
  for (const [id,{card,c}] of cards) {
    const counts = await getCounts(id);
    renderAnswerCounts(card,c,counts);
    const mySnap = currentUser ? await getDoc(doc(db,'challengeAnswers',currentUser.uid + '_' + id)).catch(() => null) : null;
    if (mySnap?.exists()) {
      const myChoice = Number(mySnap.data().choice);
      card.querySelectorAll('[data-choice]').forEach((x,i) => x.disabled = true);
      const result = card.querySelector('.challenge-result');
      if (result) {
        const total = Object.values(counts).reduce((a,b) => a+b, 0);
        result.hidden = false;
        result.innerHTML = '<strong>' + (counts[myChoice] || 1) + ' people</strong> chose this answer · ' + total + ' total response' + (total === 1 ? '' : 's');
      }
    }
  }
}

async function loadCommunityChallenges() {
  if (!host) return;
  try {
    const tasks = await listCommunityTasks({kind:'challenge',status:'active',max:12});
    const custom = tasks.filter(t => t.interaction?.kind === 'choice' && t.interaction?.question && Array.isArray(t.interaction?.options));
    if (custom.length) {
      const heading = document.createElement('div');
      heading.className = 'challenge-community-heading';
      heading.innerHTML = '<span class="challenge-tag">COMMUNITY</span><h2>Questions from people</h2><p>Real prompts created by the community. Pick, compare and talk in public.</p>';
      host.prepend(heading);
      custom.forEach(t => addCard({id:t.id,tag:'COMMUNITY',q:t.interaction.question,o:t.interaction.options}, requestedId === t.id));
    }
    await hydrateCounts();
  } catch (err) {
    console.warn('community challenges unavailable', err);
  }
}

onAuthStateChanged(auth, u => {
  currentUser = u;
  if (u) hydrateCounts();
});

const requestedId = new URLSearchParams(location.search).get('challenge') || new URLSearchParams(location.search).get('id');
CHALLENGES.forEach(c => addCard(c, requestedId === c.id));
loadCommunityChallenges().then(() => {
  if (requestedId && cards.has(requestedId)) return;
  if (requestedId) {
    const match = [...cards.values()].find(x => x.c.id === requestedId);
    if (match) {
      match.discussion.hidden = false;
      attachDiscussion(match.c, match.card, match.discussion);
      setTimeout(() => match.card.scrollIntoView({behavior:'smooth', block:'center'}), 80);
    }
  }
});
