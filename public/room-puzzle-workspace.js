import { doc, setDoc, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getInteractiveConfig } from './forge-interactions.js';

const esc = value => { const node = document.createElement('div'); node.textContent = String(value ?? ''); return node.innerHTML; };

export async function mountSharedPuzzleWorkspace(root, { db, roomId, activity, me, onStateChange }) {
  const cfg = getInteractiveConfig(activity.id);
  if (!cfg) {
    root.innerHTML = '<div class="room-forge-note">This puzzle does not have a shared question yet. Use the activity page for the solo check.</div>';
    return () => {};
  }

  const ref = doc(db, 'rooms', roomId, 'state', 'main');
  root.innerHTML = '<div class="room-forge-head"><div class="room-forge-title"><strong>Shared Puzzle Board</strong><small>One answer state for the whole room.</small></div><span class="room-forge-sync"><i></i> SYNCED</span></div><div id="sharedPuzzleBody" class="room-forge-body"></div><div id="sharedPuzzleLast" class="room-forge-last">Waiting for the room…</div>';
  let current = { selectedAnswer: null, passed: false, version: 0 };

  const write = async patch => {
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      const latest = snap.exists() ? snap.data() : { state: current, version: 0 };
      current = { ...(latest.state || {}), ...patch };
      tx.set(ref, { state: current, updatedBy: me.uid, updatedAtMs: Date.now(), version: Number(latest.version || 0) + 1, activityId: activity.id, mechanic: 'shared-puzzle' }, { merge: true });
    });
  };

  const render = state => {
    current = state;
    const body = root.querySelector('#sharedPuzzleBody');
    if (!body) return;
    const options = cfg.options.map((option, index) => '<button type="button" class="room-forge-option ' + (state.selectedAnswer === index ? 'selected ' : '') + (state.passed && index === cfg.correct ? 'correct' : '') + '" data-answer="' + index + '" ' + (state.passed ? 'disabled' : '') + '>' + esc(option) + '</button>').join('');
    const resultText = state.passed ? 'Puzzle solved by the room ✓' : (state.selectedAnswer === null ? 'Choose an answer together.' : 'Answer selected. Check it when the room agrees.');
    body.innerHTML = '<div class="forge-quiz"><div class="forge-quiz-question">' + esc(cfg.question) + '</div><div class="room-forge-options">' + options + '</div></div><div class="room-forge-actions"><button class="room-forge-btn room-forge-btn--primary" id="sharedPuzzleCheck" ' + (state.passed || state.selectedAnswer === null ? 'disabled' : '') + '>Check shared answer</button></div><div id="sharedPuzzleResult" class="room-forge-status ' + (state.passed ? 'ok' : '') + '">' + resultText + '</div>';

    body.querySelectorAll('[data-answer]').forEach(button => {
      button.onclick = async () => { await write({ selectedAnswer: Number(button.dataset.answer), passed: false }); };
    });
    body.querySelector('#sharedPuzzleCheck')?.addEventListener('click', async () => {
      const ok = Number(current.selectedAnswer) === Number(cfg.correct);
      if (ok) {
        await write({ passed: true, passedBy: me.uid, passedAtMs: Date.now() });
        onStateChange?.({ passed: true });
      } else {
        const result = body.querySelector('#sharedPuzzleResult');
        result.textContent = 'Not quite — discuss it and choose another answer.';
        result.className = 'room-forge-status bad';
      }
    });

    const last = root.querySelector('#sharedPuzzleLast');
    if (last) last.textContent = state.passed ? 'Solved by the room · ' + new Date(state.passedAtMs || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (state.updatedBy ? 'Last update by ' + (state.updatedBy === me.uid ? 'you' : 'another room member') : 'Shared board initialized');
  };

  const unsubscribe = onSnapshot(ref, async snap => {
    if (snap.exists()) {
      const data = snap.data();
      render({ ...current, ...(data.state || {}), version: data.version || 0, updatedBy: data.updatedBy, updatedAtMs: data.updatedAtMs, passed: data.state?.passed || false, passedAtMs: data.state?.passedAtMs || null });
      return;
    }
    await setDoc(ref, { state: current, updatedBy: me.uid, updatedAtMs: Date.now(), version: 1, activityId: activity.id, mechanic: 'shared-puzzle' }, { merge: true });
  }, error => { root.innerHTML = '<div class="room-forge-note">Shared puzzle is unavailable right now. Room chat is still available.</div>'; console.error(error); });

  return unsubscribe;
}
