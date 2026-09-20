import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { createCommunityTask } from './gamification/community-tasks.js?v=20260919-community5';
import { ACTIVITY_TYPES, activityTypeInfo } from './activity-ui.js';
import { ACTIVITY_CATALOG, getBuildConfig } from './activity-catalog.js?v=20260920-audit2';
import { mechanicInfo, mechanicsFor } from './forge-mechanics.js';
import { getInteractiveConfig, getChallengeRounds } from './forge-interactions.js?v=20260919-interactions3';
import { escapeHtml as esc } from './utils.js';
import { showToast } from './ui/toast.js';

const $ = id => document.getElementById(id);
const CREATE_LANES = ['build','learn','challenge','puzzle'];
const params = new URLSearchParams(location.search);
let me = null;
let profile = {};
let activeType = CREATE_LANES.includes(params.get('activity')) ? params.get('activity') : 'puzzle';
let selected = null;
let step = 1;
let interactionDraft = null;
let editorStage = 0;
let startChosen = false;
let quizCustomizerStage = 0;
let challengeRound = 0;

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

  if (template.type === 'build') {
    const cfg = getBuildConfig(template.id);
    if (!cfg) return null;
    return {
      kind: 'build',
      mechanic: cfg.mechanic,
      config: JSON.parse(JSON.stringify(cfg))
    };
  }

  if (template.type === 'challenge') {
    const rounds = getChallengeRounds(Number(template.id.replace(/\D/g, '')) || 0, 5);
    return {
      kind: 'challenge',
      rounds: rounds.map(r => ({ q: r.q, o: [...r.o], a: Number(r.a) || 0 }))
    };
  }

  const cfg = getInteractiveConfig(template.id);
  if (!cfg) return null;
  return {
    kind: 'quiz',
    question: cfg.question || '',
    options: [...(cfg.options || ['', '', '', ''])],
    correct: Number(cfg.correct) || 0,
    lesson: cfg.lesson || '',
    proofRequired: true,
    proofPrompt: activeType === 'learn'
      ? 'Explain the idea in your own words or give a small example.'
      : 'Show your reasoning. What clue, rule or step led you to this answer?'
  };
}

function blankInteraction(type) {
  if (type === 'build') return { kind:'build', mechanic:null, config:null };
  if (type === 'challenge') return { kind:'challenge', rounds:Array.from({length:5},()=>({q:'',o:['','','',''],a:0})) };
  if (type === 'learn') return { kind:'quiz', question:'', options:['','','',''], correct:0, lesson:'', proofRequired:true, proofPrompt:'Explain the idea in your own words or give a small example.' };
  return { kind:'quiz', question:'', options:['','','',''], correct:0, lesson:'', proofRequired:true, proofPrompt:'Show your reasoning. What clue, rule or step led you to this answer?' };
}

function ensureBuildConfig() {
  if (!interactionDraft || interactionDraft.kind !== 'build' || !interactionDraft.mechanic) return null;
  const m = interactionDraft.mechanic;
  if (m === 'order') interactionDraft.config ||= { items:['Step 1','Step 2','Step 3','Finish'] };
  if (m === 'allocate') interactionDraft.config ||= { budget:100, items:[['Core',30],['Support',20],['Backup',10],['Extra',5]] };
  if (m === 'grid') interactionDraft.config ||= { size:4, required:['Start','Work','Check'], blocked:[5,6,9] };
  if (m === 'assign') interactionDraft.config ||= { people:['Person 1','Person 2','Person 3','Person 4'], roles:['Planner','Builder','Checker','Presenter'], correct:{'Person 1':'Planner','Person 2':'Builder','Person 3':'Checker','Person 4':'Presenter'} };
  return interactionDraft.config;
}

