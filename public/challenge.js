import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, doc, getDocs, getDoc, query, where, orderBy, limit,
  setDoc, addDoc, deleteDoc, serverTimestamp, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { listCommunityTasks } from './gamification/community-tasks.js?v=20260919-community5';
import { workerPost } from './gamification/worker-config.js';
import { getCachedUser } from './services/userCache.js';

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

async function getResponses(id) {
  try {
    const snap = await getDocs(query(collection(db,'challengeAnswers'), where('challengeId','==',id)));
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  } catch (err) {
    console.warn('challenge responses unavailable', err);
    return [];
  }
}

function countsFromResponses(responses) {
  const counts = {};
  responses.forEach(r => {
    const n = Number(r.choice);
    if (Number.isInteger(n)) counts[n] = (counts[n] || 0) + 1;
  });
  return counts;
}

function renderAnswerCounts(card, c, counts) {
  // Keep choice controls clean. Counts belong in the visual community result,
  // not inside the answer labels.
  card.querySelectorAll('[data-choice]').forEach((x,i) => {
    const label = x.querySelector('span:last-child');
    if (label) label.textContent = c.o[i];
  });
}

function renderCommunityResult(result, c, counts, selectedChoice) {
  const total = Object.values(counts).reduce((a,b) => a + b, 0);
  const safeTotal = Math.max(1, total);
  const same = Number.isInteger(selectedChoice) ? (counts[selectedChoice] || 0) : 0;
  const enoughForPercent = total >= 5;
  const rows = c.o.map((label, index) => {
    const count = counts[index] || 0;
    const pct = Math.round((count / safeTotal) * 100);
    const value = enoughForPercent ? pct + '%' : count + (count === 1 ? ' person' : ' people');
    return '<div class="result-bar-row"><span class="result-bar-label">' + esc(label) + '</span><span class="result-track"><span class="result-fill" style="width:' + Math.max(2, pct) + '%"></span></span><span class="result-bar-value">' + value + '</span></div>';
  }).join('');
  result.hidden = false;
  result.innerHTML =
    '<div class="result-summary"><strong>' +
      (Number.isInteger(selectedChoice) ? same + ' ' + (same === 1 ? 'person' : 'people') + ' chose your answer' : 'Community choices') +
    '</strong><span>' +
      total + ' total response' + (total === 1 ? '' : 's') + (enoughForPercent ? ' · community split' : '') +
    '</span></div><div class="result-bars">' + rows + '</div>';
}

async function loadProfilesForPeople(people, count = 2) {
  const visible = people.slice(0, count);
  const entries = await Promise.all(visible.map(async r => [r.uid, await getCachedUser(r.uid).catch(() => null)]));
  return new Map(entries);
}

function avatarMarkup(profile, fallbackName) {
  const name = profile?.name || fallbackName || 'Trio member';
  return profile?.photoURL
    ? '<img src="' + esc(profile.photoURL) + '" alt="" loading="lazy">'
    : '<span class="challenge-voter-initial">' + esc(name.charAt(0).toUpperCase()) + '</span>';
}

function ensureVoterModal() {
  let modal = document.getElementById('challengeVoterModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'challengeVoterModal';
  modal.className = 'challenge-voter-modal';
  modal.hidden = true;
  modal.innerHTML =
    '<div class="challenge-voter-modal-backdrop" data-voter-close></div>' +
    '<section class="challenge-voter-modal-card" role="dialog" aria-modal="true" aria-labelledby="challengeVoterModalTitle">' +
      '<button type="button" class="challenge-voter-modal-close" data-voter-close aria-label="Close">×</button>' +
      '<div class="challenge-voter-modal-head"><div><span class="challenge-voter-modal-kicker">PEOPLE</span><h3 id="challengeVoterModalTitle">Who chose this?</h3><p id="challengeVoterModalMeta"></p></div></div>' +
      '<div id="challengeVoterModalList" class="challenge-voter-modal-list"></div>' +
      '<button type="button" id="challengeVoterLoadMore" class="challenge-voter-load-more" hidden>Load more</button>' +
    '</section>';
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-voter-close]').forEach(x => x.addEventListener('click', () => {
    modal.hidden = true;
  }));
  return modal;
}

