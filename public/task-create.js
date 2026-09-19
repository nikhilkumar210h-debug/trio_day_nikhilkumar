import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { createCommunityTask } from './gamification/community-tasks.js?v=20260919-community3';
import { ACTIVITY_TYPES, activityTypeInfo } from './activity-ui.js';
import { ACTIVITY_CATALOG } from './activity-catalog.js';
import { mechanicInfo, mechanicsFor } from './forge-mechanics.js';
import { getInteractiveConfig } from './forge-interactions.js';
import { escapeHtml as esc } from './utils.js';
import { showToast } from './ui/toast.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let me = null;
let profile = {};
let activeType = ACTIVITY_TYPES[params.get('activity')] ? params.get('activity') : 'puzzle';
let selected = null;
let step = 1;
let interactionDraft = null;

const defaults = {
  puzzle: { duration: 15, difficulty: 'Easy', goal: 'Solve it and show your reasoning.' },
  build: { duration: 20, difficulty: 'Medium', goal: 'Build a working solution using the constraints.' },
  learn: { duration: 15, difficulty: 'Easy', goal: 'Understand the idea and explain it in your own words.' },
  challenge: { duration: 15, difficulty: 'Medium', goal: 'Score at least 3 correct answers.' },
  game: { duration: 20, difficulty: 'Easy', goal: 'Play together and complete the shared round.' }
};

function starters() {
  return ACTIVITY_CATALOG.filter(x => x.type === activeType).slice(0, 4);
}

function currentMechanic() {
  return selected?.mechanic || (mechanicsFor(activeType)[0]?.id || 'custom');
}

function sourceConfig(template) {
  if (!template) return null;
  const cfg = getInteractiveConfig(template.id);
  if (!cfg) return null;
  return {
    kind: 'quiz',
    question: cfg.question,
    options: [...cfg.options],
    correct: Number(cfg.correct) || 0,
    lesson: cfg.lesson || '',
    proofRequired: true,
    proofPrompt: activeType === 'learn'
      ? 'Explain the idea in your own words or give a small example.'
      : 'Show your reasoning. What clue, rule or step led you to this answer?'
  };
}