function renderBuildCustomizer(host) {
  const d = interactionDraft?.kind === 'build' ? interactionDraft : (interactionDraft = blankInteraction('build'));
  const m = d.mechanic;
  let html = '<div class="creator-interaction-head"><div><span class="eyebrow">🛠️ Build</span><strong>Choose the way people will build</strong><small>Pick one working mechanic. We only open its controls after you choose it.</small></div><span>STEP '+(m ? '2 / 2' : '1 / 2')+'</span></div>';

  if (!m) {
    html += '<div class="creator-mechanic-grid">'+mechanicsFor('build').filter(x=>['order','grid','allocate','assign'].includes(x.id)).map(x =>
      '<button type="button" class="creator-mechanic-card" data-mechanic="'+esc(x.id)+'"><span class="creator-mechanic-icon">'+esc(x.icon)+'</span><strong>'+esc(x.label)+'</strong><small>'+esc(x.desc)+'</small><em>Choose →</em></button>'
    ).join('')+'</div>';
    host.innerHTML = html;
    host.querySelectorAll('[data-mechanic]').forEach(btn => btn.addEventListener('click', () => {
      d.mechanic = btn.dataset.mechanic;
      d.config = null;
      renderBuildCustomizer(host);
      renderPreview();
    }));
    return;
  }

  const c = ensureBuildConfig() || {};
  const mi = mechanicInfo('build', m);
  html += '<div class="creator-selected-mechanic"><span>'+esc(mi?.icon||'✦')+'</span><div><strong>'+esc(mi?.label||'Build')+'</strong><small>'+esc(mi?.desc||'')+'</small></div><button type="button" id="changeBuildMechanic" class="creator-mini-change">Change</button></div>';

  if(m==='order'){
    html += '<div class="creator-build-editor"><div class="creator-editor-title">Winning order</div><div class="creator-repeat-list">';
    c.items.forEach((v,i)=>{html+='<label><span>'+(i+1)+'</span><input maxlength="70" data-build-item="'+i+'" value="'+esc(v)+'" placeholder="Step '+(i+1)+'"></label>';});
    html += '</div><button type="button" class="creator-add-row" id="addBuildItem">+ Add step</button><small class="creator-interaction-note">Participants get these shuffled and must rebuild your exact order.</small></div>';
  } else if(m==='allocate'){
    html += '<div class="creator-build-editor"><div class="creator-inline-fields"><label><span>Total budget</span><input id="buildBudget" type="number" min="1" max="100000" value="'+Number(c.budget||100)+'"></label></div><div class="creator-repeat-list">';
    c.items.forEach((v,i)=>{html+='<label class="build-alloc-row"><span>'+(i+1)+'</span><input maxlength="50" data-build-name="'+i+'" value="'+esc(v[0])+'" placeholder="Category"><input type="number" min="1" max="100000" data-build-min="'+i+'" value="'+Number(v[1]||0)+'" aria-label="Minimum '+(i+1)+'"></label>';});
    html += '</div><button type="button" class="creator-add-row" id="addBuildAlloc">+ Add category</button><small class="creator-interaction-note">Every category needs its minimum, while the total stays within budget.</small></div>';
  } else if(m==='grid'){
    html += '<div class="creator-build-editor"><div class="creator-repeat-list">';
    c.required.forEach((v,i)=>{html+='<label><span>'+(i+1)+'</span><input maxlength="40" data-grid-name="'+i+'" value="'+esc(v)+'" placeholder="Zone '+(i+1)+'"></label>';});
    html += '</div><div class="creator-grid-editor"><span class="creator-editor-title">Tap cells to block</span><div class="creator-mini-grid">';
    for(let i=0;i<16;i++) html+='<button type="button" aria-label="Cell '+(i+1)+'" class="'+(c.blocked.includes(i)?'blocked':'')+'" data-block-cell="'+i+'">'+(i+1)+'</button>';
    html += '</div></div><small class="creator-interaction-note">Keep enough cells open for every zone and keep the first zones connected.</small></div>';
  } else if(m==='assign'){
    html += '<div class="creator-build-editor"><div class="creator-repeat-list">';
    c.people.forEach((p,i)=>{const role=c.correct[p]||c.roles[i]||''; html+='<div class="creator-assign-editor"><input maxlength="40" data-person-name="'+i+'" value="'+esc(p)+'" placeholder="Person '+(i+1)+'"><select data-person-role="'+i+'">'+c.roles.map(r=>'<option '+(role===r?'selected':'')+'>'+esc(r)+'</option>').join('')+'</select></div>';});
    html += '</div><div class="creator-repeat-list creator-role-edit">';
    c.roles.forEach((r,i)=>html+='<label><span>'+(i+1)+'</span><input maxlength="40" data-role-name="'+i+'" value="'+esc(r)+'" placeholder="Role '+(i+1)+'"></label>');
    html += '</div><small class="creator-interaction-note">Set one role per person. Every role must be used exactly once.</small></div>';
  }

  host.innerHTML=html;
  host.querySelector('#changeBuildMechanic')?.addEventListener('click',()=>{d.mechanic=null;d.config=null;renderBuildCustomizer(host);renderPreview();});
  host.querySelectorAll('[data-build-item]').forEach(el=>el.addEventListener('input',()=>{c.items[Number(el.dataset.buildItem)]=el.value;renderPreview();}));
  host.querySelector('#addBuildItem')?.addEventListener('click',()=>{if(c.items.length<8)c.items.push('New step');renderBuildCustomizer(host);});
  host.querySelector('#buildBudget')?.addEventListener('input',e=>{c.budget=Math.max(1,Number(e.target.value)||1);renderPreview();});
  host.querySelectorAll('[data-build-name]').forEach(el=>el.addEventListener('input',()=>{c.items[Number(el.dataset.buildName)][0]=el.value;renderPreview();}));
  host.querySelectorAll('[data-build-min]').forEach(el=>el.addEventListener('input',()=>{c.items[Number(el.dataset.buildMin)][1]=Math.max(0,Number(el.value)||0);renderPreview();}));
  host.querySelector('#addBuildAlloc')?.addEventListener('click',()=>{if(c.items.length<8)c.items.push(['New category',1]);renderBuildCustomizer(host);});
  host.querySelectorAll('[data-grid-name]').forEach(el=>el.addEventListener('input',()=>{c.required[Number(el.dataset.gridName)]=el.value;renderPreview();}));
  host.querySelectorAll('[data-block-cell]').forEach(el=>el.addEventListener('click',()=>{const i=Number(el.dataset.blockCell);c.blocked=c.blocked.includes(i)?c.blocked.filter(x=>x!==i):[...c.blocked,i];renderBuildCustomizer(host);renderPreview();}));
  host.querySelectorAll('[data-person-name]').forEach(el=>el.addEventListener('input',()=>{
    const i=Number(el.dataset.personName), oldName=c.people[i], newName=el.value;
    if(Object.prototype.hasOwnProperty.call(c.correct,oldName)){c.correct[newName]=c.correct[oldName];delete c.correct[oldName];}
    c.people[i]=newName;renderPreview();
  }));
  host.querySelectorAll('[data-role-name]').forEach(el=>el.addEventListener('input',()=>{
    const i=Number(el.dataset.roleName), oldRole=c.roles[i], newRole=el.value;
    Object.keys(c.correct).forEach(p=>{if(c.correct[p]===oldRole)c.correct[p]=newRole;});
    c.roles[i]=newRole;renderPreview();
  }));
  host.querySelectorAll('[data-person-role]').forEach(el=>el.addEventListener('change',()=>{const i=Number(el.dataset.personRole);c.correct[c.people[i]]=el.value;renderPreview();}));
}

