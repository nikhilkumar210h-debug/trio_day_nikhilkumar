import { doc, setDoc, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getChallengeRounds } from './forge-interactions.js';

const esc = value => {
  const node = document.createElement('div');
  node.textContent = String(value ?? '');
  return node.innerHTML;
};

export async function mountSharedChallengeWorkspace(root, { db, roomId, activity, me, hostUid }) {
  const customRounds = Array.isArray(activity.interaction?.rounds) && activity.interaction.rounds.length === 5
    ? activity.interaction.rounds.map(r => ({
        q: String(r.q || ''),
        o: Array.isArray(r.o) ? r.o.slice(0,4) : [],
        a: Number(r.a) || 0
      }))
    : null;
  const rounds = customRounds || getChallengeRounds((Number(String(activity.engineId || activity.id).replace(/\D/g, '')) || 0) % 10, 5);
  const ref = doc(db, 'rooms', roomId, 'state', 'main');
  const roundSeconds = Math.max(30, Math.min(120, Math.round((Number(activity.durationMin || 20) * 60) / rounds.length)));
  const base = {
    round: 0,
    scores: {},
    answered: {},
    startedAtMs: null,
    roundEndsAtMs: null,
    finished: false
  };

  root.innerHTML =
    '<div class="room-forge-head"><div class="room-forge-title"><strong>Live Challenge Board</strong><small>Same round. Separate scores. Everyone races the clock.</small></div><span class="room-forge-sync"><i></i> LIVE</span></div>' +
    '<div id="sharedChallengeBody" class="room-forge-body"></div><div id="sharedChallengeLast" class="room-forge-last">Waiting to start…</div>';

  let current = base;
  let timerId = null;

  const write = async patch => {
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      const latest = snap.exists() ? snap.data() : { state: base, version: 0 };
      const latestState = { ...base, ...(latest.state || {}) };
      const next = { ...latestState, ...patch };
      transaction.set(ref, {
        state: next,
        updatedBy: me.uid,
        updatedAtMs: Date.now(),
        version: Number(latest.version || 0) + 1,
        activityId: activity.id,
        mechanic: 'shared-challenge'
      }, { merge: true });
      current = next;
    });
  };

  const maybeAdvance = async state => {
    if (!state.startedAtMs || !state.roundEndsAtMs || state.finished || Date.now() < Number(state.roundEndsAtMs)) return;

    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) return;
      const latest = { ...base, ...(snap.data().state || {}) };
      if (latest.finished || Date.now() < Number(latest.roundEndsAtMs || 0)) return;

      if (Number(latest.round) >= rounds.length - 1) {
        transaction.set(ref, {
          state: { ...latest, finished: true },
          updatedBy: me.uid,
          updatedAtMs: Date.now(),
          version: Number(snap.data().version || 0) + 1,
          activityId: activity.id,
          mechanic: 'shared-challenge'
        }, { merge: true });
      } else {
        const nextRound = Number(latest.round) + 1;
        transaction.set(ref, {
          state: {
            ...latest,
            round: nextRound,
            answered: {},
            roundEndsAtMs: Date.now() + roundSeconds * 1000
          },
          updatedBy: me.uid,
          updatedAtMs: Date.now(),
          version: Number(snap.data().version || 0) + 1,
          activityId: activity.id,
          mechanic: 'shared-challenge'
        }, { merge: true });
      }
    });
  };

  const renderScores = scores => {
    const rows = Object.entries(scores || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([uid, score]) => '<div class="room-forge-score-row"><span>' + (uid === me.uid ? 'You' : 'Player') + '</span><strong>' + Number(score || 0) + '</strong></div>')
      .join('');
    return rows || '<div class="room-forge-note">Scores appear when players answer.</div>';
  };

  const render = state => {
    current = state;
    const body = root.querySelector('#sharedChallengeBody');
    if (!body) return;

    if (!state.startedAtMs) {
      body.innerHTML =
        '<div class="room-forge-note">The host starts the challenge when everyone is ready.</div>' +
        '<div class="room-forge-actions"><button class="room-forge-btn room-forge-btn--primary" id="startChallenge" '+(me.uid===hostUid?'':'disabled')+'>'+(me.uid===hostUid?'Start challenge':'Waiting for host')+'</button></div>';
      body.querySelector('#startChallenge').onclick = async () => {
        if (me.uid !== hostUid) return;
        await write({ startedAtMs: Date.now(), roundEndsAtMs: Date.now() + roundSeconds * 1000, round: 0, scores: {}, answered: {}, finished: false });
      };
    } else if (state.finished) {
      body.innerHTML =
        '<div class="room-forge-scorebar"><span>Challenge complete</span><strong>Final</strong></div>' +
        '<div class="room-forge-score-list">' + renderScores(state.scores) + '</div>' +
        '<div class="room-forge-status ok">Five rounds complete ✓</div>';
    } else {
      const round = rounds[Number(state.round) || 0];
      const answered = !!state.answered?.[me.uid];
      const options = round.o.map((option, index) =>
        '<button type="button" class="room-forge-option ' +
        (answered ? 'selected ' : '') +
        '" data-answer="' + index + '" ' + (answered ? 'disabled' : '') + '>' + esc(option) + '</button>'
      ).join('');

      body.innerHTML =
        '<div class="forge-scorebar"><span>Round ' + (Number(state.round) + 1) + ' / ' + rounds.length + '</span><strong id="sharedChallengeTimer">--</strong></div>' +
        '<div class="forge-quiz"><div class="forge-quiz-question">' + esc(round.q) + '</div><div class="room-forge-options">' + options + '</div></div>' +
        '<div class="room-forge-score-list">' + renderScores(state.scores) + '</div>' +
        '<div id="sharedChallengeResult" class="room-forge-status">' + (answered ? 'Answer locked for this round.' : 'Choose your answer before time runs out.') + '</div>';

      body.querySelectorAll('[data-answer]').forEach(button => {
        button.onclick = async () => {
          if (current.answered?.[me.uid]) return;
          const selected = Number(button.dataset.answer);

          await runTransaction(db, async transaction => {
            const snap = await transaction.get(ref);
            if (!snap.exists()) return;
            const latest = { ...base, ...(snap.data().state || {}) };
            const answered = { ...(latest.answered || {}) };
            if (latest.finished || answered[me.uid] || Date.now() >= Number(latest.roundEndsAtMs || 0)) return;

            const scores = { ...(latest.scores || {}) };
            scores[me.uid] = Number(scores[me.uid] || 0) + (selected === round.a ? 1 : 0);
            answered[me.uid] = true;

            transaction.set(ref, {
              state: { ...latest, scores, answered },
              updatedBy: me.uid,
              updatedAtMs: Date.now(),
              version: Number(snap.data().version || 0) + 1,
              activityId: activity.id,
              mechanic: 'shared-challenge'
            }, { merge: true });
          });
        };
      });
    }

    if (timerId) clearInterval(timerId);
    if (!state.finished && state.startedAtMs) {
      timerId = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((Number(current.roundEndsAtMs || 0) - Date.now()) / 1000));
        const timer = root.querySelector('#sharedChallengeTimer');
        if (timer) timer.textContent = remaining + 's';
        if (remaining <= 0) maybeAdvance(current).catch(() => {});
      }, 500);
    }

    const last = root.querySelector('#sharedChallengeLast');
    if (last) {
      last.textContent = state.updatedBy
        ? 'Last update by ' + (state.updatedBy === me.uid ? 'you' : 'another player')
        : 'Challenge ready';
    }
  };

  const unsubscribe = onSnapshot(ref, async snap => {
    if (!snap.exists()) {
      await setDoc(ref, {
        state: base,
        updatedBy: me.uid,
        updatedAtMs: Date.now(),
        version: 1,
        activityId: activity.id,
        mechanic: 'shared-challenge'
      }, { merge: true });
      return;
    }
    const data = snap.data();
    render({ ...base, ...(data.state || {}), version: data.version, updatedBy: data.updatedBy });
  }, error => {
    root.innerHTML = '<div class="room-forge-note">Shared challenge is unavailable right now. Room chat is still available.</div>';
    console.error(error);
  });

  return () => {
    if (timerId) clearInterval(timerId);
    unsubscribe();
  };
}
