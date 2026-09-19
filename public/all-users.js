import { auth } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { listCommunityTasks, isMember, joinTask } from './gamification/community-tasks.js';
import { getMyProfile } from './services/userCache.js';
import { escapeHtml as esc } from './utils.js';

const $ = (id) => document.getElementById(id);

let me = null;
let profile = null;
let challenges = [];

function getDifficulty(challenge) {
  return challenge.difficulty || (
    Number(challenge.target) > 5 ? 'Hard' :
    Number(challenge.target) > 2 ? 'Medium' : 'Easy'
  );
}

function getCategory(challenge) {
  return challenge.category || challenge.kindLabel || 'Challenge';
}

function getMinutes(challenge) {
  return Number(
    challenge.durationMinutes ??
    challenge.timeMinutes ??
    challenge.time ??
    0
  );
}

function getRating(challenge) {
  return Number(challenge.ratingAverage ?? challenge.rating ?? 0);
}

function render() {
  const search = ($('usersSearch')?.value || '').toLowerCase().trim();
  const category = $('categoryFilter')?.value || '';
  const difficulty = $('difficultyFilter')?.value || '';
  const maxTime = Number($('timeFilter')?.value || 0);
  const minRating = Number($('ratingFilter')?.value || 0);
  const sort = $('sortFilter')?.value || 'active';

  let list = challenges.filter((challenge) => {
    const text = [
      challenge.title,
      challenge.description,
      challenge.objective,
      challenge.creatorName,
      getCategory(challenge)
    ].filter(Boolean).join(' ').toLowerCase();

    const matchesSearch = !search || text.includes(search);
    const matchesCategory = !category || getCategory(challenge) === category;
    const matchesDifficulty = !difficulty || getDifficulty(challenge) === difficulty;
    const minutes = getMinutes(challenge);
    const matchesTime = !maxTime || !minutes || minutes <= maxTime;
    const matchesRating = !minRating || getRating(challenge) >= minRating;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesDifficulty &&
      matchesTime &&
      matchesRating
    );
  });

  list.sort((a, b) => {
    if (sort === 'rating') {
      return getRating(b) - getRating(a);
    }

    if (sort === 'new') {
      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
    }

    if (sort === 'ending') {
      return (a.endAtMs || Infinity) - (b.endAtMs || Infinity);
    }

    return (
      (Number(b.completions) || 0) +
      (Number(b.joins) || 0) * 0.25 -
      (Number(a.completions) || 0) -
      (Number(a.joins) || 0) * 0.25
    );
  });

  const grid = $('challengeGrid');
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = '<div class="discover-empty">No challenges match these filters.</div>';
    return;
  }

  grid.innerHTML = list.map((challenge) => {
    const category = getCategory(challenge);
    const difficulty = getDifficulty(challenge);
    const minutes = getMinutes(challenge);
    const rating = getRating(challenge);

    return `
      <article class="discover-card">
        <a href="task-detail.html?id=${encodeURIComponent(challenge.id)}" class="discover-card-link">
          <div class="challenge-art">${esc(challenge.artEmoji || challenge.icon || '✦')}</div>
          <div class="challenge-body">
            <h2 class="challenge-title">${esc(challenge.title || 'Challenge')}</h2>
            <div class="challenge-objective">${esc(challenge.objective || challenge.description || 'Complete this challenge.')}</div>

            <div class="challenge-meta">
              ${challenge.challengeType === 'mystery' ? '<span class="pill">🕵️ Mystery</span>' : ''}
              <span class="pill">${esc(category)}</span>
              <span class="pill">${esc(difficulty)}</span>
              <span class="pill">${minutes ? `${minutes} min` : 'Flexible'}</span>
            </div>

            <div class="challenge-stats">
              <div><strong>${Number(challenge.joins || 0)}</strong>Accepted</div>
              <div><strong>${Number(challenge.solvingNow || 0)}</strong>Solving now</div>
              <div><strong>${rating ? rating.toFixed(1) + ' ★' : 'New'}</strong>Rating</div>
            </div>
          </div>
        </a>

        <button
          class="accept-btn"
          type="button"
          data-accept="${esc(challenge.id)}"
        >${challenge._joined ? 'REJECT' : 'ACCEPT'}</button>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('[data-accept]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const id = button.dataset.accept;
      const challenge = challenges.find((item) => item.id === id);

      if (!me || !challenge) return;

      if (challenge._joined) {
        location.href =
          'task-detail.html?id=' +
          encodeURIComponent(id) +
          '&confirmReject=1';
        return;
      }

      button.disabled = true;
      button.textContent = '…';

      try {
        await joinTask(id, me.uid, profile);
        challenge._joined = true;
        render();
      } catch (error) {
        console.error('Accept challenge failed:', error);
        alert(error.message || 'Could not accept challenge.');
        button.disabled = false;
        button.textContent = 'ACCEPT';
      }
    });
  });
}

async function loadChallenges() {
  const grid = $('challengeGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="nkm-skeleton" style="height:310px;border-radius:18px"></div>
    <div class="nkm-skeleton" style="height:310px;border-radius:18px"></div>
  `;

  try {
    challenges = await listCommunityTasks({
      status: 'active',
      max: 60
    });

    if (me) {
      challenges = await Promise.all(
        challenges.map(async (challenge) => ({
          ...challenge,
          _joined: await isMember(challenge.id, me.uid)
        }))
      );
    }

    render();
  } catch (error) {
    console.error('Discover load failed:', error);
    grid.innerHTML =
      '<div class="discover-empty">Could not load challenges. Please refresh.</div>';
  }
}

function bindFilters() {
  [
    'usersSearch',
    'categoryFilter',
    'difficultyFilter',
    'timeFilter',
    'ratingFilter',
    'sortFilter'
  ].forEach((id) => {
    const element = $(id);
    if (!element) return;

    element.addEventListener(
      id === 'usersSearch' ? 'input' : 'change',
      render
    );
  });
}

bindFilters();

onAuthStateChanged(auth, async (user) => {
  me = user;

  if (user) {
    profile = await getMyProfile(user.uid);
  }

  await loadChallenges();
});