function renderChallengeCustomizer(host){
  if(!interactionDraft || interactionDraft.kind!=='challenge') interactionDraft=blankInteraction('challenge');
  const d=interactionDraft;
  challengeRound=Math.max(0,Math.min(4,challengeRound));
  const r=d.rounds[challengeRound];

  let html='<div class="creator-interaction-head"><div><span class="eyebrow">⚡ Challenge</span><strong>Build the challenge one round at a time</strong><small>Five rounds, four choices each. Nothing else is shown until you move forward.</small></div><span>'+String(challengeRound+1)+' / 5</span></div>';
  html+='<div class="creator-round-progress">'+d.rounds.map((_,i)=>'<button type="button" class="'+(i===challengeRound?'active':'')+'" data-round-jump="'+i+'">'+(i+1)+'</button>').join('')+'</div>';
  html+='<article class="creator-round-card creator-round-card--focus"><div class="creator-round-head"><strong>Round '+(challengeRound+1)+'</strong><button type="button" data-clear-round="'+challengeRound+'">Clear</button></div>';
  html+='<textarea maxlength="240" data-round-q rows="3" placeholder="Write the question or prompt">'+esc(r.q)+'</textarea><div class="creator-answer-grid">';
  [0,1,2,3].forEach(j=>html+='<label class="creator-answer-row"><span>'+String.fromCharCode(65+j)+'</span><input maxlength="160" data-round-o="'+j+'" value="'+esc(r.o[j]||'')+'" placeholder="Answer '+String.fromCharCode(65+j)+'"></label>');
  html+='</div><div class="creator-correct-row"><span>Correct answer</span><div>'+[0,1,2,3].map(j=>'<button type="button" class="creator-correct '+(r.a===j?'selected':'')+'" data-round-a="'+j+'">'+String.fromCharCode(65+j)+'</button>').join('')+'</div></div></article>';
  html+='<div class="creator-round-nav"><button type="button" class="nkm-btn" id="prevRound" '+(challengeRound===0?'disabled':'')+'>← Previous</button><button type="button" class="nkm-btn nkm-btn--secondary" id="nextRound" '+(challengeRound===4?'disabled':'')+'>'+ (challengeRound===4?'All rounds':'Next round →')+'</button></div>';
  host.innerHTML=html;

  host.querySelectorAll('[data-round-jump]').forEach(el=>el.addEventListener('click',()=>{challengeRound=Number(el.dataset.roundJump);renderChallengeCustomizer(host);}));
  host.querySelector('[data-round-q]')?.addEventListener('input',e=>{r.q=e.target.value;renderPreview();});
  host.querySelectorAll('[data-round-o]').forEach(el=>el.addEventListener('input',e=>{r.o[Number(el.dataset.roundO)]=e.target.value;renderPreview();}));
  host.querySelectorAll('[data-round-a]').forEach(el=>el.addEventListener('click',()=>{r.a=Number(el.dataset.roundA);renderChallengeCustomizer(host);renderPreview();}));
  host.querySelector('[data-clear-round]')?.addEventListener('click',()=>{d.rounds[challengeRound]={q:'',o:['','','',''],a:0};renderChallengeCustomizer(host);renderPreview();});
  host.querySelector('#prevRound')?.addEventListener('click',()=>{challengeRound=Math.max(0,challengeRound-1);renderChallengeCustomizer(host);});
  host.querySelector('#nextRound')?.addEventListener('click',()=>{challengeRound=Math.min(4,challengeRound+1);renderChallengeCustomizer(host);});
}

