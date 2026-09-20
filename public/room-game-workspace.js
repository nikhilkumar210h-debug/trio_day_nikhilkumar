import { doc, setDoc, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getGameRounds } from './forge-interactions.js';

const esc = value => {
  const node = document.createElement('div');
  node.textContent = String(value ?? '');
  return node.innerHTML;
};

export async function mountSharedGameWorkspace(root, { db, roomId, activity, me, hostUid }) {
  const rounds = getGameRounds(activity.engineId || activity.id);
  if (!Array.isArray(rounds) || rounds.length !== 5) {
    root.innerHTML = '<div class="room-forge-note">This game is unavailable in shared mode right now.</div>';
    return () => {};
  }

  const ref = doc(db, 'rooms', roomId, 'state', 'main');
  const base = { round: 0, scores: {}, answered: {}, startedAtMs: null, roundEndsAtMs: null, finished: false, version: 0 };
  const roundSeconds = Math.max(20, Math.min(90, Math.round((Number(activity.durationMin || 15) * 60) / rounds.length)));
  let current = base;
  let timerId = null;

  root.innerHTML =
    '<div class="room-forge-head"><div class="room-forge-title"><strong>Party Game Board</strong><small>Same round. Everyone plays. Highest score wins.</small></div><span class="room-forge-sync"><i></i> PLAY</span></div>' +
    '<div id="sharedGameBody" class="room-forge-body"></div><div id="sharedGameLast" class="room-forge-last">Waiting for the host…</div>';

  const write = async patch => {
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      const latest = snap.exists() ? { ...base, ...(snap.data().state || {}) } : base;
      const next = { ...latest, ...patch };
      transaction.set(ref, {
        state: next,
        updatedBy: me.uid,
        updatedAtMs: Date.now(),
        version: Number(snap.data()?.version || 0) + 1,
        activityId: activity.id,
        mechanic: 'shared-game'
      }, { merge: true });
      current = next;
    });
  };

  const renderScores = scores => Object.entries(scores || {})
    .sort((a,b)=>Number(b[1])-Number(a[1]))
    .map(([uid,score])=>'<div class="room-forge-score-row"><span>'+(uid===me.uid?'You':'Player')+'</span><strong>'+Number(score||0)+'</strong></div>')
    .join('') || '<div class="room-forge-note">Scores appear after the first answer.</div>';

  const maybeAdvance = async state => {
    if (!state.startedAtMs || !state.roundEndsAtMs || state.finished || Date.now() < Number(state.roundEndsAtMs)) return;
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) return;
      const latest={...base,...(snap.data().state||{})};
      if(latest.finished || Date.now() < Number(latest.roundEndsAtMs||0)) return;
      if(Number(latest.round)>=rounds.length-1){
        transaction.set(ref,{state:{...latest,finished:true},updatedBy:me.uid,updatedAtMs:Date.now(),version:Number(snap.data().version||0)+1,activityId:activity.id,mechanic:'shared-game'},{merge:true});
      }else{
        transaction.set(ref,{state:{...latest,round:Number(latest.round)+1,answered:{},roundEndsAtMs:Date.now()+roundSeconds*1000},updatedBy:me.uid,updatedAtMs:Date.now(),version:Number(snap.data().version||0)+1,activityId:activity.id,mechanic:'shared-game'},{merge:true});
      }
    });
  };

  const render = state => {
    current=state;
    const body=root.querySelector('#sharedGameBody'); if(!body)return;

    if(!state.startedAtMs){
      body.innerHTML='<div class="room-forge-note">Host starts the game when the team is ready.</div><div class="room-forge-actions"><button class="room-forge-btn room-forge-btn--primary" id="startGame" '+(me.uid===hostUid?'':'disabled')+'>'+(me.uid===hostUid?'Start game':'Waiting for host')+'</button></div>';
      body.querySelector('#startGame')?.addEventListener('click',async()=>{if(me.uid!==hostUid)return;await write({round:0,scores:{},answered:{},startedAtMs:Date.now(),roundEndsAtMs:Date.now()+roundSeconds*1000,finished:false})});
    }else if(state.finished){
      body.innerHTML='<div class="room-forge-scorebar"><span>Game over</span><strong>Final</strong></div><div class="room-forge-score-list">'+renderScores(state.scores)+'</div><div class="room-forge-status ok">Five rounds complete ✓</div>';
    }else{
      const round=rounds[Math.max(0,Math.min(rounds.length-1,Number(state.round)||0))];
      const answered=!!state.answered?.[me.uid];
      body.innerHTML='<div class="forge-scorebar"><span>Round '+(Number(state.round)+1)+' / 5</span><strong id="sharedGameTimer">--</strong></div>'+
        '<div class="forge-quiz"><div class="forge-quiz-question">'+esc(round.q)+'</div><div class="room-forge-options">'+round.o.map((o,i)=>'<button type="button" class="room-forge-option '+(answered?'selected ':'')+'" data-answer="'+i+'" '+(answered?'disabled':'')+'>'+esc(o)+'</button>').join('')+'</div></div>'+
        '<div class="room-forge-score-list">'+renderScores(state.scores)+'</div><div class="room-forge-status">'+(answered?'Answer locked for this round.':'Pick fast — your own score counts.')+'</div>';

      body.querySelectorAll('[data-answer]').forEach(btn=>btn.addEventListener('click',async()=>{
        if(current.answered?.[me.uid])return;
        const selected=Number(btn.dataset.answer);
        await runTransaction(db,async transaction=>{
          const snap=await transaction.get(ref);if(!snap.exists())return;
          const latest={...base,...(snap.data().state||{})};
          if(latest.finished || Date.now()>=Number(latest.roundEndsAtMs||0) || latest.answered?.[me.uid])return;
          const answered={...(latest.answered||{})};
          const scores={...(latest.scores||{})};
          scores[me.uid]=Number(scores[me.uid]||0)+(selected===round.a?1:0);
          answered[me.uid]=true;
          transaction.set(ref,{state:{...latest,scores,answered},updatedBy:me.uid,updatedAtMs:Date.now(),version:Number(snap.data().version||0)+1,activityId:activity.id,mechanic:'shared-game'},{merge:true});
        });
      }));
    }

    if(timerId)clearInterval(timerId);
    if(!state.finished&&state.startedAtMs){
      timerId=setInterval(()=>{
        const remaining=Math.max(0,Math.ceil((Number(current.roundEndsAtMs||0)-Date.now())/1000));
        const timer=root.querySelector('#sharedGameTimer');if(timer)timer.textContent=remaining+'s';
        if(remaining<=0)maybeAdvance(current).catch(()=>{});
      },500);
    }
    const last=root.querySelector('#sharedGameLast');
    if(last)last.textContent=state.finished?'Game completed by the room ✓':(state.updatedBy?'Last move by '+(state.updatedBy===me.uid?'you':'another player'):'Game ready');
  };

  const unsubscribe=onSnapshot(ref,async snap=>{
    if(snap.exists()){
      const data=snap.data();
      render({...base,...(data.state||{}),version:data.version,updatedBy:data.updatedBy,updatedAtMs:data.updatedAtMs});
    }else{
      await setDoc(ref,{state:base,updatedBy:me.uid,updatedAtMs:Date.now(),version:1,activityId:activity.id,mechanic:'shared-game'},{merge:true});
    }
  },error=>{
    root.innerHTML='<div class="room-forge-note">Shared game is unavailable right now. Room chat is still available.</div>';
    console.error(error);
  });

  return ()=>{ if(timerId)clearInterval(timerId); unsubscribe(); };
}
