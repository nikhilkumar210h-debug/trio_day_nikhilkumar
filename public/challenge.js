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

const CHALLENGES = [
  {id:'trip', category:'Life', tag:'CHOICE', q:'You get one free trip tomorrow. Where are you going?', o:['Japan 🇯🇵','Switzerland 🇨🇭','Somewhere unexpected 🌍'], createdAtMs:1790121600000},
  {id:'hour', category:'Fun', tag:'MOOD', q:'You have one free hour tonight. What sounds better?', o:['Talk to someone 💬','Play something 🎮','Learn something 🧠'], createdAtMs:1790035200000},
  {id:'weekend', category:'Tech', tag:'MAKE', q:'You have one weekend to make something. What do you pick?', o:['An app 💻','A game 🎮','Something useful 🛠️'], createdAtMs:1789948800000},
  {id:'food', category:'Life', tag:'LIFE', q:'Pick one forever.', o:['Street food 🌮','Home food 🍲','Restaurant food 🍽️'], createdAtMs:1789862400000},
  {id:'study-reset', category:'Study', tag:'STUDY', q:'You have 30 minutes before an important test. What do you do?', o:['Review notes 📚','Solve questions ✍️','Take a short reset 🧠'], createdAtMs:1789776000000},
  {id:'career-path', category:'Career', tag:'CAREER', q:'You can try one career skill for a month. Which one?', o:['Build projects 💻','Communicate better 🎤','Analyze data 📊'], createdAtMs:1789689600000},
  {id:'college-day', category:'College', tag:'CAMPUS', q:'Your ideal free hour on campus looks like what?', o:['Club activity 🎯','Friends & chai ☕','Quiet study 📖'], createdAtMs:1789603200000},
  {id:'debug', category:'Tech', tag:'TECH', q:'Your code works but you do not know why. What is your next move?', o:['Read the docs 📘','Add small tests 🧪','Inspect it step by step 🔎'], createdAtMs:1789516800000},
  {id:'weekend-plan', category:'Life', tag:'LIFE', q:'A completely free Sunday appears. What wins?', o:['Go outside 🌤️','Build something 🛠️','Stay in and recharge 🎧'], createdAtMs:1789430400000},
  {id:'movie-night', category:'Fun', tag:'FUN', q:'Pick the movie-night rule.', o:['One person chooses 🎬','Everyone votes 🗳️','Random pick 🎲'], createdAtMs:1789344000000},
  {id:'helping-hand', category:'Community', tag:'COMMUNITY', q:'Someone in your group is stuck. What help matters first?', o:['Explain the idea 💡','Do it together 🤝','Point them to a resource 🔗'], createdAtMs:1789257600000},
  {id:'first-step', category:'Career', tag:'CAREER', q:'You want to start a big goal today. What is the first move?', o:['Make a tiny plan 📝','Start immediately ⚡','Find someone to learn from 👥'], createdAtMs:1789171200000},
  {id:'focus-mode', category:'Study', tag:'STUDY', q:'What helps you protect a focused study session?', o:['Phone away 📵','Timed blocks ⏱️','Study with someone 👥'], createdAtMs:1789084800000},
  {id:'build-vs-watch', category:'Tech', tag:'TECH', q:'You have one evening for tech. What sounds better?', o:['Build a mini tool 🔧','Learn a new concept 🧠','Explore a cool project 🔍'], createdAtMs:1788998400000},
  {id:'small-kindness', category:'Community', tag:'COMMUNITY', q:'What small action makes a group feel better?', o:['Welcome someone 👋','Share credit 🙌','Help without being asked ❤️'], createdAtMs:1788912000000},
  {id:'choose-fast', category:'Fun', tag:'QUICK PICK', q:'Your friends give you three spontaneous plans. What do you choose?', o:['Food hunt 🍜','Game night 🎮','Random walk 🚶'], createdAtMs:1788825600000}
];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const host = document.getElementById('challengeList');
let currentUser = null;
const cards = new Map();
const CHALLENGE_CATEGORIES = ['All','Career','Study','College','Tech','Life','Fun','Community'];
const shareChallengeUrl = c => new URL('challenge.html?id=' + encodeURIComponent(c.id), location.href).href;
const threadUnsubs = new Map();
let answeredChallengeIds = null;
let answeredChallengesPromise = null;