function renderQuizCustomizer(host){
  if(!interactionDraft || interactionDraft.kind!=='quiz') interactionDraft=sourceConfig(selected)||blankInteraction(activeType);
  const d=interactionDraft;
  quizCustomizerStage=Math.max(0,Math.min(2,quizCustomizerStage));
  const info=ACTIVITY_TYPES[activeType];
  let html='<div class="creator-interaction-head"><div><span class="eyebrow">'+info.icon+' '+info.label+'</span><strong>'+(['Write the question','Set the answer choices','Ask for reasoning'][quizCustomizerStage])+'</strong><small>One small part at a time. Your previous work stays saved.</small></div><span>'+String(quizCustomizerStage+1)+' / 3</span></div>';

  if(quizCustomizerStage===0){
    if(activeType==='learn') html+='<label class="creator-field"><span>Mini lesson</span><textarea id="interactionLesson" maxlength="900" rows="5" placeholder="Teach the idea in a few simple lines.">'+esc(d.lesson||'')+'</textarea></label>';
    html+='<label class="creator-field"><span>Question</span><textarea id="interactionQuestion" maxlength="500" rows="4" placeholder="What should people solve?">'+esc(d.question||'')+'</textarea></label><div class="creator-stage-tip">Keep it specific enough that there is one clear best answer.</div>';
  } else if(quizCustomizerStage===1){
    html+='<div class="creator-answer-grid creator-answer-grid--large">';
    [0,1,2,3].forEach(i=>html+='<label class="creator-answer-row"><span>'+String.fromCharCode(65+i)+'</span><input data-answer-index="'+i+'" maxlength="180" value="'+esc(d.options[i]||'')+'" placeholder="Answer '+String.fromCharCode(65+i)+'"></label>');
    html+='</div><div class="creator-correct-row"><span>Which one is correct?</span><div>'+[0,1,2,3].map(i=>'<button type="button" class="creator-correct '+(d.correct===i?'selected':'')+'" data-correct="'+i+'">'+String.fromCharCode(65+i)+'</button>').join('')+'</div></div>';
  } else {
    html+='<label class="creator-field"><span>Reasoning prompt</span><input id="proofPrompt" maxlength="240" value="'+esc(d.proofPrompt||'')+'" placeholder="'+(activeType==='learn'?'Ask for a simple explanation or example.':'Ask what clue or rule led to the answer.')+'"></label>';
    html+='<div class="creator-stage-summary"><strong>Completion rule</strong><span>Correct answer + a short explanation.</span></div>';
  }

  host.innerHTML=html;
  $('interactionQuestion')?.addEventListener('input',e=>{d.question=e.target.value;renderPreview();});
  $('proofPrompt')?.addEventListener('input',e=>{d.proofPrompt=e.target.value;renderPreview();});
  $('interactionLesson')?.addEventListener('input',e=>{d.lesson=e.target.value;renderPreview();});
  host.querySelectorAll('[data-answer-index]').forEach(input=>input.addEventListener('input',e=>{d.options[Number(input.dataset.answerIndex)]=e.target.value;renderPreview();}));
  host.querySelectorAll('[data-correct]').forEach(btn=>btn.addEventListener('click',()=>{d.correct=Number(btn.dataset.correct);host.querySelectorAll('[data-correct]').forEach(x=>x.classList.toggle('selected',x===btn));renderPreview();}));
}

function setEditorStage(next){
  editorStage=Math.max(0,Math.min(3,next));
  document.querySelectorAll('[data-editor-stage]').forEach(panel=>{panel.hidden=Number(panel.dataset.editorStage)!==editorStage;});
  const hints=[
    'Start with a ready idea or a genuinely blank canvas.',
    'Give the activity a clear name, purpose and finish line.',
    'Choose how people will interact, then add only the content needed.',
    'Set a few optional details. The defaults are safe to keep.'
  ];
  const hint=$('creatorStageHint'); if(hint) hint.textContent=hints[editorStage];
  const back=$('creatorStageBack'), nextBtn=$('creatorStageNext'), back1=$('backStep1');
  if(back1) back1.hidden=editorStage!==0;
  if(back) back.hidden=editorStage===0;
  if(nextBtn) nextBtn.textContent=editorStage===3?'Review preview →':editorStage===0?'Use this idea →':'Continue →';
  if(editorStage===2){
    if(activeType==='quiz' || activeType==='puzzle' || activeType==='learn') {
      nextBtn.textContent=quizCustomizerStage<2?'Next section →':'Continue →';
    }
  }
  renderPreview();
}

