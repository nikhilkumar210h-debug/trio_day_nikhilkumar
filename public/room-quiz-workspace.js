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
  const defaultState = { votes: {}, revealed: false, passed: false, tie: false, proofs: {}, version: 0 };

  root.innerHTML = '<div class="room-forge-head"><div class="room-forge-title"><strong>' +
    (mode === 'learn' ? 'Team Learn Board' : 'Team Puzzle Board') +
    '</strong><small>Everyone votes privately. Reveal the room decision together.</small></div><span class="room-forge-sync"><i></i> TEAM</span></div><div id="sharedQuizBody" class="room-forge-body"></div><div id="sharedQuizLast" class="room-forge-last">Waiting for the team…</div>';

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

  const participantCount = () => Math.max(1, root.closest('.room-grid')?.querySelectorAll('.room-member').length || 1);

  const render = state => {
    current = state;
    const body = root.querySelector('#sharedQuizBody');
    if (!body) return;

    const voteCounts = [0,1,2,3].map(i => Object.values(state.votes || {}).filter(v => Number(v) === i).length);
    const myVote = Object.prototype.hasOwnProperty.call(state.votes || {}, me.uid) ? Number(state.votes[me.uid]) : null;
    const myProof = String(state.proofs?.[me.uid] || '');
    const totalVotes = Object.keys(state.votes || {}).length;
    const requiredVotes = participantCount();
    const highest = Math.max(...voteCounts);
    const leaders = voteCounts.map((count,i)=>count===highest?i:-1).filter(i=>i>=0);
    const majorityIndex = leaders.length===1 ? leaders[0] : -1;
    const lesson = mode === 'learn' ? '<div class="forge-lesson">' + esc(cfg.lesson || 'Learn the key idea, then discuss it together.') + '</div>' : '';

    const options = cfg.options.map((option, index) => {
      const count = voteCounts[index];
      const chosen = myVote === index;
      const result = state.revealed && index === cfg.correct ? ' correct' : '';
      const wrong = state.revealed && index !== cfg.correct && count > 0 ? ' wrong' : '';
      return '<button type="button" class="room-forge-option ' + (chosen ? 'selected ' : '') + result + wrong +
        '" data-answer="' + index + '" ' + (state.revealed ? 'disabled' : '') + '>' +
        '<span>' + esc(option) + '</span>' +
        (state.revealed ? '<small>' + count + ' vote' + (count === 1 ? '' : 's') + '</small>' : (chosen ? '<small>Your vote</small>' : '<small>Vote</small>')) +
      '</button>';
    }).join('');

    let resultText = 'Discuss, then cast your vote.';
    if (state.revealed) {
      resultText = state.tie
        ? 'Tie vote — discuss and vote again.'
        : (majorityIndex === cfg.correct
          ? (Object.keys(state.proofs || {}).length >= participantCount()
            ? (mode === 'learn' ? 'Teach-back complete ✓' : 'Deduction chain complete ✓')
            : (mode === 'learn' ? 'Correct call. Add a teach-back note.' : 'Correct call. Add a deduction note.'))
          : 'Team call missed it. Vote again.');
    } else if (totalVotes >= requiredVotes) {
      resultText = 'Team vote is ready. Reveal the decision.';
    } else if (myVote !== null) {
      resultText = totalVotes + ' / ' + requiredVotes + ' votes in.';
    }

    body.innerHTML = lesson +
      '<div class="forge-quiz"><div class="forge-quiz-question">' + esc(cfg.question) +
      '</div><div class="room-forge-options">' + options + '</div></div>' +
      '<div class="room-forge-vote-meta"><span>' + totalVotes + ' / ' + requiredVotes + ' votes needed</span><span>Talk before reveal</span></div>' +
      '<div class="room-forge-actions"><button class="room-forge-btn room-forge-btn--primary" id="sharedQuizReveal" ' +
      (state.revealed || totalVotes < requiredVotes ? 'disabled' : '') + '>Reveal team vote</button>' +
      (state.revealed && majorityIndex !== cfg.correct ? '<button class="room-forge-btn" id="sharedQuizReset">Vote again</button>' : '') +
      (state.revealed && majorityIndex === cfg.correct && !state.tie && Object.keys(state.proofs || {}).length < Math.min(2, participantCount())
        ? '<div class="room-proof-box"><label>' + (mode === 'learn' ? 'Teach it back in one or two lines.' : 'Add your deduction in one or two lines.') + '</label><textarea id="roomProof" maxlength="300" rows="3" placeholder="' + (mode === 'learn' ? 'Explain the idea in your own words…' : 'What clue or rule sealed the answer?') + '">' + esc(myProof) + '</textarea><button class="room-forge-btn room-forge-btn--primary" id="submitRoomProof">Submit note</button></div>'
        : '') +
      '</div>' +
      '<div id="sharedQuizResult" class="room-forge-status ' + (state.revealed ? (majorityIndex === cfg.correct ? 'ok' : 'bad') : '') + '">' + resultText + '</div>';

    body.querySelectorAll('[data-answer]').forEach(button => {
      button.onclick = async () => {
        if (current.revealed) return;
        const votes = { ...(current.votes || {}), [me.uid]: Number(button.dataset.answer) };
        await write({ votes, revealed: false, passed: false });
      };
    });

    body.querySelector('#sharedQuizReveal')?.addEventListener('click', async () => {
      const latestVotes = current.votes || {};
      const total = Object.keys(latestVotes).length;
      const minVotes = participantCount();
      if (total < minVotes) return;
      const counts = [0,1,2,3].map(i => Object.values(latestVotes).filter(v => Number(v) === i).length);
      const highest = Math.max(...counts);
      const winnerIds = counts.map((count,i)=>count===highest?i:-1).filter(i=>i>=0);
      const winning = winnerIds.length===1 ? winnerIds[0] : -1;
      const ok = winning === cfg.correct;
      await write({ revealed: true, tie: winnerIds.length > 1, passed: false, passedAtMs: Date.now() });
    });

    body.querySelector('#sharedQuizReset')?.addEventListener('click', async () => {
      await write({ votes: {}, revealed: false, passed: false, tie: false, proofs: {} });
    });
    body.querySelector('#submitRoomProof')?.addEventListener('click', async () => {
      const input=body.querySelector('#roomProof');
      const text=String(input?.value||'').trim();
      if(text.length<20){ if(input) input.focus(); return; }
      const proofs={...(current.proofs||{}),[me.uid]:text};
      const needed=participantCount();
      await write({proofs,passed:Object.keys(proofs).length>=needed,passedBy:me.uid,passedAtMs:Date.now()});
      if(Object.keys(proofs).length>=needed) onStateChange?.({passed:true});
    });

    const last = root.querySelector('#sharedQuizLast');
    if (last) {
      last.textContent = state.passed
        ? 'Team solved it · ' + new Date(state.passedAtMs || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : (state.updatedBy ? 'Last move by ' + (state.updatedBy === me.uid ? 'you' : 'a teammate') : 'Team board initialized');
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
        proofs: data.state?.proofs || {},
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
