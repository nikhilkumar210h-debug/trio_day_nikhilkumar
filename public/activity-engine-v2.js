import{escapeHtml as esc}from'./utils.js';

const FLAGSHIP_V2={
  c1:'reaction',
  l7:'memory',
  p13:'timeline',
  p6:'path',
  b9:'pack',
  c15:'decision',
  c14:'word',
  p4:'cipher'
};

const FLAGSHIP_META={
  c1:{lane:'PLAY',label:'Reaction',tag:'Speed round',social:'Beat your best score.'},
  l7:{lane:'PLAY',label:'Memory',tag:'Recall run',social:'Share your move count.'},
  p13:{lane:'PLAY',label:'Timeline',tag:'Heist order',social:'Challenge a friend to beat your solve.'},
  p6:{lane:'PLAY',label:'Puzzle',tag:'Route run',social:'Compare mistakes with friends.'},
  b9:{lane:'CREATE',label:'Pack Builder',tag:'Trade-off game',social:'Share your final loadout.'},
  c15:{lane:'SOCIAL',label:'Decision',tag:'Group call',social:'See how your choices compare.'},
  c14:{lane:'PLAY',label:'Word',tag:'Word sprint',social:'Challenge someone to beat your streak.'},
  p4:{lane:'PLAY',label:'Cipher',tag:'Code break',social:'Share your solve time.'}
};

function resultCard(stage,activity,score,label,replayText='Play again'){
  const meta=FLAGSHIP_META[activity.id]||{};
  const scoreText=typeof score==='number'?String(score):score;
  const card=document.createElement('div');
  card.className='v2-result';
  card.innerHTML='<div class="v2-result-icon">✓</div><div class="v2-result-kicker">RUN COMPLETE · '+esc(meta.lane||'PLAY')+'</div><h4>'+esc(label)+'</h4><strong class="v2-result-score">'+esc(scoreText)+'</strong><p>'+esc(meta.social||'Your result is ready to share.')+'</p><div class="v2-result-actions"><button type="button" class="v2-result-primary" data-replay>'+esc(replayText)+'</button><button type="button" class="v2-result-secondary" data-share>Share result</button></div></div>';
  stage.innerHTML='';
  stage.appendChild(card);
  card.querySelector('[data-replay]').onclick=()=>location.reload();
  card.querySelector('[data-share]').onclick=async()=>{
    const text='I just played '+activity.title+' on Trio Day — '+label+'.';
    try{
      if(navigator.share) await navigator.share({title:activity.title,text,url:location.href});
      else{await navigator.clipboard.writeText(location.href);card.querySelector('[data-share]').textContent='Link copied ✓';}
    }catch(e){}
  };
}

function shell(root,activity,label,sub){
  root.hidden=false;
  root.innerHTML='<div class="v2-mechanic" data-v2="'+label.toLowerCase()+'"><div class="v2-head"><div><span class="v2-lane">'+esc(FLAGSHIP_META[activity.id]?.lane||'PLAY')+'</span><h3>'+esc(activity.title)+'</h3><p>'+esc(sub)+'</p></div><span class="v2-tag">'+esc(label)+'</span></div><div class="v2-stage" data-stage></div></div>';
  return root.querySelector('[data-stage]');
}

function done(setPassed,activity,stage,score,label,evidence){
  setPassed(true,{mechanic:'flagship-v2',activityId:activity.id,kind:FLAGSHIP_V2[activity.id],score,...(evidence||{})});
  resultCard(stage,activity,score,label);
}