async function getResponses(id) {
  try {
    const snap = await getDocs(query(collection(db,'challengeAnswers'), where('challengeId','==',id)));
    return snap.docs.map(d => ({ id:d.id, ...d.data() }))
      .sort((a,b) => (Number(b.createdAtMs)||0) - (Number(a.createdAtMs)||0));
  } catch (err) {
    console.warn('challenge responses unavailable', err);
    return [];
  }
}

async function getResponseCount(id) {
  if (!id) return 0;
  const cacheKey = 'challenge_response_count_' + id;
  try {
    const snap = await getCountFromServer(query(collection(db, 'challengeAnswers'), where('challengeId', '==', id)));
    return Number(snap.data().count) || 0;
  } catch (_) {
    return 0;
  }
}

async function getAnsweredChallengeIds() {
  if (!currentUser) return new Set();
  if (answeredChallengeIds) return answeredChallengeIds;
  if (answeredChallengesPromise) return answeredChallengesPromise;
  answeredChallengesPromise = getDocs(query(
    collection(db, 'challengeAnswers'),
    where('uid', '==', currentUser.uid),
    limit(100)
  )).then(snap => {
    answeredChallengeIds = new Set(snap.docs.map(d => String(d.data()?.challengeId || d.id.split('_').slice(1).join('_'))).filter(Boolean));
    return answeredChallengeIds;
  }).catch(() => {
    answeredChallengeIds = new Set();
    return answeredChallengeIds;
  }).finally(() => { answeredChallengesPromise = null; });
  return answeredChallengesPromise;
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
    const value = pct + '% · ' + count + (count === 1 ? ' person' : ' people');
    return '<div class="result-bar-row" data-result-option="' + index + '">' +
      '<span class="result-bar-label">' + esc(label) + '</span>' +
      '<span class="result-track"><span class="result-fill" style="width:' + Math.max(2, pct) + '%"></span></span>' +
      '<span class="result-voter-slot" aria-label="People who chose this option"></span>' +
      '<span class="result-bar-value">' + value + '</span>' +
    '</div>';
  }).join('');
  result.innerHTML =
    '<div class="result-summary"><strong>' +
      (Number.isInteger(selectedChoice) ? same + ' ' + (same === 1 ? 'person' : 'people') + ' chose your answer' : 'Community choices') +
    '</strong><span>' +
      total + ' total response' + (total === 1 ? '' : 's') + (enoughForPercent ? ' · community split' : '') +
    '</span></div><div class="result-bars">' + rows + '</div>';
  result.hidden = true;
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
      tx.set(statsRef, {
        total,
        choice0: counts[0], choice1: counts[1], choice2: counts[2], choice3: counts[3], choice4: counts[4],
        updatedAt: serverTimestamp(), updatedAtMs: Date.now()
      }, {merge:true});
      tx.set(answerRef, {challengeId, uid, choice, createdAt: serverTimestamp(), createdAtMs: Date.now()}, {merge:true});
    });
    return true;
  } catch (err) {
    console.warn('[Challenge] counter transaction unavailable; falling back to answer write', err);
    await setDoc(answerRef, {challengeId, uid, choice, createdAt: serverTimestamp(), createdAtMs: Date.now()}, {merge:true});
    return false;
  }
}

