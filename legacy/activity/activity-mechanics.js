import{escapeHtml as esc}from'./utils.js';

const FLAGSHIP={
 p1:'memory',p4:'sequence',p13:'sequence',p15:'sequence',
 b1:'sequence',b3:'assign',b4:'decision',b11:'grid',
 l1:'sequence',l7:'memory',l8:'decision',l12:'sequence',
 c1:'reaction',c2:'decision',c3:'reaction',c4:'decision',c11:'reaction',c15:'decision'
};

const ICONS=['◆','●','▲','■','✦','✚','⬟','◉'];

function shell(root,activity,label,sub){
 root.hidden=false;
 root.innerHTML='<div class="mechanic-shell" data-mechanic="'+label.toLowerCase()+'">'+
 '<div class="mechanic-head"><div><span class="mechanic-kicker">LIVE MECHANIC</span><h3>'+esc(activity.title)+'</h3><p>'+esc(sub)+'</p></div><span class="mechanic-badge">'+esc(label)+'</span></div>'+
 '<div class="mechanic-stage" id="mechanicStage"></div><div class="mechanic-feedback" id="mechanicFeedback" aria-live="polite"></div>'+
 '</div>';
 return root.querySelector('#mechanicStage');
}
function finish(setPassed,evidence,feedback){
 setPassed(true,evidence);
 const f=document.querySelector('#mechanicFeedback');
 if(f){f.className='mechanic-feedback is-success';f.textContent=feedback||'Complete. Your result is ready.'}
}
function renderReaction(root,activity,setPassed){
 const stage=shell(root,activity,'Reaction','Hit the target before it moves. Build a streak and finish the run.');
 let score=0,hits=0,misses=0,round=0,start=0,active=false,timerId=0;
 const max=10;
 stage.innerHTML='<div class="reaction-hud"><div><span>HITS</span><strong id="rxScore">0</strong></div><div><span>ROUND</span><strong id="rxRound">0/'+max+'</strong></div><div><span>TIME</span><strong id="rxTime">10.0</strong></div></div><div class="reaction-arena" id="rxArena"><button class="reaction-start" id="rxStart">Start run</button></div>';
 const arena=stage.querySelector('#rxArena'),startBtn=stage.querySelector('#rxStart');
 function update(){stage.querySelector('#rxScore').textContent=score;stage.querySelector('#rxRound').textContent=round+'/'+max}
 function spawn(){
   arena.querySelectorAll('.reaction-target').forEach(x=>x.remove());
   const t=document.createElement('button');t.type='button';t.className='reaction-target';t.textContent=ICONS[round%ICONS.length];
   const x=8+Math.random()*78,y=10+Math.random()*70;
   t.style.left=x+'%';t.style.top=y+'%';
   t.onclick=()=>{if(!active)return;const delta=Math.max(1,Math.round(120-(performance.now()-start)/18));score+=delta;hits++;round++;update();if(round>=max){active=false;clearInterval(timerId);finish(setPassed,{mechanic:'reaction',score,hits,misses},'Run complete — '+score+' points. Replay to chase a higher score.');return}spawn();};
   arena.appendChild(t);start=performance.now();
 }
 startBtn.onclick=()=>{score=0;hits=0;misses=0;round=0;active=true;startBtn.remove();update();spawn();timerId=setInterval(()=>{if(!active)return;const elapsed=(performance.now()-start)/1000;stage.querySelector('#rxTime').textContent=Math.max(0,10-elapsed).toFixed(1);if(elapsed>=1.6){misses++;round++;if(round>=max){active=false;clearInterval(timerId);finish(setPassed,{mechanic:'reaction',score,hits,misses},'Run complete — '+score+' points.');return}spawn()}},50)}
}
function renderMemory(root,activity,setPassed){
 const stage=shell(root,activity,'Memory','Flip cards, find every pair, and clear the board with as few misses as possible.');
 const values=[...ICONS.slice(0,6),...ICONS.slice(0,6)].sort(()=>Math.random()-.5);
 let open=[],matched=0,moves=0,locked=false;
 stage.innerHTML='<div class="memory-hud"><span id="memMoves">0 moves</span><strong id="memPairs">0 / 6 pairs</strong></div><div class="memory-grid" id="memGrid">'+values.map((v,i)=>'<button type="button" class="memory-card" data-i="'+i+'" data-v="'+v+'"><span>'+v+'</span></button>').join('')+'</div>';
 const grid=stage.querySelector('#memGrid');
 grid.onclick=e=>{
   const card=e.target.closest('.memory-card');if(!card||locked||card.classList.contains('is-open')||card.classList.contains('is-match'))return;
   card.classList.add('is-open');open.push(card);if(open.length<2)return;
   moves++;stage.querySelector('#memMoves').textContent=moves+' moves';locked=true;
   const [a,b]=open;
   if(a.dataset.v===b.dataset.v){a.classList.add('is-match');b.classList.add('is-match');matched++;stage.querySelector('#memPairs').textContent=matched+' / 6 pairs';open=[];locked=false;if(matched===6)finish(setPassed,{mechanic:'memory',moves,matched},'Board cleared in '+moves+' moves.');}
   else setTimeout(()=>{a.classList.remove('is-open');b.classList.remove('is-open');open=[];locked=false},520);
 };
}
function renderSequence(root,activity,setPassed){
 const stage=shell(root,activity,'Sequence','Watch the order, then rebuild it from memory. Three rounds, no hints.');
 let round=0,score=0,sequence=[];
 const rounds=[5,6,7];
 stage.innerHTML='<div class="sequence-hud"><span id="seqRound">Round 1 / 3</span><strong id="seqScore">0</strong></div><div class="sequence-display" id="seqDisplay"></div><div class="sequence-grid" id="seqGrid"></div><button class="mechanic-primary" id="seqStart">Show sequence</button>';
 const display=stage.querySelector('#seqDisplay'),grid=stage.querySelector('#seqGrid'),btn=stage.querySelector('#seqStart');
 function next(){
   sequence=Array.from({length:rounds[round]},(_,i)=>ICONS[(i+round*2)%ICONS.length]);
   display.innerHTML=sequence.map(x=>'<span>'+x+'</span>').join('');
   grid.innerHTML='';btn.hidden=true;
   setTimeout(()=>{display.innerHTML='<span class="sequence-hidden">?</span>';grid.innerHTML=[...sequence].sort(()=>Math.random()-.5).map((x,i)=>'<button type="button" data-v="'+x+'">'+x+'</button>').join('');let pos=0;
     grid.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.v===sequence[pos]){b.disabled=true;b.classList.add('is-correct');pos++;if(pos===sequence.length){score++;round++;stage.querySelector('#seqScore').textContent=score; if(round===rounds.length){finish(setPassed,{mechanic:'sequence',rounds:3,score},'Sequence mastered — 3/3 rounds cleared.');return}stage.querySelector('#seqRound').textContent='Round '+(round+1)+' / 3';btn.hidden=false;btn.textContent='Next round';}}else{b.classList.add('is-wrong');setTimeout(()=>b.classList.remove('is-wrong'),350)}}},850);
 }
 btn.onclick=next;
}
function renderDecision(root,activity,setPassed){
 const stage=shell(root,activity,'Decision','Make the best call under a constraint. Your score rewards the choice, not the longest explanation.');
 const rounds=[
  {q:'You have 10 minutes left. What should happen first?',o:['Clarify the goal','Add another feature','Polish the logo'],a:0},
  {q:'A plan has one blocked dependency. What is the move?',o:['Fix the blocker','Ignore it','Start the last step'],a:0},
  {q:'A result looks surprising. What should you do?',o:['Check the evidence','Hide the result','Guess the cause'],a:0},
  {q:'Two options both work. What breaks the tie?',o:['The stated constraint','The loudest opinion','Random choice'],a:0},
  {q:'A teammate is missing context. What helps most?',o:['Share the key constraint','Give more jargon','Skip them'],a:0}
 ];
 let i=0,score=0;
 function paint(){stage.innerHTML='<div class="decision-hud"><span>ROUND '+(i+1)+' / '+rounds.length+'</span><strong>'+score+' pts</strong></div><div class="decision-card"><div>'+esc(rounds[i].q)+'</div><div class="decision-options">'+rounds[i].o.map((x,n)=>'<button type="button" data-a="'+n+'">'+esc(x)+'</button>').join('')+'</div></div><div class="decision-result"></div>';stage.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const ok=Number(b.dataset.a)===rounds[i].a;score+=ok?100:0;b.classList.add(ok?'is-correct':'is-wrong');stage.querySelector('.decision-result').textContent=ok?'Strong call. +100':'Not the constraint-aware move.';setTimeout(()=>{i++;if(i===rounds.length){finish(setPassed,{mechanic:'decision',score,rounds:5},'Decision run complete — '+score+' points.');return}paint()},420)})}
 paint();
}
function renderAssign(root,activity,setPassed){
 const stage=shell(root,activity,'Match','Pair each task with the role that owns it. Fast, clean assignments score the finish.');
 const pairs=[['Problem','Product'],['Flow','Designer'],['Risk','Reviewer'],['Pitch','Presenter']];
 let selected=null,done=0,errors=0;
 stage.innerHTML='<div class="assign-board"><div class="assign-column" id="assignItems"><span class="assign-label">TASKS</span>'+pairs.map(x=>'<button data-item="'+x[0]+'">'+x[0]+'</button>').join('')+'</div><div class="assign-column" id="assignRoles"><span class="assign-label">ROLES</span>'+pairs.map(x=>'<button data-role="'+x[1]+'">'+x[1]+'</button>').join('')+'</div></div><div class="assign-status" id="assignStatus">Pick a task, then its owner.</div>';
 stage.onclick=e=>{const item=e.target.closest('[data-item]'),role=e.target.closest('[data-role]');if(item){stage.querySelectorAll('[data-item]').forEach(x=>x.classList.remove('is-selected'));item.classList.add('is-selected');selected=item.dataset.item;return}if(role&&selected){const pair=pairs.find(x=>x[0]===selected);if(pair?.[1]===role.dataset.role){stage.querySelector('[data-item="'+selected+'"]').disabled=true;role.disabled=true;role.classList.add('is-correct');done++;stage.querySelector('#assignStatus').textContent=done+'/'+pairs.length+' matched';selected=null;if(done===pairs.length)finish(setPassed,{mechanic:'assign',matched:done,errors},'All roles matched. Clean finish.')}else{errors++;role.classList.add('is-wrong');stage.querySelector('#assignStatus').textContent='Wrong owner — keep the task selected.';setTimeout(()=>role.classList.remove('is-wrong'),350)}}}
}
function renderGrid(root,activity,setPassed){
 const stage=shell(root,activity,'Grid','Find the hidden path. Tap the cells in order without stepping onto a blocked tile.');
 const size=4,blocked=new Set([1,6,11]),path=[0,4,5,9,10,14,15];let pos=0,mistakes=0;
 stage.innerHTML='<div class="grid-hud"><span>PATH '+(pos+1)+' / '+path.length+'</span><strong>0 mistakes</strong></div><div class="path-grid">'+Array.from({length:size*size},(_,i)=>'<button type="button" data-cell="'+i+'">'+(blocked.has(i)?'×':'')+'</button>').join('')+'</div>';
 stage.onclick=e=>{const b=e.target.closest('[data-cell]');if(!b)return;const n=Number(b.dataset.cell);if(n===path[pos]){b.classList.add('is-path');pos++;stage.querySelector('.grid-hud span').textContent='PATH '+Math.min(pos+1,path.length)+' / '+path.length;if(pos===path.length)finish(setPassed,{mechanic:'grid',mistakes},'Path unlocked with '+mistakes+' mistakes.')}else{mistakes++;b.classList.add('is-wrong');stage.querySelector('.grid-hud strong').textContent=mistakes+' mistakes';setTimeout(()=>b.classList.remove('is-wrong'),300)}}
}
export function renderMechanicWorkspace(root,activity,setPassed){
 const kind=FLAGSHIP[String(activity?.id||'')];
 if(!kind)return false;
 if(kind==='reaction')renderReaction(root,activity,setPassed);
 else if(kind==='memory')renderMemory(root,activity,setPassed);
 else if(kind==='sequence')renderSequence(root,activity,setPassed);
 else if(kind==='decision')renderDecision(root,activity,setPassed);
 else if(kind==='assign')renderAssign(root,activity,setPassed);
 else if(kind==='grid')renderGrid(root,activity,setPassed);
 else return false;
 return true;
}