function setStep(next, options={}){
  step=Math.max(1,Math.min(3,next));
  document.querySelectorAll('[data-wizard-step]').forEach(panel=>{panel.hidden=Number(panel.dataset.wizardStep)!==step;});
  document.querySelectorAll('[data-step]').forEach(btn=>{const n=Number(btn.dataset.step);btn.classList.toggle('active',n<=step);btn.classList.toggle('current',n===step);});
  if(step===2){
    if(Number.isInteger(options.stage)) setEditorStage(options.stage);
    else setEditorStage(0);
  }
  renderPreview();
  window.scrollTo({top:0,behavior:'smooth'});
}

function resetLaneDraft(){
  const base=defaults[activeType]||defaults.game;
  ['title','description'].forEach(id=>{if($(id))$(id).value='';});
  if($('goal'))$('goal').value=base.goal||'';
  if($('durationMin'))$('durationMin').value=String(base.duration||20);
  if($('difficulty'))$('difficulty').value=base.difficulty||'Medium';
  if($('category'))$('category').value='';
  if($('instructions'))$('instructions').value='';
  if($('expiresDays'))$('expiresDays').value='14';
  document.querySelectorAll('#title,#description,#goal').forEach(el=>el.dataset.seeded='false');
}
function renderLanes() {
  const host = $('creatorLanes'); if(!host)return;
  host.innerHTML = CREATE_LANES.map(type => { const info=ACTIVITY_TYPES[type]; return
    '<button type="button" class="creator-lane-card creator-lane-card--'+info.tone+' '+(type===activeType?'selected':'')+'" data-lane="'+esc(type)+'"><span class="creator-lane-art">'+esc(info.icon)+'</span><span class="creator-lane-copy"><strong>'+esc(info.label)+'</strong><small>'+esc(info.desc)+'</small></span><span class="creator-lane-arrow">→</span></button>';
}).join('');
  host.querySelectorAll('[data-lane]').forEach(btn=>btn.addEventListener('click',()=>{
    activeType=btn.dataset.lane;
    selected=null;
    startChosen=false;
    interactionDraft=null;
    quizCustomizerStage=0;challengeRound=0;
    resetLaneDraft();
    renderLanes();renderTemplates();renderInteractionEditor();setEditorStage(0);renderPreview();
  }));
}

