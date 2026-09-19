import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { createCommunityTask, createMysteryCommunityTask } from './gamification/community-tasks.js';
import { showToast } from './ui/toast.js';

const $ = id => document.getElementById(id);
let me = null;
let profile = null;

const MYSTERY_TEMPLATE = {
  synopsis: "A valuable artifact disappeared from a locked gallery. Find the person responsible by connecting the witness statements, timeline, and evidence.",
  briefing: "At 21:10 the museum alarm sounded for 32 seconds. The main doors never opened, three people were inside the west wing, and the curator's display case was found empty. Inspect every clue before making your final deduction.",
  estimatedTime: 25,
  suspects: [
    { id: "suspect_1", name: "Asha Mehta", role: "Curator", alibi: "Says she was in the archive room from 20:50 to 21:20.", description: "Had access to the display case and knows the alarm system." },
    { id: "suspect_2", name: "Rohan Das", role: "Security officer", alibi: "Claims he was watching the west corridor cameras.", description: "Had the security keycard and knew the blind spots." },
    { id: "suspect_3", name: "Maya Sen", role: "Restoration intern", alibi: "Says she was cleaning tools in the workshop.", description: "Was working late and had recently asked about the artifact." }
  ],
  clues: [
    { id: "clue_1", title: "Camera log", type: "document", content: "The west corridor camera records no movement from 21:05 to 21:12, but the security console shows a manual restart at 21:06." },
    { id: "clue_2", title: "Keycard record", type: "document", content: "Rohan's keycard opened the staff stairwell at 21:04. No other keycard opened the west-wing door during that window." },
    { id: "clue_3", title: "Archive note", type: "text", content: "Asha wrote at 20:55: 'Need to check the humidity sensor after the meeting.' The note is timestamped and remains beside the archive terminal." },
    { id: "clue_4", title: "Workshop timer", type: "text", content: "The restoration bench timer was stopped at 20:58 and restarted at 21:15, leaving a gap that does not match Maya's claimed continuous work." }
  ],
  timeline: [
    { id: "event_1", time: "20:50", event: "All three suspects are confirmed inside the museum west wing." },
    { id: "event_2", time: "21:04", event: "A security keycard opens the staff stairwell." },
    { id: "event_3", time: "21:06", event: "The west corridor camera system is manually restarted." },
    { id: "event_4", time: "21:10", event: "The display-case alarm triggers for 32 seconds." }
  ],
  hints: [
    { id: "hint_1", text: "Compare the camera failure with the keycard record rather than trusting the alibis alone." }
  ],
  finalPrompt: "Who is responsible, what was their motive, and which evidence proves your deduction?",
  solution: {
    suspectId: "suspect_2",
    motive: "use the camera blind spot to steal the artifact",
    keyEvidenceIds: ["clue_1", "clue_2"]
  }
};

function syncChallengeMode() {
  const mystery = $('challengeType')?.value === 'mystery';
  $('mysteryBuilder').hidden = !mystery;
  $('verificationBuilder')?.toggleAttribute('hidden', mystery);
  if (mystery && $('icon')) $('icon').value = '🕵️';
  updatePreview();
}

function updatePreview() {
  const mystery = $('challengeType')?.value === 'mystery';
  $('previewIcon').textContent = mystery ? '🕵️' : ($('icon')?.value.trim() || '✦');
  $('previewTitle').textContent = $('title')?.value.trim() || (mystery ? 'Your mystery case' : 'Your challenge');

  let objective = $('objective')?.value.trim() || 'Describe what people should do.';
  if (mystery) {
    try {
      const parsed = JSON.parse($('caseJson')?.value || '{}');
      objective = parsed.synopsis || parsed.finalPrompt || objective;
    } catch {}
  }
  $('previewObjective').textContent = objective;
  $('previewCategory').textContent = $('category')?.value || 'Reasoning';
  $('previewDifficulty').textContent = $('difficulty')?.value || 'Medium';
  const duration = Number($('durationMinutes')?.value || 15);
  $('previewTime').textContent = duration >= 60
    ? (duration / 60) + ' hr' + (duration > 60 ? 's' : '')
    : duration + ' min';
}

function syncVerificationFields() {
  const type = $('verificationType')?.value || 'answer';
  $('answerField').hidden = type !== 'answer';
  $('proofField').hidden = type !== 'proof';
}

function setButtonIdle() {
  const button = $('submitBtn');
  if (button) {
    button.disabled = false;
    button.textContent = 'Publish challenge';
  }
}

