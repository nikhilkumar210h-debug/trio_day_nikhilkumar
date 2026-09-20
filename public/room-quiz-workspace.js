import { doc, setDoc, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getInteractiveConfig } from './forge-interactions.js';

const esc = value => {
  const node = document.createElement('div');
  node.textContent = String(value ?? '');
  return node.innerHTML;
};

export async function mountSharedQuizWorkspace(root, { db, roomId, activity, me, mode = 'puzzle', onStateChange }) {
  const cfg = activity.interaction?.kind === 'quiz'
    ? {
        ...activity.interaction,
        kind: 'quiz',
        question: String(activity.interaction.question || ''),
        options: Array.isArray(activity.interaction.options) ? activity.interaction.options.slice(0,4) : [],
        correct: Number(activity.interaction.correct) || 0,
        lesson: String(activity.interaction.lesson || '')
      }
    : getInteractiveConfig(activity.engineId || activity.id);

  if (!cfg || cfg.options.length !== 4) {
    root.innerHTML = '<div class="room-forge-note">This activity does not have a shared question yet. Use the activity page for the solo check.</div>';
    return () => {};
  }

  const ref = doc(db, 'rooms', roomId, 'state', 'main');
  const defaultState = { selectedAnswer: null, passed: false, version: 0 };

  root.innerHTML = '<div class="room-forge-head"><div class="room-forge-title"><strong>' +
    (mode === 'learn' ? 'Shared Learn Board' : 'Shared Puzzle Board') +
    '</strong><small>' + (mode === 'learn' ? 'Learn the concept together, then check it.' : 'One answer state for the whole room.') +
    '</small></div><span class="room-forge-sync"><i></i> SYNCED</span></div><div id="sharedQuizBody" class="room-forge-body"></div><div id="sharedQuizLast" class="room-forge-last">Waiting for the room…</div>';

  let current = defaultState;

  const write = async patch => {
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      const latest = snap.exists() ? snap.data() : { state: defaultState, version: 0 };
      current = { ...(latest.state || defaultState), ...patch };
      transaction.set(ref, {
        state: current,
        updatedBy: me.uid,
        updatedAtMs: Date.now(),
        version: Number(latest.version || 0) + 1,
        activityId: activity.id,
        mechanic: mode === 'learn' ? 'shared-learn' : 'shared-puzzle'
      }, { merge: true });
    });
  };

  const render = state => {
    current = state;
    const body = root.querySelector('#sharedQuizBody');
    if (!body) return;

    const lesson = mode === 'learn'
      ? '<div class="forge-lesson">' + esc(cfg.lesson || 'Learn the key idea, then test your understanding.') + '</div>'
      : '';

    const options = cfg.options.map((option, index) => '<button type="button" class="room-forge-option ' +
      (state.selectedAnswer === index ? 'selected ' : '') +
      (state.passed && index === cfg.correct ? 'correct' : '') +
      '" data-answer="' + index + '" ' + (state.passed ? 'disabled' : '') + '>' +
      esc(option) + '</button>').join('');

    const result = state.passed
      ? (mode === 'learn' ? 'Concept understood by the room ✓' : 'Puzzle solved by the room ✓')
      : (state.selectedAnswer === null ? 'Choose an answer together.' : 'Answer selected. Check it when the room agrees.');

    body.innerHTML = lesson +
      '<div class="forge-quiz"><div class="forge-quiz-question">' + esc(cfg.question) +
      '</div><div class="room-forge-options">' + options + '</div></div>' +
      '<div class="room-forge-actions"><button class="room-forge-btn room-forge-btn--primary" id="sharedQuizCheck" ' +
      (state.passed || state.selectedAnswer === null ? 'disabled' : '') + '>Check shared answer</button></div>' +
      '<div id="sharedQuizResult" class="room-forge-status ' + (state.passed ? 'ok' : '') + '">' + result + '</div>';

    body.querySelectorAll('[data-answer]').forEach(button => {
      button.onclick = async () => {
        await write({ selectedAnswer: Number(button.dataset.answer), passed: false });
      };
    });

    body.querySelector('#sharedQuizCheck')?.addEventListener('click', async () => {
      const ok = Number(current.selectedAnswer) === Number(cfg.correct);

      if (ok) {
        await write({ passed: true, passedBy: me.uid, passedAtMs: Date.now() });
        onStateChange?.({ passed: true });
      } else {
        const resultNode = body.querySelector('#sharedQuizResult');
        resultNode.textContent = 'Not quite — discuss it and choose another answer.';
        resultNode.className = 'room-forge-status bad';
      }
    });

    const last = root.querySelector('#sharedQuizLast');
    if (last) {
      last.textContent = state.passed
        ? 'Completed by the room · ' + new Date(state.passedAtMs || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : (state.updatedBy ? 'Last update by ' + (state.updatedBy === me.uid ? 'you' : 'another room member') : 'Shared board initialized');
    }
  };

  const unsubscribe = onSnapshot(ref, async snap => {
    if (snap.exists()) {
      const data = snap.data();
      render({
        ...defaultState,
        ...(data.state || {}),
        version: data.version || 0,
        updatedBy: data.updatedBy,
        updatedAtMs: data.updatedAtMs,
        passed: data.state?.passed || false,
        passedAtMs: data.state?.passedAtMs || null
      });
    } else {
      await setDoc(ref, {
        state: defaultState,
        updatedBy: me.uid,
        updatedAtMs: Date.now(),
        version: 1,
        activityId: activity.id,
        mechanic: mode === 'learn' ? 'shared-learn' : 'shared-puzzle'
      }, { merge: true });
    }
  }, error => {
    root.innerHTML = '<div class="room-forge-note">Shared activity is unavailable right now. Room chat is still available.</div>';
    console.error(error);
  });

  return unsubscribe;
}