function renderTemplates() {
  const host=$('creatorTemplates'); if(!host)return;
  const list=starters();
  const blankCard='<button type="button" class="creator-starter creator-starter--blank '+(!startChosen?'selected':'')+'" data-blank="true"><span class="creator-starter-icon">✦</span><span class="creator-starter-main"><strong>Blank canvas</strong><small>Start from zero. You decide the idea, rules and wording.</small><span class="creator-starter-foot"><em>FULL CONTROL</em><em>∞</em></span></span><span class="creator-starter-go">'+(startChosen&& !selected?'✓':'＋')+'</span></button>';
  host.innerHTML=blankCard+list.map(t=>{
    const mechanic=mechanicInfo(activeType,t.mechanic);
    return '<button type="button" class="creator-starter '+(selected?.id===t.id?'selected':'')+'" data-starter="'+esc(t.id)+'"><span class="creator-starter-icon">'+esc(t.icon||activityTypeInfo(t).icon)+'</span><span class="creator-starter-main"><strong>'+esc(t.title)+'</strong><small>'+esc(t.description||'')+'</small><span class="creator-starter-foot"><em>'+(mechanic?esc(mechanic.label):'Ready')+'</em><em>⏱ '+Number(t.durationMin||20)+'m</em></span></span><span class="creator-starter-go">→</span></button>';
  }).join('');

  host.querySelector('[data-blank]')?.addEventListener('click',()=>{
    selected=null;startChosen=true;interactionDraft=blankInteraction(activeType);
    resetLaneDraft();
    renderTemplates();renderInteractionEditor();setEditorStage(1);renderPreview();
  });
  host.querySelectorAll('[data-starter]').forEach(btn=>btn.addEventListener('click',()=>{
    selected=list.find(x=>x.id===btn.dataset.starter)||null;
    startChosen=true;
    interactionDraft=sourceConfig(selected);
    buildCustomizerStage=0;quizCustomizerStage=0;challengeRound=0;
    fillFormFromStarter(true);
    renderTemplates();renderInteractionEditor();setEditorStage(1);renderPreview();
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

function renderInteractionEditor(){
  const host=$('customInteraction'); if(!host)return;
  if(activeType==='build'){
    if(!interactionDraft || interactionDraft.kind!=='build') interactionDraft=sourceConfig(selected)||blankInteraction('build');
    renderBuildCustomizer(host); return;
  }
  if(activeType==='challenge'){
    if(!interactionDraft || interactionDraft.kind!=='challenge') interactionDraft=sourceConfig(selected)||blankInteraction('challenge');
    renderChallengeCustomizer(host); return;
  }
  if(activeType==='puzzle' || activeType==='learn'){
    if(!interactionDraft || interactionDraft.kind!=='quiz') interactionDraft=sourceConfig(selected)||blankInteraction(activeType);
    renderQuizCustomizer(host); return;
  }
  interactionDraft={kind:'room'};
  host.innerHTML='<div class="creator-interaction-head"><div><span class="eyebrow">🎮 Game</span><strong>Made for a live room</strong><small>Players join a room and complete the shared game together.</small></div><span>ROOM PLAY</span></div><div class="creator-stage-summary"><strong>No complex setup</strong><span>Give the game a clear goal and Trio Day handles the room flow.</span></div>';
}
function interactionPayload() {
  if(!interactionDraft) return {kind:activeType==='game'?'room':activeType};
  if(interactionDraft.kind==='build'){
    const c=interactionDraft.config||{};
    if(interactionDraft.mechanic==='order') return {kind:'build',mechanic:'order',items:(c.items||[]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,8)};
    if(interactionDraft.mechanic==='allocate') return {kind:'build',mechanic:'allocate',budget:Number(c.budget)||100,items:(c.items||[]).slice(0,8).map(x=>[String(x[0]||'').trim().slice(0,50),Math.max(0,Number(x[1])||0)])};
    if(interactionDraft.mechanic==='grid') return {kind:'build',mechanic:'grid',size:4,required:(c.required||[]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,4),blocked:[...(c.blocked||[])].filter(x=>Number.isInteger(x)&&x>=0&&x<16).slice(0,8),adjacentPairs:(c.required||[]).length>=2?[[String(c.required[0]),String(c.required[1])],...(((c.required||[]).length>=3)?[[String(c.required[1]),String(c.required[2])]]:[])]:[]};
    if(interactionDraft.mechanic==='assign') return {kind:'build',mechanic:'assign',people:(c.people||[]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,4),roles:(c.roles||[]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,4),correct:{...(c.correct||{})}};
  }
  if(interactionDraft.kind==='challenge') return {kind:'challenge',rounds:(interactionDraft.rounds||[]).slice(0,5).map(r=>({q:String(r.q||'').trim().slice(0,240),o:r.o.slice(0,4).map(x=>String(x||'').trim().slice(0,160)),a:Math.max(0,Math.min(3,Number(r.a)||0))}))};
  if(interactionDraft.kind!=='quiz') return {...interactionDraft};
  return {kind:'quiz',question:String(interactionDraft.question||'').trim().slice(0,500),options:interactionDraft.options.map(x=>String(x||'').trim().slice(0,180)),correct:Number(interactionDraft.correct)||0,lesson:String(interactionDraft.lesson||'').trim().slice(0,900),proofRequired:true,proofPrompt:String(interactionDraft.proofPrompt||'').trim().slice(0,240)};
}
function validateBeforePreview() {
  const title = $('title').value.trim();
  const desc = $('description').value.trim();
  const goal = $('goal').value.trim();
  if (title.length < 3) return 'Give the activity a clear name.';
  if (desc.length < 10) return 'Tell people what they are going to do.';
  if (goal.length < 5) return 'Add a simple goal.';
  if (activeType === 'build') {
    const d=interactionPayload();
    if (!['order','allocate','grid','assign'].includes(d.mechanic)) return 'Choose how people will build.';
    if (d.mechanic==='order') {
      if (d.items.length<3 || d.items.length>8 || d.items.some(x=>x.length<1)) return 'Add 3–8 clear build steps.';
      if (new Set(d.items.map(x=>x.toLowerCase())).size !== d.items.length) return 'Make every build step unique so the solution is unambiguous.';
    }
    if (d.mechanic==='allocate') {
      const names=d.items.map(x=>x[0].toLowerCase());
      const mins=d.items.map(x=>Number(x[1])||0);
      if (d.items.length<2 || d.items.length>8 || d.items.some(x=>!x[0])) return 'Add 2–8 budget categories.';
      if (new Set(names).size !== names.length) return 'Make every budget category unique.';
      if (mins.some(v=>v<=0)) return 'Give every required budget category a positive minimum.';
      if (mins.reduce((sum,v)=>sum+v,0) > Number(d.budget||0)) return 'Minimums cannot be higher than the budget.';
    }
    if (d.mechanic==='grid') {
      if (d.required.length<2 || d.required.length>4) return 'Add 2–4 named zones.';
      if (new Set(d.required.map(x=>x.toLowerCase())).size !== d.required.length) return 'Make every grid zone unique.';
      if (d.blocked.length >= 13) return 'Leave enough open cells for the required zones.';
      const size=4, blocked=new Set(d.blocked), req=d.required;
      const adjacent=(a,b)=>Math.abs(a-b)===1&&Math.floor(a/size)===Math.floor(b/size)||Math.abs(a-b)===size;
      const cells=[...Array(16).keys()].filter(i=>!blocked.has(i));
      const used=new Set();
      let possible=false;
      const walk=(i,last)=>{
        if(i===req.length){possible=true;return;}
        for(const cell of cells){
          if(used.has(cell))continue;
          if(i>0 && !adjacent(last,cell))continue;
          used.add(cell);walk(i+1,cell);used.delete(cell);
          if(possible)return;
        }
      };
      walk(0,-1);
      if(!possible) return 'This grid has no valid solution. Unblock some cells or change the zones.';
    }
    if (d.mechanic==='assign') {
      const people=d.people.map(x=>x.toLowerCase()), roles=d.roles.map(x=>x.toLowerCase()), mapped=d.people.map(p=>String(d.correct[p]||'').toLowerCase());
      if (d.people.length!==4 || d.roles.length!==4 || new Set(people).size!==4 || new Set(roles).size!==4) return 'Use four unique people and four unique roles.';
      if (mapped.some(x=>!x) || mapped.some(x=>!roles.includes(x)) || new Set(mapped).size!==4) return 'Assign each unique role exactly once.';
    }
  }
  if (activeType === 'challenge') {
    const d=interactionPayload(), rounds=d.rounds||[];
    if(rounds.length!==5) return 'Create all 5 challenge rounds.';
    if(new Set(rounds.map(r=>r.q.toLowerCase())).size!==5) return 'Make all five challenge questions different.';
    for(let i=0;i<rounds.length;i++){
      if(rounds[i].q.length<8)return 'Add a question for round '+(i+1)+'.';
      if(rounds[i].o.length!==4 || rounds[i].o.some(x=>x.length<1))return 'Fill all four answers for round '+(i+1)+'.';
      if(new Set(rounds[i].o.map(x=>x.toLowerCase())).size!==4)return 'Make the answers different in round '+(i+1)+'.';
      if(rounds[i].a<0||rounds[i].a>3)return 'Choose the correct answer for round '+(i+1)+'.';
    }
  }
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
  const template = selected || null;
  const title = $('title')?.value.trim() || template?.title || 'Your activity';
  const desc = $('description')?.value.trim() || template?.description || type.desc;
  const canvas=$('creatorCanvasVisual');
  if(canvas){
    canvas.dataset.tone=type.tone;
    const icon=$('creatorCanvasIcon'), titleEl=$('creatorCanvasTitle'), metaEl=$('creatorCanvasMeta');
    if(icon)icon.textContent=type.icon;
    if(titleEl)titleEl.textContent=title;
    if(metaEl)metaEl.textContent=(selected?'Starter adapted':'Blank canvas')+' · '+type.label;
  }
  const mechanic = activeType === 'build'
    ? mechanicInfo('build', interactionDraft?.mechanic || currentMechanic())
    : mechanicInfo(activeType, selected?.mechanic);
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

function validateBasicsOnly(){
  const title=$('title')?.value.trim()||'', desc=$('description')?.value.trim()||'', goal=$('goal')?.value.trim()||'';
  if(title.length<3)return 'Give the activity a clear name first.';
  if(desc.length<10)return 'Describe what people will actually do.';
  if(goal.length<5)return 'Add a simple finish line.';
  return null;
}

function previewInteractionMarkup(){
  const type=ACTIVITY_TYPES[activeType], d=interactionDraft||{};
  if(activeType==='puzzle'||activeType==='learn'){
    const lesson=activeType==='learn'&&d.lesson?'<div class="preview-mini-lesson">'+esc(d.lesson)+'</div>':'';
    return lesson+'<div class="preview-mini-question">'+esc(d.question||'Your question will appear here.')+'</div><div class="preview-mini-options">'+(d.options||['Answer A','Answer B','Answer C','Answer D']).map((o,i)=>'<button type="button" data-preview-answer="'+i+'">'+esc(o||'Answer '+String.fromCharCode(65+i))+'</button>').join('')+'</div><div id="previewInteractionResult" class="preview-interaction-result">Pick an answer to test the interaction.</div>';
  }
  if(activeType==='challenge'){
    const rounds=d.rounds||[], round=rounds[challengeRound]||rounds[0]||{q:'Your challenge question',o:['A','B','C','D'],a:0};
    return '<div class="preview-round-label">ROUND '+(challengeRound+1)+' / 5</div><div class="preview-mini-question">'+esc(round.q||'Your challenge question')+'</div><div class="preview-mini-options">'+(round.o||[]).map((o,i)=>'<button type="button" data-preview-answer="'+i+'">'+esc(o||'Answer')+'</button>').join('')+'</div><div id="previewInteractionResult" class="preview-interaction-result">This is a live feel-test, not a saved response.</div>';
  }
  if(activeType==='build'){
    const m=d.mechanic||'order', c=d.config||{};
    if(m==='order') return '<div class="preview-build-label">FLOW</div><div class="preview-build-items">'+(c.items||['Step 1','Step 2','Step 3']).map((x,i)=>'<span><b>'+(i+1)+'</b>'+esc(x)+'</span>').join('')+'</div>';
    if(m==='allocate') return '<div class="preview-build-label">BUDGET</div><div class="preview-build-budget"><strong>'+Number(c.budget||100)+'</strong><span>Total budget</span></div><div class="preview-build-items">'+(c.items||[]).map(x=>'<span><b>+</b>'+esc(x[0])+ '<small>min '+Number(x[1]||0)+'</small></span>').join('')+'</div>';
    if(m==='grid') return '<div class="preview-build-label">GRID</div><div class="preview-mini-grid">'+[...Array(16).keys()].map(i=>'<i class="'+((c.blocked||[]).includes(i)?'blocked':'')+'">'+(i+1)+'</i>').join('')+'</div>';
    if(m==='assign') return '<div class="preview-build-label">ROLES</div><div class="preview-build-items">'+(c.people||[]).map((x,i)=>'<span><b>◎</b>'+esc(x)+'<small>'+esc(c.correct?.[x]||c.roles?.[i]||'Role')+'</small></span>').join('')+'</div>';
  }
  return '<div class="preview-game-state"><span>LIVE ROOM</span><strong>Players join a shared room.</strong><small>Your published game starts here.</small></div>';
}

function openCreatorPreview(){
  const modal=$('creatorPreviewModal'), body=$('creatorPreviewModalBody');
  if(!modal||!body)return;
  const type=ACTIVITY_TYPES[activeType], title=$('title')?.value.trim()||'Your activity';
  const desc=$('description')?.value.trim()||type.desc;
  const goal=$('goal')?.value.trim()||defaults[activeType].goal;
  $('creatorPreviewModalTitle').textContent=title;
  body.innerHTML='<div class="preview-modal-hero"><span class="preview-modal-icon">'+esc(type.icon)+'</span><div><span>'+esc(type.label)+'</span><h3>'+esc(title)+'</h3><p>'+esc(desc)+'</p></div></div><div class="preview-modal-goal"><strong>Goal</strong><span>'+esc(goal)+'</span></div><div class="preview-modal-interaction"><div class="preview-modal-kicker">INTERACTION</div>'+previewInteractionMarkup()+'</div>';
  modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('preview-open');
  const close=()=>{modal.hidden=true;modal.setAttribute('aria-hidden','true');document.body.classList.remove('preview-open');};
  modal.querySelectorAll('[data-preview-close]').forEach(el=>{el.onclick=close;});
  modal.querySelectorAll('[data-preview-answer]').forEach(btn=>btn.addEventListener('click',()=>{
    const picked=Number(btn.dataset.previewAnswer);
    const correct=Number((activeType==='challenge'?(interactionDraft?.rounds?.[challengeRound]||{}):interactionDraft||{}).correct ?? (activeType==='challenge'?(interactionDraft?.rounds?.[challengeRound]||{}).a:0));
    const result=modal.querySelector('#previewInteractionResult');
    if(!result)return;
    result.textContent=picked===correct?'Looks good ✓ Correct option responds.':'That is how a wrong choice will feel.';
    result.className='preview-interaction-result '+(picked===correct?'ok':'bad');
  }));
}

$('toStep2')?.addEventListener('click',()=>{
  if(!startChosen)return showToast('Choose a starter or Blank canvas first.','warn');
  setStep(2,{stage:0});
});
$('backStep1')?.addEventListener('click',()=>setStep(1));
$('creatorStageNext')?.addEventListener('click',()=>{
  if(editorStage===0){
    if(!startChosen)return showToast('Choose a starter or Blank canvas first.','warn');
    setEditorStage(1); return;
  }
  if(editorStage===1){
    const error=validateBasicsOnly();
    if(error)return showToast(error,'warn');
    setEditorStage(2);
    if(!interactionDraft)interactionDraft=blankInteraction(activeType);
    quizCustomizerStage=0; challengeRound=0; renderInteractionEditor(); return;
  }
  if(editorStage===2){
    if((activeType==='puzzle'||activeType==='learn') && quizCustomizerStage<2){
      quizCustomizerStage+=1;renderInteractionEditor();return;
    }
    const error=validateBeforePreview();
    if(error)return showToast(error,'warn');
    setEditorStage(3);return;
  }
  const error=validateBeforePreview();
  if(error)return showToast(error,'warn');
  setStep(3);
});
$('creatorStageBack')?.addEventListener('click',()=>{
  if(editorStage===2){
    if((activeType==='puzzle'||activeType==='learn') && quizCustomizerStage>0){quizCustomizerStage-=1;renderInteractionEditor();return;}
    setEditorStage(1);return;
  }
  if(editorStage>0){setEditorStage(editorStage-1);return;}
  setStep(1);
});
$('backStep2')?.addEventListener('click',()=>setStep(2,{stage:3}));
$('openCreatorPreview')?.addEventListener('click',openCreatorPreview);
document.querySelectorAll('[data-step]').forEach(btn=>btn.addEventListener('click',()=>{
  const target=Number(btn.dataset.step);
  if(target<step)setStep(target);
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
  selected = null;
  startChosen = false;
  interactionDraft = null;
  editorStage = 0;
  quizCustomizerStage = 0;
  challengeRound = 0;
  resetLaneDraft();
  renderLanes();
  renderTemplates();
  renderInteractionEditor();
  setStep(1);
});