async function shareChallenge(c) {
  const url = shareChallengeUrl(c);
  const shareInternal = () => {
    try {
      sessionStorage.setItem('trio_pending_challenge_share', JSON.stringify({
        id: c.id, q: c.q, o: c.o, url
      }));
    } catch {}
    location.href = 'chat.html?shareChallenge=1';
  };

  const choice = window.prompt('Share this Challenge:\n1 = Share in Trio Day Chat\n2 = Share link / system share', '1');
  if (choice === '1') return shareInternal();
  if (choice !== '2') return;

  try {
    if (navigator.share) {
      await navigator.share({title:'Trio Day Challenge', text:c.q, url});
      return;
    }
    await navigator.clipboard.writeText(url);
    alert('Challenge link copied ✓');
  } catch (err) {
    if (err?.name !== 'AbortError') {
      try { await navigator.clipboard.writeText(url); alert('Challenge link copied ✓'); } catch {}
    }
  }
}


async function renderResultPreview(preview, c, responses) {
  const latest = responses.slice(0, 2);
  const responseCount = await getResponseCount(c.id);
  const avatars = await loadProfilesForPeople(latest, latest.length);
  preview.innerHTML =
    '<span class="challenge-result-preview-label">' + responseCount + ' ' + (responseCount === 1 ? 'response' : 'responses') + '</span>' +
    '<span class="challenge-result-preview-avatars">' +
      latest.map(r => {
        const u = avatars.get(r.uid) || {};
        const name = u.name || 'Trio member';
        return '<span class="challenge-result-preview-avatar" title="' + esc(name) + '">' + avatarMarkup(u, name) + '</span>';
      }).join('') +
    '</span>' +
    '<span class="challenge-result-preview-arrow">⌄</span>';
  preview.hidden = false;
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
  const people = responses.filter(r => Number(r.choice) === group.index)
    .sort((a,b) => (Number(b.createdAtMs)||0) - (Number(a.createdAtMs)||0));
  let loaded = 0;
  const batch = 12;
  const cache = new Map();

  title.textContent = group.label;
  meta.textContent = people.length + ' ' + (people.length === 1 ? 'person' : 'people') + ' chose this';
  list.innerHTML = '<div class="challenge-voter-loading">Loading people…</div>';
  modal.hidden = false;

  let loading = false;
  async function renderBatch() {
    if (loading || loaded >= people.length) return;
    loading = true;
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
    loading = false;
  }

  more.onclick = renderBatch;
  list.addEventListener('scroll', () => {
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 70) renderBatch();
  });
  await renderBatch();
}

async function renderVoterPeek(result, c, responses) {
  const grouped = c.o.map((label, index) => ({
    label,
    index,
    people: responses.filter(r => Number(r.choice) === index)
  }));

  const rows = await Promise.all(grouped.map(async group => {
    const row = result.querySelector('[data-result-option="' + group.index + '"] .result-voter-slot');
    if (!row) return;
    if (!group.people.length) {
      row.innerHTML = '';
      return;
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

    row.innerHTML = '<span class="result-voter-peek">' + peeks + more + '</span>';
  }));

  await Promise.all(rows);

  result.querySelectorAll('[data-voter-option]').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.voterOption);
      openVoterModal(c, grouped[index], responses);
    });
  });
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