function setStep(next) {
  step = Math.max(1, Math.min(3, next));
  document.querySelectorAll('[data-wizard-step]').forEach(panel => {
    panel.hidden = Number(panel.dataset.wizardStep) !== step;
  });
  document.querySelectorAll('[data-step]').forEach(btn => {
    const n = Number(btn.dataset.step);
    btn.classList.toggle('active', n <= step);
    btn.classList.toggle('current', n === step);
  });
  renderPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderLanes() {
  const host = $('creatorLanes');
  if (!host) return;
  host.innerHTML = Object.entries(ACTIVITY_TYPES).map(([type, info]) =>
    '<button type="button" class="creator-lane-card creator-lane-card--' + info.tone + ' ' + (type === activeType ? 'selected' : '') + '" data-lane="' + esc(type) + '">' +
      '<span class="creator-lane-art">' + esc(info.icon) + '</span>' +
      '<span class="creator-lane-copy"><strong>' + esc(info.label) + '</strong><small>' + esc(info.desc) + '</small></span>' +
      '<span class="creator-lane-arrow">→</span>' +
    '</button>'
  ).join('');

  host.querySelectorAll('[data-lane]').forEach(btn => btn.addEventListener('click', () => {
    activeType = btn.dataset.lane;
    selected = starters()[0] || null;
    interactionDraft = sourceConfig(selected);
    fillFormFromStarter(true);
    renderLanes();
    renderTemplates();
    renderInteractionEditor();
    renderPreview();
  }));
}

function renderTemplates() {
  const host = $('creatorTemplates');
  if (!host) return;
  const list = starters();
  host.innerHTML = list.map(t => {
    const mechanic = mechanicInfo(activeType, t.mechanic);
    return '<button type="button" class="creator-starter ' + (selected?.id === t.id ? 'selected' : '') + '" data-starter="' + esc(t.id) + '">' +
      '<span class="creator-starter-icon">' + esc(t.icon || activityTypeInfo(t).icon) + '</span>' +
      '<span class="creator-starter-main"><strong>' + esc(t.title) + '</strong><small>' + esc(t.description || '') + '</small>' +
      '<span class="creator-starter-foot"><em>' + esc(mechanic?.label || 'Ready to use') + '</em><em>⏱ ' + Number(t.durationMin || 20) + 'm</em></span></span>' +
      '<span class="creator-starter-go">↗</span></button>';
  }).join('');

  host.querySelectorAll('[data-starter]').forEach(btn => btn.addEventListener('click', () => {
    selected = list.find(x => x.id === btn.dataset.starter) || null;
    interactionDraft = sourceConfig(selected);
    fillFormFromStarter(false);
    renderTemplates();
    renderInteractionEditor();
    renderPreview();
  }));
}

function fillFormFromStarter(forceTitle) {
  const t = selected || starters()[0];
  if (!t) return;
  const base = defaults[activeType] || defaults.game;
  const fields = {
    title: t.title || '',
    description: t.description || '',
    goal: t.goal || base.goal,
    durationMin: String(t.durationMin || base.duration),
    difficulty: t.difficulty || base.difficulty,
    category: t.category || 'General',
    instructions: t.instructions || 'Follow the activity and complete the goal shown on screen.',
    expiresDays: String(Math.min(40, Math.max(7, Number(t.cycleDays) || 14)))
  };
  ['title','description','goal'].forEach(id => {
    const el = $(id);
    if (forceTitle || !el.value.trim() || el.dataset.seeded === 'true') {
      el.value = fields[id];
      el.dataset.seeded = 'true';
    }
  });
  ['durationMin','difficulty','category','instructions','expiresDays'].forEach(id => { if ($(id)) $(id).value = fields[id]; });
}

function renderInteractionEditor() {
  const host = $('customInteraction');
  if (!host) return;
  const info = ACTIVITY_TYPES[activeType];

  if (activeType === 'puzzle' || activeType === 'learn') {
    if (!interactionDraft || interactionDraft.kind !== 'quiz') interactionDraft = {
      kind: 'quiz', question: '', options: ['', '', '', ''], correct: 0, lesson: '', proofRequired: true,
      proofPrompt: activeType === 'learn'
        ? 'Explain the idea in your own words or give a small example.'
        : 'Show your reasoning. What clue, rule or step led you to this answer?'
    };
    const d = interactionDraft;
    let html = '<div class="creator-interaction-head"><div><span class="eyebrow">' + info.icon + ' ' + info.label + ' interaction</span><strong>Make the actual task yours</strong></div><span>Required</span></div>';
    if (activeType === 'learn') html += '<label class="creator-field"><span>Mini lesson</span><textarea id="interactionLesson" maxlength="900" rows="3" placeholder="Teach the idea in a few simple lines."></textarea></label>';
    html += '<label class="creator-field"><span>Question</span><textarea id="interactionQuestion" maxlength="500" rows="3" placeholder="What should people solve?"></textarea></label>';
    html += '<div class="creator-answer-grid">';
    [0,1,2,3].forEach(i => {
      html += '<label class="creator-answer-row"><span>' + String.fromCharCode(65 + i) + '</span><input data-answer-index="' + i + '" maxlength="180" placeholder="Answer ' + String.fromCharCode(65 + i) + '"></label>';
    });
    html += '</div>';
    html += '<div class="creator-correct-row"><span>Correct answer</span><div>';
    [0,1,2,3].forEach(i => html += '<button type="button" class="creator-correct ' + (d.correct === i ? 'selected' : '') + '" data-correct="' + i + '">' + String.fromCharCode(65 + i) + '</button>');
    html += '</div></div>';
    html += '<label class="creator-field"><span>Proof prompt</span><input id="proofPrompt" maxlength="240" placeholder="Ask for reasoning or an example."></label>';
    html += '<small class="creator-interaction-note">A correct click is not enough. Participants must also submit a short explanation before completion is unlocked.</small>';
    host.innerHTML = html;

    if (activeType === 'learn' && $('interactionLesson')) $('interactionLesson').value = d.lesson || '';
    $('interactionQuestion').value = d.question || '';
    host.querySelectorAll('[data-answer-index]').forEach(input => { input.value = d.options[Number(input.dataset.answerIndex)] || ''; });
    $('proofPrompt').value = d.proofPrompt || '';

    host.querySelectorAll('[data-correct]').forEach(btn => btn.addEventListener('click', () => {
      d.correct = Number(btn.dataset.correct);
      host.querySelectorAll('[data-correct]').forEach(x => x.classList.toggle('selected', x === btn));
    }));
    if ($('interactionQuestion')) $('interactionQuestion').addEventListener('input', e => { d.question = e.target.value; renderPreview(); });
    if ($('proofPrompt')) $('proofPrompt').addEventListener('input', e => { d.proofPrompt = e.target.value; renderPreview(); });
    if ($('interactionLesson')) $('interactionLesson').addEventListener('input', e => { d.lesson = e.target.value; renderPreview(); });
    host.querySelectorAll('[data-answer-index]').forEach(input => input.addEventListener('input', e => {
      d.options[Number(input.dataset.answerIndex)] = e.target.value;
    }));
    return;
  }

  if (activeType === 'build') {
    if (!interactionDraft || interactionDraft.kind !== 'build') interactionDraft = { kind: 'build', mechanic: currentMechanic() };
    const mechanics = mechanicsFor('build').filter(m => ['order','grid','allocate','assign'].includes(m.id));
    let html = '<div class="creator-interaction-head"><div><span class="eyebrow">🛠️ Build interaction</span><strong>Pick how people will build</strong></div><span>Real board</span></div><div class="creator-mechanic-grid">';
    mechanics.forEach(m => {
      html += '<button type="button" class="creator-mechanic-card ' + (interactionDraft.mechanic === m.id ? 'selected' : '') + '" data-mechanic="' + esc(m.id) + '"><strong>' + esc(m.icon) + ' ' + esc(m.label) + '</strong><small>' + esc(m.desc) + '</small></button>';
    });
    html += '</div><small class="creator-interaction-note">The participant must manipulate the board and pass its constraints. A single button cannot complete it.</small>';
    host.innerHTML = html;
    host.querySelectorAll('[data-mechanic]').forEach(btn => btn.addEventListener('click', () => {
      interactionDraft.mechanic = btn.dataset.mechanic;
      selected = { ...(selected || {}), mechanic: interactionDraft.mechanic };
      host.querySelectorAll('[data-mechanic]').forEach(x => x.classList.toggle('selected', x === btn));
      renderPreview();
    }));
    return;
  }

  if (activeType === 'challenge') {
    interactionDraft = { kind: 'challenge' };
    host.innerHTML = '<div class="creator-interaction-head"><div><span class="eyebrow">⚡ Challenge</span><strong>Five quick rounds</strong></div><span>3 / 5 to pass</span></div>' +
      '<div class="creator-challenge-preview"><strong>How it works</strong><p>Participants answer five rounds. At least three correct answers are required before the activity can be completed.</p></div>' +
      '<small class="creator-interaction-note">Your title, goal, topic and instructions define the challenge. The multi-round engine handles the scoring.</small>';
    return;
  }

  interactionDraft = { kind: 'room' };
  host.innerHTML = '<div class="creator-interaction-head"><div><span class="eyebrow">🎮 Game</span><strong>Play together in a room</strong></div><span>Multiplayer</span></div>' +
    '<div class="creator-challenge-preview"><strong>Shared activity</strong><p>People join a live room and play around one shared objective.</p></div>';
}

function interactionPayload() {
  if (!interactionDraft) return { kind: activeType === 'game' ? 'room' : activeType };
  if (interactionDraft.kind !== 'quiz') return { ...interactionDraft };
  return {
    kind: 'quiz',
    question: String(interactionDraft.question || '').trim().slice(0, 500),
    options: interactionDraft.options.map(x => String(x || '').trim().slice(0, 180)),
    correct: Number(interactionDraft.correct) || 0,
    lesson: String(interactionDraft.lesson || '').trim().slice(0, 900),
    proofRequired: true,
    proofPrompt: String(interactionDraft.proofPrompt || '').trim().slice(0, 240)
  };
}

function validateBeforePreview() {
  const title = $('title').value.trim();
  const desc = $('description').value.trim();
  const goal = $('goal').value.trim();
  if (title.length < 3) return 'Give the activity a clear name.';
  if (desc.length < 10) return 'Tell people what they are going to do.';
  if (goal.length < 5) return 'Add a simple goal.';
  if (activeType === 'puzzle' || activeType === 'learn') {
    const d = interactionPayload();
    if (d.question.length < 10) return 'Write a real question for the activity.';
    if (d.options.some(x => x.length < 1)) return 'Fill all four answer choices.';
    if (new Set(d.options.map(x => x.toLowerCase())).size < 4) return 'Make the four answers different.';
    if (activeType === 'learn' && d.lesson.length < 20) return 'Add a short mini lesson.';
    if (d.proofPrompt.length < 10) return 'Add a useful proof prompt.';
  }
  return null;
}

function renderPreview() {
  const host = $('creatorLivePreviewCard');
  if (!host) return;
  const type = ACTIVITY_TYPES[activeType];
  const mechanic = activeType === 'build'
    ? mechanicInfo('build', interactionDraft?.mechanic || currentMechanic())
    : mechanicInfo(activeType, selected?.mechanic);
  const template = selected || starters()[0];
  const title = $('title')?.value.trim() || template?.title || 'Your activity';
  const desc = $('description')?.value.trim() || template?.description || type.desc;
  const goal = $('goal')?.value.trim() || defaults[activeType].goal;
  host.innerHTML =
    '<article class="creator-preview-activity"><div class="creator-preview-art"><span>' + esc(template?.icon || type.icon) + '</span><i></i><b></b></div>' +
    '<div class="creator-preview-body"><div class="creator-preview-tags"><em>' + esc(type.label) + '</em><em>' + esc($('category')?.value || template?.category || 'General') + '</em></div>' +
    '<h3>' + esc(title) + '</h3><p>' + esc(desc) + '</p><div class="creator-preview-goal"><strong>Goal</strong><span>' + esc(goal) + '</span></div>' +
    '<div class="creator-preview-meta"><span>⏱ ' + Number($('durationMin')?.value || template?.durationMin || 20) + ' min</span><span>' + esc($('difficulty')?.value || template?.difficulty || 'Medium') + '</span><span>' + esc(mechanic?.label || (activeType === 'challenge' ? '5 rounds' : 'Live')) + '</span></div></div>' +
    '<footer><span>People actually interact</span><strong>Open →</strong></footer></article>';
}

['title','description','goal','category','durationMin','difficulty','expiresDays','instructions'].forEach(id => {
  const el = $(id);
  if (el) {
    el.addEventListener('input', renderPreview);
    el.addEventListener('change', renderPreview);
  }
});

$('toStep2')?.addEventListener('click', () => setStep(2));
$('backStep1')?.addEventListener('click', () => setStep(1));
$('toStep3')?.addEventListener('click', () => {
  const error = validateBeforePreview();
  if (error) return showToast(error, 'warn');
  setStep(3);
});
$('backStep2')?.addEventListener('click', () => setStep(2));
document.querySelectorAll('[data-step]').forEach(btn => btn.addEventListener('click', () => {
  const target = Number(btn.dataset.step);
  if (target < step) setStep(target);
}));

$('creatorForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!me) return showToast('Please login first.', 'error');
  const error = validateBeforePreview();
  if (error) {
    setStep(2);
    return showToast(error, 'warn');
  }

  const btn = $('submitBtn');
  const status = $('formStatus');
  btn.disabled = true;
  status.textContent = 'Publishing…';

  try {
    const requestedDays = Number($('expiresDays').value);
    const days = [7,14,21,30,40].includes(requestedDays) ? requestedDays : 14;
    const title = $('title').value.trim();
    const desc = $('description').value.trim();
    const goal = $('goal').value.trim();

    const id = await createCommunityTask(me.uid, profile, {
      title,
      description: desc,
      goal,
      instructions: $('instructions').value.trim() || 'Complete the activity and reach the goal shown on screen.',
      icon: selected?.icon || ACTIVITY_TYPES[activeType].icon,
      kind: activeType === 'challenge' ? 'challenge' : 'community',
      activityType: activeType,
      category: $('category').value.trim() || selected?.category || 'General',
      mechanic: activeType === 'build' ? (interactionDraft?.mechanic || currentMechanic()) : (selected?.mechanic || activeType),
      templateId: selected?.id || null,
      durationMin: Number($('durationMin').value) || Number(selected?.durationMin) || 20,
      difficulty: $('difficulty').value || selected?.difficulty || 'Medium',
      expiresInDays: days,
      target: 1,
      metric: 'manual',
      xpReward: $('difficulty').value === 'Hard' ? 60 : $('difficulty').value === 'Medium' ? 40 : 25,
      interaction: interactionPayload()
    });

    status.textContent = 'Published ✓';
    showToast('Activity is live on Discover.');
    setTimeout(() => { location.href = 'activity.html?id=' + encodeURIComponent(id) + '&source=community'; }, 450);
  } catch (err) {
    console.error(err);
    status.textContent = err?.message || 'Could not publish activity.';
    showToast(status.textContent, 'error');
    btn.disabled = false;
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = 'login.html?redirect=task-create.html';
    return;
  }
  me = user;
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  profile = snap?.exists() ? snap.data() : { name: user.displayName || 'User' };
  selected = starters()[0] || null;
  interactionDraft = sourceConfig(selected);
  renderLanes();
  renderTemplates();
  fillFormFromStarter(true);
  renderInteractionEditor();
  renderPreview();
  setStep(1);
});