async function openVoterModal(c, group, responses) {
  const modal = ensureVoterModal();
  const list = modal.querySelector('#challengeVoterModalList');
  const more = modal.querySelector('#challengeVoterLoadMore');
  const title = modal.querySelector('#challengeVoterModalTitle');
  const meta = modal.querySelector('#challengeVoterModalMeta');
  const people = responses.filter(r => Number(r.choice) === group.index);
  let loaded = 0;
  const batch = 12;
  const cache = new Map();

  title.textContent = group.label;
  meta.textContent = people.length + ' ' + (people.length === 1 ? 'person' : 'people') + ' chose this';
  list.innerHTML = '<div class="challenge-voter-loading">Loading people…</div>';
  modal.hidden = false;

  async function renderBatch() {
    const slice = people.slice(loaded, loaded + batch);
    const profiles = await loadProfilesForPeople(slice, slice.length);
    slice.forEach(r => cache.set(r.uid, profiles.get(r.uid) || null));
    const html = slice.map(r => {
      const u = cache.get(r.uid) || {};
      const name = u.name || 'Trio member';
      return '<a class="challenge-voter-modal-row" href="profile.html?uid=' + encodeURIComponent(r.uid || '') + '">' +
        '<span class="challenge-voter-modal-avatar">' + avatarMarkup(u, name) + '</span>' +
        '<span class="challenge-voter-modal-name">' + esc(name) + '</span><span class="challenge-voter-modal-arrow">↗</span>' +
      '</a>';
    }).join('');
    if (loaded === 0) list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', html);
    loaded += slice.length;
    more.hidden = loaded >= people.length;
  }

  more.onclick = renderBatch;
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && loaded < people.length) renderBatch();
  }, { root: list, rootMargin: '80px' });
  observer.observe(more);
  modal.querySelector('[data-voter-close]').addEventListener('click', () => observer.disconnect(), { once: true });
  await renderBatch();
}

async function renderVoterPeek(result, c, responses) {
  const grouped = c.o.map((label, index) => ({
    label,
    index,
    people: responses.filter(r => Number(r.choice) === index)
  }));

  const rows = await Promise.all(grouped.map(async group => {
    if (!group.people.length) {
      return '<div class="result-voter-row result-voter-row--empty"><span class="result-bar-label">' + esc(group.label) + '</span><span class="result-voter-count">0</span></div>';
    }
    const profiles = await loadProfilesForPeople(group.people, 2);
    const peeks = group.people.slice(0, 2).map(r => {
      const u = profiles.get(r.uid) || {};
      const name = u.name || 'Trio member';
      return '<button type="button" class="result-voter-avatar-btn" data-voter-option="' + group.index + '" aria-label="See who chose ' + esc(group.label) + '">' +
        '<span class="result-voter-avatar">' + avatarMarkup(u, name) + '</span></button>';
    }).join('');
    const more = group.people.length > 2
      ? '<button type="button" class="result-voter-more" data-voter-option="' + group.index + '">+' + (group.people.length - 2) + '</button>'
      : '';
    return '<div class="result-voter-row"><span class="result-bar-label">' + esc(group.label) + '</span><span class="result-voter-peek">' + peeks + more + '</span><button type="button" class="result-voter-open" data-voter-option="' + group.index + '">' + group.people.length + '</button></div>';
  }));

  result.insertAdjacentHTML('beforeend',
    '<div class="result-voters-head"><strong>Who chose what</strong><span>Tap the small people dots to see names.</span></div>' +
    '<div class="result-voters">' + rows.join('') + '</div>'
  );

  result.querySelectorAll('[data-voter-option]').forEach(btn => btn.addEventListener('click', () => {
    const index = Number(btn.dataset.voterOption);
    openVoterModal(c, grouped[index], responses);
  }));
}
function formatTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function creatorMeta(c) {
  const creatorUid = c.creatorUid || '';
  const creatorName = c.creatorName || 'Admin';
  const role = c.creatorRole || (creatorUid ? 'Member' : 'Admin');
  const safeName = esc(creatorName);
  const roleHtml = '<span class="challenge-creator-role">' + esc(role) + '</span>';
  const nameHtml = creatorUid
    ? '<a class="challenge-creator-name" href="profile.html?uid=' + encodeURIComponent(creatorUid) + '">' + safeName + '</a>'
    : '<span class="challenge-creator-name">' + safeName + '</span>';
  return '<div class="challenge-creator">' +
    '<span class="challenge-creator-label">by</span>' + nameHtml + roleHtml +
    '</div>';
}