async function renderThreadMessage(m, challengeId, profile = null, choiceLabel = '', replies = []) {
  const row = document.createElement('article');
  row.className = 'challenge-thread-message';
  const resolved = profile || {};
  const name = resolved.name || m.name || 'User';
  const avatar = resolved.photoURL
    ? '<img src="' + esc(resolved.photoURL) + '" alt="" loading="lazy">'
    : '<span class="challenge-thread-avatar-initial">' + esc(name.charAt(0).toUpperCase()) + '</span>';
  const mine = currentUser && m.uid === currentUser.uid;
  const answerChip = choiceLabel
    ? '<span class="challenge-thread-choice">' + esc(choiceLabel) + '</span>'
    : '';
  row.innerHTML =
    '<a class="challenge-thread-avatar" href="profile.html?uid=' + encodeURIComponent(m.uid || '') + '" aria-label="Open ' + esc(name) + ' profile">' + avatar + '</a>' +
    '<div class="challenge-thread-body">' +
      answerChip +
      '<div class="challenge-thread-meta"><a class="challenge-thread-author" href="profile.html?uid=' + encodeURIComponent(m.uid || '') + '">' + esc(name) + '</a><span>' + esc(formatTime(m.createdAtMs)) + '</span>' +
      (mine ? '<button type="button" class="thread-message-menu" aria-label="Message options">•••</button>' : '') +
      '</div>' +
      '<p>' + esc(m.text || '') + '</p>' +
      '<div class="challenge-thread-actions"><button type="button" class="challenge-thread-reply" data-reply>Reply</button>' +
        (replies.length ? '<span class="challenge-thread-reply-count">' + replies.length + ' ' + (replies.length === 1 ? 'reply' : 'replies') + '</span>' : '') +
      '</div>' +
      '<div class="challenge-thread-replies" data-replies>' +
        replies.map(reply => '<div class="challenge-thread-reply-row"><span class="challenge-thread-reply-name">' + esc(reply.name || 'User') + '</span><span class="challenge-thread-reply-text">' + esc(reply.text || '') + '</span></div>').join('') +
      '</div>' +
      '<div class="challenge-thread-reply-compose" data-reply-compose hidden><input maxlength="280" placeholder="Reply to ' + esc(name) + '"><button type="button" class="challenge-thread-reply-send">Send</button></div>' +
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
  const replyBtn = row.querySelector('[data-reply]');
  const replyCompose = row.querySelector('[data-reply-compose]');
  const replyInput = replyCompose.querySelector('input');
  const replySend = replyCompose.querySelector('button');
  replyBtn.addEventListener('click', () => {
    replyCompose.hidden = !replyCompose.hidden;
    if (!replyCompose.hidden) replyInput.focus();
  });
  replySend.addEventListener('click', async () => {
    if (!currentUser) return;
    const text = replyInput.value.trim();
    if (!text) return;
    replySend.disabled = true;
    try {
      const profileSnap = await getDoc(doc(db,'users',currentUser.uid));
      const profile = profileSnap.exists() ? profileSnap.data() : {};
      await addDoc(collection(db,'challengeThreads',challengeId,'messages',m.id,'replies'), {
        uid: currentUser.uid,
        name: profile.name || currentUser.displayName || 'User',
        text,
        createdAt: serverTimestamp(),
        createdAtMs: Date.now()
      });
      replyInput.value = '';
      replyCompose.hidden = true;
    } catch (err) {
      console.error('challenge reply failed', err);
      alert('Reply could not be posted.');
    } finally {
      replySend.disabled = false;
    }
  });
  replyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      replySend.click();
    }
  });
  return row;
}