function reaction(root,a,setPassed){
  const stage=shell(root,a,'Reaction','Tap the target as it appears. Ten clean hits. No generic timer.');
  let round=0,score=0,streak=0,started=false,startAt=0,misses=0,interval=null;
  stage.innerHTML='<div class="v2-stats"><span>STREAK <b id="s">0</b></span><span>ROUND <b id="r">0/10</b></span><span>SCORE <b id="p">0</b></span></div><div class="v2-arena" data-arena><button class="v2-start">Tap to start</button></div><div class="v2-feedback" data-f>Ready.</div>';
  const arena=stage.querySelector('[data-arena]'),f=stage.querySelector('[data-f]');
  const paint=()=>{stage.querySelector('#s').textContent=streak;stage.querySelector('#r').textContent=round+'/10';stage.querySelector('#p').textContent=score};
  function spawn(){
    arena.querySelectorAll('[data-target]').forEach(x=>x.remove());
    const t=document.createElement('button');t.type='button';t.dataset.target='1';t.className='v2-target';t.textContent=['✦','●','◆','▲'][round%4];
    t.style.left=(12+Math.random()*76)+'%';t.style.top=(14+Math.random()*68)+'%';
    startAt=performance.now();arena.appendChild(t);
    t.onclick=()=>{if(!started)return;const ms=performance.now()-startAt;const points=Math.max(20,120-Math.round(ms/8));score+=points;streak++;round++;f.textContent='Clean hit · +'+points;paint();if(round>=10){started=false;clearTimeout(interval);done(setPassed,a,stage,score,score+' points · '+streak+' streak',{hits:round,misses});}else{clearTimeout(interval);interval=setTimeout(()=>{misses++;streak=0;round++;f.textContent='Miss · stay sharp';paint();if(round>=10){started=false;done(setPassed,a,stage,score,score+' points',{hits:round-misses,misses});}else spawn()},1400)}};
  }
  stage.querySelector('.v2-start').onclick=e=>{e.currentTarget.remove();started=true;spawn()};
}

function memory(root,a,setPassed){
  const stage=shell(root,a,'Memory','Flip the board. Find six pairs with the fewest moves.');
  const icons=['◆','●','▲','■','✦','✚'],values=[...icons,...icons].sort(()=>Math.random()-.5);
  let open=[],matches=0,moves=0,lock=false;
  stage.innerHTML='<div class="v2-stats"><span>MOVES <b data-m>0</b></span><span>PAIRS <b data-p>0/6</b></span><span>BEST <b>—</b></span></div><div class="v2-memory">'+values.map((v,i)=>'<button type="button" data-i="'+i+'" data-v="'+v+'"><span>'+v+'</span></button>').join('')+'</div><div class="v2-feedback" data-f>Find a pair.</div>';
  const grid=stage.querySelector('.v2-memory');
  grid.onclick=e=>{const c=e.target.closest('button');if(!c||lock||c.disabled||open.includes(c))return;c.classList.add('is-open');open.push(c);if(open.length<2)return;moves++;stage.querySelector('[data-m]').textContent=moves;lock=true;const[a1,a2]=open;if(a1.dataset.v===a2.dataset.v){a1.classList.add('is-match');a2.classList.add('is-match');a1.disabled=a2.disabled=true;matches++;stage.querySelector('[data-p]').textContent=matches+'/6';open=[];lock=false;if(matches===6)done(setPassed,a,stage,moves,moves+' moves',{pairs:6});}else setTimeout(()=>{a1.classList.remove('is-open');a2.classList.remove('is-open');open=[];lock=false},420)};
}

function timeline(root,a,setPassed){
  const stage=shell(root,a,'Timeline','Rebuild the heist by tapping the next event. Three clean chapters.');
  const rounds=[
    ['Alarm triggered','Security camera looped','Side door opened','Crew entered','Package moved'],
    ['Map found','Guard distracted','Vault route chosen','Door opened','Escape begins'],
    ['Signal sent','Museum lights dimmed','Display opened','Object moved','Exit locked']
  ];
  let round=0,score=0;
  function paint(){
    const seq=rounds[round],shuffled=[...seq].sort(()=>Math.random()-.5);
    stage.innerHTML='<div class="v2-stats"><span>CHAPTER <b>'+ (round+1) +'/3</b></span><span>ORDER <b>0/'+seq.length+'</b></span><span>SCORE <b>'+score+'</b></span></div><div class="v2-timeline" data-list>'+shuffled.map((x,i)=>'<button type="button" data-v="'+esc(x)+'"><i>'+String(i+1).padStart(2,'0')+'</i>'+esc(x)+'</button>').join('')+'</div><div class="v2-feedback" data-f>Tap the first event.</div>';
    let pos=0;
    stage.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{if(b.disabled)return;if(b.dataset.v===seq[pos]){b.disabled=true;b.classList.add('is-good');pos++;stage.querySelector('.v2-stats span:nth-child(2) b').textContent=pos+'/'+seq.length;if(pos===seq.length){score+=100;round++;if(round===rounds.length)done(setPassed,a,stage,score,score+' points · 3 chapters',{rounds:3});else setTimeout(paint,350)}}else{b.classList.add('is-bad');stage.querySelector('[data-f]').textContent='Not the next event — trace the clue again.';setTimeout(()=>b.classList.remove('is-bad'),300)}})
  }
  paint();
}