function parseMysteryCase() {
  let parsed;
  try {
    parsed = JSON.parse($('caseJson').value);
  } catch (error) {
    throw new Error('Case JSON is not valid. Paste valid JSON from Gemini.');
  }

  if (!parsed || typeof parsed !== 'object') throw new Error('Mystery case JSON must be an object.');
  const solution = parsed.solution;
  if (!solution || typeof solution !== 'object') throw new Error('Mystery case needs a solution object.');

  const caseData = { ...parsed };
  delete caseData.solution;

  if (String(caseData.briefing || '').trim().length < 20) throw new Error('Mystery briefing is too short.');
  if (!Array.isArray(caseData.suspects) || caseData.suspects.length < 2) throw new Error('Add at least 2 suspects.');
  if (!Array.isArray(caseData.clues) || caseData.clues.length < 3) throw new Error('Add at least 3 clues.');
  if (!Array.isArray(caseData.timeline) || caseData.timeline.length < 2) throw new Error('Add at least 2 timeline events.');
  if (!String(solution.suspectId || '').trim()) throw new Error('solution.suspectId is required.');
  if (String(solution.motive || '').trim().length < 3) throw new Error('solution.motive is required.');
  if (!Array.isArray(solution.keyEvidenceIds) || !solution.keyEvidenceIds.length) throw new Error('solution.keyEvidenceIds is required.');

  return { caseData, solution };
}

['title','objective','icon','category','difficulty','durationMinutes','verificationType','challengeType','caseJson'].forEach(id => {
  const element = $(id);
  element?.addEventListener('input', updatePreview);
  element?.addEventListener('change', () => {
    if (id === 'verificationType') syncVerificationFields();
    if (id === 'challengeType') syncChallengeMode();
    updatePreview();
  });
});

syncVerificationFields();
if ($('caseJson')) $('caseJson').value = JSON.stringify(MYSTERY_TEMPLATE, null, 2);
syncChallengeMode();

$('submitBtn')?.addEventListener('click', async () => {
  if (!me) {
    showToast('Please login first', 'error');
    return;
  }

  const title = $('title').value.trim();
  const objective = $('objective').value.trim();
  const mode = $('challengeType')?.value || 'standard';

  if (!title && mode === 'standard') {
    showToast('Give your challenge a title.', 'warn');
    $('title').focus();
    return;
  }

  const button = $('submitBtn');
  const status = $('formStatus');
  button.disabled = true;
  button.textContent = 'Publishing…';
  status.textContent = '';
  status.classList.remove('error');

  try {
    const days = Number($('days').value || 7);

    if (mode === 'mystery') {
      const { caseData, solution } = parseMysteryCase();
      const caseTitle = title || 'Mystery Case';
      const synopsis = String(caseData.synopsis || caseData.finalPrompt || '').trim();
      if (synopsis.length < 10) throw new Error('Add a short case synopsis.');

      const id = await createMysteryCommunityTask(me.uid, profile, {
        title: caseTitle,
        category: $('category').value,
        difficulty: $('difficulty').value,
        durationMinutes: Number($('durationMinutes').value || caseData.estimatedTime || 30),
        xpReward: Number($('xpReward').value) || 100,
        startAtMs: Date.now(),
        endAtMs: Date.now() + days * 86400000,
        caseData,
        solution
      });

      status.textContent = 'Mystery case published ✓';
      showToast('Mystery case published successfully!');
      setTimeout(() => {
        location.href = 'task-detail.html?id=' + encodeURIComponent(id);
      }, 700);
      return;
    }

    if (objective.length < 10) {
      showToast('Add a clear objective so people know what to solve.', 'warn');
      $('objective').focus();
      setButtonIdle();
      return;
    }

    const verificationType = $('verificationType').value;
    const answer = $('answer').value.trim();
    const proofInstruction = $('proofInstruction').value.trim();

    if (verificationType === 'answer' && answer.length < 1) {
      showToast('Add the correct answer so Trio Day can verify the solve.', 'warn');
      $('answer').focus();
      setButtonIdle();
      return;
    }

    if (verificationType === 'proof' && proofInstruction.length < 10) {
      showToast('Explain what counts as proof for this challenge.', 'warn');
      $('proofInstruction').focus();
      setButtonIdle();
      return;
    }

    const answerHash = verificationType === 'answer' ? await hashAnswer(answer) : '';

    const id = await createCommunityTask(me.uid, profile, {
      title,
      description: objective,
      objective,
      icon: $('icon').value.trim() || '✦',
      category: $('category').value,
      difficulty: $('difficulty').value,
      durationMinutes: Number($('durationMinutes').value || 15),
      metric: $('metric').value || 'manual',
      target: Number($('target').value) || 1,
      xpReward: Number($('xpReward').value) || 50,
      verificationType,
      answerHash,
      proofInstruction,
      startAtMs: Date.now(),
      endAtMs: Date.now() + days * 86400000
    });

    status.textContent = 'Published ✓';
    showToast('Challenge published successfully!');
    setTimeout(() => {
      location.href = 'task-detail.html?id=' + encodeURIComponent(id);
    }, 700);
  } catch (error) {
    console.error('Create challenge failed:', error);
    status.textContent = error.message || 'Could not publish challenge.';
    status.classList.add('error');
    showToast(error.message || 'Could not publish challenge.', 'error');
    setButtonIdle();
  }
});

async function hashAnswer(value) {
  const bytes = new TextEncoder().encode(String(value || '').trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

onAuthStateChanged(auth, async user => {
  me = user;
  if (!user) {
    $('formStatus').textContent = 'Please login to create a challenge.';
    return;
  }

  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  profile = snap?.exists()
    ? snap.data()
    : { name: user.displayName || 'User', photoURL: user.photoURL || null };

  updatePreview();
});