function renderThreadMessage(m, challengeId) {
  const row = document.createElement('article');
  row.className = 'challenge-thread-message';
  const initial = (m.name || 'U').charAt(0).toUpperCase();
  const mine = currentUser && m.uid === currentUser.uid;
  row.innerHTML =
    '<div class="challenge-thread-avatar">' + esc(initial) + '</div>' +
    '<div class="challenge-thread-body">' +
      '<div class="challenge-thread-meta"><strong>' + esc(m.name || 'User') + '</strong><span>' + esc(formatTime(m.createdAtMs)) + '</span>' +
      (mine ? '<button type="button" class="thread-message-menu" aria-label="Message options">•••</button>' : '') +
      '</div>' +
      '<p>' + esc(m.text || '') + '</p>' +
    '</div>';
  if (mine) {
    const menu = row.querySelector('.thread-message-menu');
    menu.addEventListener('click', async () => {
      if (!confirm('Delete this comment?')) return;
      menu.disabled = true;
      try {
        await deleteDoc(doc(db, 'challengeThreads', challengeId, 'messages', m.id));
      } catch (err) {
        console.error('comment delete failed', err);
        menu.disabled = false;
        alert('Could not delete the comment.');
      }
    });
  }
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
      rows.forEach(m => feed.appendChild(renderThreadMessage(m, c.id)));
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

  const formatLabels = {quick:'⚡ QUICK PICK',rather:'↔ WOULD YOU',hot:'🔥 HOT TAKE',scenario:'✦ SCENARIO'};
  const format = c.format || 'quick';
  const twist = c.twist || '';
  card.innerHTML =
    '<div class="challenge-moment-head"><span class="challenge-tag">' + esc(c.tag || 'COMMUNITY') + '</span><span class="challenge-format">' + esc(formatLabels[format] || '⚡ QUICK PICK') + '</span></div>' +
    '<h2>' + esc(c.q) + '</h2>' +
    (twist ? '<div class="challenge-twist">✦ ' + esc(twist) + '</div>' : '') +
    '<div class="challenge-no-right">No right answer · pick your side</div>' +
    creatorMeta(c) +
    '<div class="challenge-main-options">' +
      c.o.map((x,i) => '<button type="button" data-choice="' + i + '"><span class="choice-letter">' + String.fromCharCode(65+i) + '</span><span>' + esc(x) + '</span></button>').join('') +
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
          await workerPost('/gamification/bump-streak', { challengeId: c.id }, gamificationUser);
          window.dispatchEvent(new CustomEvent('trio-xp-changed', { detail: { uid: gamificationUser.uid } }));
        }
      } catch (gamErr) {
        console.warn('[Challenge] gamification sync failed:', gamErr);
      }

      card.querySelectorAll('[data-choice]').forEach(x => {
        x.disabled = false;
        x.classList.toggle('is-selected', Number(x.dataset.choice) === choice);
      });
      const responses = await getResponses(c.id);
      const counts = countsFromResponses(responses);
      renderCommunityResult(result, c, counts, choice);
      renderAnswerCounts(card, c, counts);
      await renderVoterPeek(result, c, responses);
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
  for (const [id,{card,c,result}] of cards) {
    const responses = await getResponses(id);
    const counts = countsFromResponses(responses);
    renderAnswerCounts(card,c,counts);
    await renderVoterPeek(result, c, responses);
    const mySnap = currentUser ? await getDoc(doc(db,'challengeAnswers',currentUser.uid + '_' + id)).catch(() => null) : null;
    if (mySnap?.exists()) {
      const myChoice = Number(mySnap.data().choice);
      card.querySelectorAll('[data-choice]').forEach((x,i) => x.disabled = false);
      card.querySelectorAll('[data-choice]').forEach((x,i) => x.classList.toggle('is-selected', i === myChoice));
      renderCommunityResult(result, c, counts, myChoice);
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
      host.appendChild(heading);
      custom.forEach(t => addCard({
        id:t.id,
        tag:'COMMUNITY',
        q:t.interaction.question,
        o:t.interaction.options,
        creatorUid:t.creatorUid || '',
        creatorName:t.creatorName || 'Admin',
        creatorRole:t.creatorRole || (t.creatorUid ? 'Member' : 'Admin'),
        format:t.interaction.format || 'quick',
        twist:t.interaction.twist || ''
      }, requestedId === t.id));
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
CHALLENGES.forEach(c => addCard({
  ...c,
  creatorName:'Admin',
  creatorRole:'Admin',
  creatorUid:''
}, requestedId === c.id));
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