function path(root,a,setPassed){
  const stage=shell(root,a,'Route Puzzle','Guide the rescue route from start to finish. Direct taps, no text answer.');
  const paths=[[0,1,5,9,10,14,15],[0,4,5,6,10,14,15],[0,4,8,9,10,11,15]];
  let level=0,pos=0,mistakes=0;
  function paint(){
    const target=paths[level];
    stage.innerHTML='<div class="v2-stats"><span>ROUTE <b>'+(level+1)+'/3</b></span><span>NEXT <b>'+(pos+1)+'</b></span><span>MISTAKES <b>'+mistakes+'</b></span></div><div class="v2-path">'+Array.from({length:16},(_,i)=>'<button type="button" data-c="'+i+'">'+(i===target[0]?'START':i===target[target.length-1]?'GO':'')+'</button>').join('')+'</div><div class="v2-feedback" data-f>Connect the route.</div>';
    stage.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.c);if(n===target[pos]){b.classList.add('is-path');b.disabled=true;pos++;if(pos===target.length){level++;pos=0;if(level===paths.length)done(setPassed,a,stage,Math.max(0,300-mistakes*20),mistakes+' mistakes · route solved',{routes:3,mistakes});else setTimeout(paint,300)}}else{mistakes++;b.classList.add('is-bad');stage.querySelector('[data-f]').textContent='Dead end. Find the next connected tile.';setTimeout(()=>b.classList.remove('is-bad'),280)}})
  }
  paint();
}

function pack(root,a,setPassed){
  const stage=shell(root,a,'Pack Builder','Choose the strongest travel loadout under a 7kg cap. Every choice changes the result.');
  const items=[['Water',2,'Essential'],['First aid',1,'Essential'],['Map',1,'Essential'],['Camera',2,'Optional'],['Snacks',2,'Useful'],['Game cards',1,'Fun']];
  let selected=new Set();
  stage.innerHTML='<div class="v2-pack-head"><div><b>7 kg</b><span>LOADOUT CAP</span></div><div><b data-w>0 kg</b><span>SELECTED</span></div></div><div class="v2-pack-grid">'+items.map((x,i)=>'<button type="button" data-i="'+i"><strong>'+x[0]+'</strong><span>'+x[1]+' kg · '+x[2]+'</span></button>').join('')+'</div><div class="v2-feedback" data-f>Build your loadout.</div><button class="v2-primary" data-lock>Lock loadout</button>';
  const total=()=>[...selected].reduce((n,i)=>n+items[i][1],0);
  stage.onclick=e=>{const b=e.target.closest('[data-i]');if(b){const i=Number(b.dataset.i);selected.has(i)?selected.delete(i):selected.add(i);b.classList.toggle('is-selected',selected.has(i));stage.querySelector('[data-w]').textContent=total()+' kg';stage.querySelector('[data-f]').textContent=total()>7?'Too heavy — trade something out.':selected.size?'Good trade-off.':'Pick your essentials.'}};
  stage.querySelector('[data-lock]').onclick=()=>{const ok=selected.has(0)&&selected.has(1)&&selected.has(2)&&total()<=7&&selected.size>=4;if(!ok){stage.querySelector('[data-f]').textContent='Keep Water, First aid and Map; stay at or below 7kg.';return}const score=100+(selected.has(4)?20:0)+(selected.has(5)?10:0);done(setPassed,a,stage,score,score+' points · loadout locked',{weight:total(),items:[...selected].map(i=>items[i][0])})}
}

function decision(root,a,setPassed){
  const stage=shell(root,a,'Social Call','Five group decisions. Pick the move that protects the team objective.');
  const rounds=[
    ['The room has one blocker.','Fix the blocker','Start another task','Ignore it'],
    ['Two routes work.','Use the stated constraint','Pick randomly','Choose the longest'],
    ['A teammate lacks context.','Share the key clue','Skip them','Add jargon'],
    ['The result looks odd.','Check the evidence','Hide it','Guess'],
    ['You have one move left.','Protect the shared goal','Show off','Delay']
  ];
  let i=0,score=0;
  function paint(){const r=rounds[i];stage.innerHTML='<div class="v2-stats"><span>ROUND <b>'+(i+1)+'/5</b></span><span>SCORE <b>'+score+'</b></span></div><div class="v2-decision"><strong>'+esc(r[0])+'</strong>'+r.slice(1).map((x,n)=>'<button type="button" data-a="'+n+'">'+esc(x)+'</button>').join('')+'</div><div class="v2-feedback" data-f>Lock your call.</div>';stage.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const ok=Number(b.dataset.a)===0;b.classList.add(ok?'is-good':'is-bad');if(ok)score+=100;stage.querySelector('[data-f]').textContent=ok?'Strong team call.':'That choice weakens the shared objective.';setTimeout(()=>{i++;if(i===rounds.length)done(setPassed,a,stage,score,score+' points · team call',{rounds:5});else paint()},360)})}
  paint();
}