async function getThreadReplies(challengeId, messageId) {
  try {
    const snap = await getDocs(query(
      collection(db,'challengeThreads',challengeId,'messages',messageId,'replies'),
      orderBy('createdAtMs','asc'),
      limit(20)
    ));
    return snap.docs.map(d => ({id:d.id, ...d.data()}));
  } catch (err) {
    console.warn('challenge replies unavailable', err);
    return [];
  }
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

  const renderedIds = new Set();
  const unsub = onSnapshot(threadQuery, async snap => {
    const rows = snap.docs.map(d => ({id:d.id, ...d.data()}));
    feed.innerHTML = '';
    renderedIds.clear();
    if (!rows.length) {
      empty.hidden = false;
    } else {
      empty.hidden = true;
      const [profiles, answers] = await Promise.all([
        Promise.all(rows.map(async m => [m.uid, await getCachedUser(m.uid).catch(() => null)])),
        getDocs(query(collection(db,'challengeAnswers'), where('challengeId','==',c.id)))
      ]);
      const profileMap = new Map(profiles);
      const answerMap = new Map(answers.docs.map(d => {
        const data = d.data();
        return [data.uid, Number.isInteger(Number(data.choice)) ? c.o[Number(data.choice)] : ''];
      }));
      for (const m of rows) {
        if (renderedIds.has(m.id)) continue;
        renderedIds.add(m.id);
        const replies = await getThreadReplies(c.id, m.id);
        const node = await renderThreadMessage(m, c.id, profileMap.get(m.uid), answerMap.get(m.uid) || '', replies);
        feed.appendChild(node);
      }
    }
    count.textContent = rows.length ? rows.length + ' ' + (rows.length === 1 ? 'voice' : 'voices') : 'Be the first voice';
    feed.scrollTop = 0;
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
      const answerSnap = await getDoc(doc(db,'challengeAnswers',currentUser.uid + '_' + c.id));
      const answer = answerSnap.exists() ? answerSnap.data() : {};
      const selectedChoice = Number(answer.choice);
      await addDoc(collection(db,'challengeThreads',c.id,'messages'), {
        uid: currentUser.uid,
        name: profile.name || currentUser.displayName || 'User',
        text,
        choice: Number.isInteger(selectedChoice) ? selectedChoice : null,
        choiceLabel: Number.isInteger(selectedChoice) ? (c.o[selectedChoice] || '') : '',
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

function addCard(c) {
  const card = document.createElement('article');
  card.className = 'challenge-main-card';
  card.dataset.challengeId = c.id;
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
    '<button type="button" class="challenge-result-preview" hidden aria-expanded="false"></button>' +
    '<div class="challenge-result" hidden></div>' +
    '<div class="challenge-links">' +
      '<button type="button" class="nkm-btn nkm-btn--secondary challenge-discuss-btn">💬 Join the discussion</button>' +
      '<button type="button" class="nkm-btn nkm-btn--secondary challenge-share-btn">↗ Share</button>' +
      '<button type="button" class="nkm-btn nkm-btn--secondary challenge-opposite-btn">10-min opposite chat</button>' +
      '<a class="nkm-btn nkm-btn--primary challenge-next-btn" href="challenge.html" data-challenge-id="' + c.id + '">Next Challenge →</a>' +
    '</div>' +
    '<section class="challenge-thread" hidden aria-label="Public challenge discussion">' +
      '<div class="challenge-thread-head"><div><strong>Open discussion</strong><span>Everyone answering this challenge can join.</span></div><span class="challenge-thread-count">Be the first voice</span></div>' +
      '<div class="challenge-thread-feed"></div>' +
      '<div class="challenge-thread-empty">No one has said their piece yet. Start the debate.</div>' +
      '<div class="challenge-thread-compose"><input class="challenge-thread-input" maxlength="280" placeholder="Why did you pick that?"><button type="button" class="nkm-btn nkm-btn--primary challenge-thread-send">Send</button></div>' +
    '</section>';

  const resultPreview = card.querySelector('.challenge-result-preview');
  const result = card.querySelector('.challenge-result');
  const discussion = card.querySelector('.challenge-thread');
  const discussBtn = card.querySelector('.challenge-discuss-btn');
  const shareBtn = card.querySelector('.challenge-share-btn');
  const oppositeBtn = card.querySelector('.challenge-opposite-btn');
  cards.set(c.id, {card, resultPreview, result, discussion, c});

  card.querySelectorAll('[data-choice]').forEach(btn => btn.addEventListener('click', async () => {
    if (!currentUser) return;
    const choice = Number(btn.dataset.choice);
    try {
      await updateChallengeCounter(c.id, currentUser.uid, choice);
      if (answeredChallengeIds) answeredChallengeIds.add(c.id);
      localStorage.setItem('trio_last_challenge', JSON.stringify({id:c.id,choice,at:Date.now()}));

      card.querySelectorAll('[data-choice]').forEach(x => {
        x.disabled = false;
        x.classList.toggle('is-selected', Number(x.dataset.choice) === choice);
      });

      const responses = await getResponses(c.id);
      const counts = countsFromResponses(responses);
      renderCommunityResult(result, c, counts, choice);
      renderAnswerCounts(card, c, counts);
      await renderResultPreview(resultPreview, c, responses);

      result.hidden = false;
      resultPreview.setAttribute('aria-expanded', 'true');
      resultPreview.classList.add('is-open');

      await awardXpWithRetry(c.id, currentUser);
      await bumpStreakWithRetry(c.id, currentUser);

    } catch (err) {
      console.error(err);
      result.hidden = false;
      result.textContent = 'Could not save your answer. Please try again.';
    }
  }));

  card.querySelector('.challenge-next-btn')?.addEventListener('click', async e => {
    e.preventDefault();
    if (!currentUser) {
      location.href = 'login.html?redirect=' + encodeURIComponent('challenge.html');
      return;
    }
    const ordered = [...cards.values()];
    if (!ordered.length) return;
    const answered = await getAnsweredChallengeIds();
    const currentPos = ordered.findIndex(x => x.card === card);
    const afterCurrent = ordered.slice(currentPos + 1);
    const beforeCurrent = ordered.slice(0, Math.max(0, currentPos));
    const next = [...afterCurrent, ...beforeCurrent].find(x => !answered.has(x.c.id));
    if (!next) {
      const note = document.createElement('div');
      note.className = 'challenge-all-done';
      note.setAttribute('role', 'status');
      note.textContent = 'Aaj ke sab challenges ho gaye ✓';
      const existing = card.querySelector('.challenge-all-done');
      if (!existing) card.querySelector('.challenge-links')?.appendChild(note);
      return;
    }
    card.classList.remove('challenge-switching-in');
    card.classList.add('challenge-switching-out');
    next.card.classList.remove('challenge-switching-out');
    next.card.classList.add('challenge-switching-in');
    setTimeout(() => {
      card.classList.remove('challenge-switching-out');
      next.card.scrollIntoView({behavior:'smooth', block:'center'});
      setTimeout(() => next.card.classList.remove('challenge-switching-in'), 520);
    }, 260);
  });

  resultPreview.addEventListener('click', async () => {
    const expanded = !result.hidden;
    result.hidden = expanded;
    resultPreview.setAttribute('aria-expanded', String(!expanded));
    resultPreview.classList.toggle('is-open', !expanded);
    if (!expanded) {
      const responses = await getResponses(c.id);
      const counts = countsFromResponses(responses);
      const mySnap = currentUser ? await getDoc(doc(db,'challengeAnswers',currentUser.uid + '_' + c.id)).catch(() => null) : null;
      const myChoice = mySnap?.exists() ? Number(mySnap.data().choice) : null;
      renderCommunityResult(result, c, counts, Number.isInteger(myChoice) ? myChoice : null);
      result.hidden = false;
      await renderVoterPeek(result, c, responses);
    }
  });

  shareBtn.addEventListener('click', () => shareChallenge(c));
  const nextBtn = card.querySelector('.challenge-next-btn');
  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      const currentId = nextBtn.dataset.challengeId;
      const cards = Array.from(document.querySelectorAll('.challenge-card[data-task-id]'));
      const currentIndex = cards.findIndex(card => card.dataset.taskId === currentId);
      if (currentIndex >= 0 && currentIndex < cards.length - 1) {
        e.preventDefault();
        cards[currentIndex + 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
  oppositeBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    const mine = await getDoc(doc(db,'challengeAnswers',currentUser.uid + '_' + c.id)).catch(() => null);
    if (!mine?.exists()) { alert('Pick an answer first.'); return; }
    const myChoice = Number(mine.data().choice);
    const snap = await getDocs(query(collection(db,'challengeAnswers'), where('challengeId','==',c.id), limit(40))).catch(() => null);
    const other = snap?.docs.find(d => d.data()?.uid !== currentUser.uid && Number(d.data()?.choice) !== myChoice);
    if (!other) { alert('No one on the opposite side yet. Check back when someone picks differently.'); return; }
    const params = new URLSearchParams({challenge:c.id, other:other.data().uid});
    location.href = 'temp-chat.html?' + params.toString();
  });

  discussBtn.addEventListener('click', () => {
    discussion.hidden = !discussion.hidden;
    discussBtn.textContent = discussion.hidden ? '💬 Join the discussion' : '💬 Discussion open';
    if (!discussion.hidden) {
      attachDiscussion(c, card, discussion);
      inputFocusIfNeeded(discussion);
    } else {
      const unsub = threadUnsubs.get(c.id);
      if (unsub) { unsub(); threadUnsubs.delete(c.id); }
    }
  });

  host?.appendChild(card);
}

function inputFocusIfNeeded(discussion) {
  setTimeout(() => discussion.querySelector('.challenge-thread-input')?.focus(), 80);
}

const hydratedCards = new Set();

async function hydrateCard(id) {
  if (hydratedCards.has(id)) return;
  const entry = cards.get(id);
  if (!entry) return;
  hydratedCards.add(id);
  const {card,c,resultPreview,result} = entry;
  const responses = await getResponses(id);
  const counts = countsFromResponses(responses);
  renderAnswerCounts(card,c,counts);
  const mySnap = currentUser ? await getDoc(doc(db,'challengeAnswers',currentUser.uid + '_' + id)).catch(() => null) : null;
  const myChoice = mySnap?.exists() ? Number(mySnap.data().choice) : null;
  renderCommunityResult(result,c,counts,Number.isInteger(myChoice) ? myChoice : null);
  await renderResultPreview(resultPreview,c,responses);
  if (Number.isInteger(myChoice)) {
    card.querySelectorAll('[data-choice]').forEach((x,i) => x.disabled = false);
    card.querySelectorAll('[data-choice]').forEach((x,i) => x.classList.toggle('is-selected', i === myChoice));
  }
}

async function hydrateVisibleCards() {
  const entries=[...cards.values()];
  if (!('IntersectionObserver' in window)) {
    await Promise.all(entries.slice(0,4).map(x => hydrateCard(x.c.id)));
    return;
  }
  const observer=new IntersectionObserver(entries => {
    entries.filter(e => e.isIntersecting).forEach(e => {
      observer.unobserve(e.target);
      hydrateCard(e.target.dataset.challengeId);
    });
  }, {rootMargin:'520px 0px'});
  entries.forEach(({card}) => observer.observe(card));
}


function renderCategoryFilters(tasks, builtIns) {
  const existing = document.getElementById('challengeCategoryFilters'); if (existing) existing.remove();
  const wrap = document.createElement('div'); wrap.id='challengeCategoryFilters'; wrap.className='challenge-category-filters';
  wrap.innerHTML = CHALLENGE_CATEGORIES.map((x,i)=>`<button type="button" class="challenge-category-filter${i===0?' active':''}" data-category="${esc(x)}">${esc(x)}</button>`).join('');
  host?.parentNode?.insertBefore(wrap, host);
  wrap.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click', () => {
    wrap.querySelectorAll('.challenge-category-filter').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    const category=btn.dataset.category;
    cards.forEach(({card,c}) => { const visible=category==='All' || String(c.category||'Community')===category; card.hidden=!visible; });
  }));
}

async function loadCommunityChallenges() {
  if (!host) return;
  try {
    const tasks = await listCommunityTasks({kind:'challenge',status:'active',max:24});
    const custom = tasks
      .filter(t => t.interaction?.kind === 'choice' && t.interaction?.question && Array.isArray(t.interaction?.options))
      .map(t => ({
        id:t.id, tag:'COMMUNITY', q:t.interaction.question, o:t.interaction.options,
        creatorUid:t.creatorUid || '', creatorName:t.creatorName || 'Admin',
        creatorRole:t.creatorRole || (t.creatorUid ? 'Member' : 'Admin'),
        category:t.category || 'Community', format:t.interaction.format || 'quick', twist:t.interaction.twist || '',
        createdAtMs:Number(t.createdAtMs || t.createdAt?.toMillis?.() || 0)
      }));

    const builtIns = CHALLENGES.map(c => ({...c, category:c.tag === 'MAKE' ? 'Tech' : c.tag === 'LIFE' ? 'Life' : 'Fun', creatorName:'Admin', creatorRole:'Admin', creatorUid:''}));
    renderCategoryFilters(tasks, builtIns);
    const all = [...builtIns, ...custom].sort((a,b) =>
      (Number(b.createdAtMs)||0) - (Number(a.createdAtMs)||0)
    );

    const seen = new Set();
    all.forEach(c => {
      if (seen.has(c.id)) return;
      seen.add(c.id);
      addCard(c);
    });

    if (custom.length) {
      const heading = document.createElement('div');
      heading.className = 'challenge-community-heading';
      heading.innerHTML = '<span class="challenge-tag">COMMUNITY</span><h2>Questions from people</h2><p>Real prompts created by the community. Pick, compare and talk in public.</p>';
      host.insertBefore(heading, host.firstChild);
    }

    await hydrateVisibleCards();
    if (requestedId) {
      const match = [...cards.values()].find(x => x.c.id === requestedId);
      if (match) setTimeout(() => match.card.scrollIntoView({behavior:'smooth', block:'center'}), 100);
    }
  } catch (err) {
    console.warn('community challenges unavailable', err);
    CHALLENGES
      .slice()
      .sort((a,b) => (Number(b.createdAtMs)||0) - (Number(a.createdAtMs)||0))
      .forEach(c => addCard({...c, creatorName:'Admin', creatorRole:'Admin', creatorUid:''}));
    await hydrateVisibleCards();
  }
}

async function awardXpWithRetry(challengeId, user) {
  if (!user) return;
  const maxRetries = 2;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await workerPost('/gamification/award-xp', { meta: { challengeId } }, user);
      window.dispatchEvent(new CustomEvent('trio-xp-changed', { detail: { uid: user.uid } }));
      const data = await workerPost('/gamification/award-xp', { meta: { challengeId } }, user);
      if (data?.leveledUp) {
        showToast(`Level up! You're now Level ${data.level} 🎉`, 'success');
      } else if (data?.badgesEarned?.length) {
        showToast(`Badge unlocked: ${data.badgesEarned[0].name} 🏆`, 'success');
      } else {
        showToast('+25 XP earned ✨', 'success');
      }
      return;
    } catch (err) {
      console.warn(`[Challenge] XP award attempt ${attempt + 1} failed:`, err);
      if (attempt === maxRetries - 1) {
        showToast('XP award failed — will retry in background', 'warn');
        setTimeout(() => awardXpWithRetry(challengeId, user), 5000);
      }
    }
  }
}

async function bumpStreakWithRetry(challengeId, user) {
  if (!user) return;
  const maxRetries = 2;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const data = await workerPost('/gamification/bump-streak', { challengeId }, user);
      if (data?.streakCurrent && !data.alreadyCounted) {
        showToast(`🔥 ${data.streakCurrent}-day streak!`, 'success');
      }
      return;
    } catch (err) {
      console.warn(`[Challenge] streak bump attempt ${attempt + 1} failed:`, err);
      if (attempt === maxRetries - 1) {
        setTimeout(() => bumpStreakWithRetry(challengeId, user), 5000);
      }
    }
  }
}

onAuthStateChanged(auth, u => {
  currentUser = u;
  if (u) hydrateVisibleCards();
});

const params = new URLSearchParams(location.search);
const requestedId = params.get('challenge') || params.get('id');
const requestedCategory = params.get('category') || 'All';
loadCommunityChallenges().then(() => {
  const btn=document.querySelector('.challenge-category-filter[data-category="'+requestedCategory+'"]');
  if(btn) btn.click();
});