function word(root,a,setPassed){
  const stage=shell(root,a,'Word Sprint','Rebuild five words from scrambled tiles. Streaks matter.');
  const rounds=[['FOCUS','SUOFC'],['TRUST','RTUST'],['BRAVE','VREAB'],['BUILD','DLIBU'],['SPARK','RKSAP']];
  let i=0,score=0,streak=0,picked='';
  function paint(){const [answer,scramble]=rounds[i];picked='';stage.innerHTML='<div class="v2-stats"><span>ROUND <b>'+(i+1)+'/5</b></span><span>STREAK <b>'+streak+'</b></span><span>SCORE <b>'+score+'</b></span></div><div class="v2-word"><strong data-picked>_ _ _ _ _</strong><div>'+scramble.split('').map((x,n)=>'<button type="button" data-letter="'+x+'" data-n="'+n+'">'+x+'</button>').join('')+'</div></div><div class="v2-feedback" data-f>Build the word.</div><button class="v2-primary" data-submit>Check</button>';
    stage.querySelectorAll('[data-letter]').forEach(b=>b.onclick=()=>{if(picked.length>=answer.length)return;picked+=b.dataset.letter;b.disabled=true;stage.querySelector('[data-picked]').textContent=picked.split('').join(' ')});
    stage.querySelector('[data-submit]').onclick=()=>{const ok=picked===answer;if(ok){score+=100+streak*20;streak++;stage.querySelector('[data-f]').textContent='Correct · streak +1';}else{streak=0;stage.querySelector('[data-f]').textContent='Not quite — the word was '+answer+'.';}setTimeout(()=>{i++;if(i===rounds.length)done(setPassed,a,stage,score,score+' points · '+streak+' final streak',{rounds:5});else paint()},520)}
  }
  paint();
}

function cipher(root,a,setPassed){
  const stage=shell(root,a,'Cipher Break','Crack five tiny codes. Read the pattern, then choose the decoded word.');
  const rounds=[
    ['GDBU','FIRE',['FIRE','FIND','FIVE']],
    ['DBU','CAT',['CAR','CAT','CAN']],
    ['IPNF','HOME',['HOME','HOPE','HOLD']],
    ['UFSO','TURN',['TURN','TUNE','TENT']],
    ['QMBZ','PLAY',['PLAY','PLAN','PLUG']]
  ];
  let i=0,score=0;
  function paint(){const r=rounds[i];stage.innerHTML='<div class="v2-stats"><span>BREAK <b>'+(i+1)+'/5</b></span><span>SCORE <b>'+score+'</b></span></div><div class="v2-cipher"><code>'+r[0]+'</code><span>SHIFT −1</span><b>?</b></div><div class="v2-choice">'+r[2].map((x,n)=>'<button type="button" data-a="'+n+'">'+x+'</button>').join('')+'</div><div class="v2-feedback" data-f>Choose the decoded word.</div>';stage.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const ok=b.textContent===r[1];b.classList.add(ok?'is-good':'is-bad');if(ok)score+=100;stage.querySelector('[data-f]').textContent=ok?'Decoded ✓':'Check the shift and try again.';if(ok)setTimeout(()=>{i++;if(i===rounds.length)done(setPassed,a,stage,score,score+' points · code broken',{rounds:5});else paint()},400)})}
  paint();
}

export function renderFlagshipV2(root,activity,setPassed){
  const kind=FLAGSHIP_V2[String(activity?.id||'')];
  if(!kind)return false;
  if(kind==='reaction')reaction(root,activity,setPassed);
  else if(kind==='memory')memory(root,activity,setPassed);
  else if(kind==='timeline')timeline(root,activity,setPassed);
  else if(kind==='path')path(root,activity,setPassed);
  else if(kind==='pack')pack(root,activity,setPassed);
  else if(kind==='decision')decision(root,activity,setPassed);
  else if(kind==='word')word(root,activity,setPassed);
  else if(kind==='cipher')cipher(root,activity,setPassed);
  else return false;
  root.dataset.flagshipV2='true';
  return true;
}
