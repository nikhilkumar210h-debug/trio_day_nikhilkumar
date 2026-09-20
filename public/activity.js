import{auth,db}from'./firebase-init.js';
import{onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import{doc,getDoc,setDoc}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import{activeCatalogActivities}from'./activity-catalog.js?v=20260919-catalog4';
import{activityTypeInfo}from'./activity-ui.js';
import{renderBuildWorkspace}from'./forge-engine.js?v=20260919-engine4';
import{getInteractiveConfig,getChallengeRounds}from'./forge-interactions.js?v=20260919-interactions3';
import{completeTask as completeCommunityTask}from'./gamification/community-tasks.js?v=20260919-community5';
import{awardXp}from'./gamification/xp-levels.js';
import{showAchievement}from'./ui/achievements.js';
import{escapeHtml as esc}from'./utils.js';

const params=new URLSearchParams(location.search);
const id=params.get('id');
const source=params.get('source')||'catalog';
const $=id=>document.getElementById(id);
let me=null,profile=null,activity=null,timer=null,remaining=0,timerEndsAt=0,activityPassed=false,activityEvidence=null;

function fail(t){$('activityStatus').textContent=t;$('activityStatus').classList.add('error')}
function setPassed(v,evidence=null){
  activityPassed=!!v;
  if(evidence){
    // Community build completion rules expect { buildEvidence: { mechanic, state } }.
    activityEvidence = evidence.mechanic
      ? { buildEvidence: evidence }
      : evidence;
  }
  updateCompleteState();
  if(v) markWorkspacePassed();
}
function markWorkspacePassed(){
  const workspace=$('forgeWorkspace');
  if(workspace) workspace.classList.add('forge-workspace--complete');
}
function showCompletion({already=false,xp=0,level='—'}={}){
  const panel=$('activityCompletion');
  if(!panel)return;
  panel.hidden=false;
  $('completionIcon').textContent=already?'✓':'✓';
  $('completionTitle').textContent=already?'Already completed':'Activity complete';
  $('completionText').textContent=already?'This activity cycle is already saved on your profile.':'Saved to your activity history. Nice work.';
  $('completionXp').textContent='+'+Number(xp||0);
  $('completionLevel').textContent=level||'—';
  $('completionContinue').onclick=()=>{location.href='all-users.html'};
  panel.scrollIntoView({behavior:'smooth',block:'center'});
}

function renderQuizWorkspace(root,cfg,isLesson){
 const normalized={
   question:String(cfg?.question||''),
   options:Array.isArray(cfg?.options)?cfg.options.slice(0,4):[],
   correct:Number(cfg?.correct)||0,
   lesson:String(cfg?.lesson||''),
   proofRequired:cfg?.proofRequired!==false,
   proofPrompt:String(cfg?.proofPrompt||(isLesson?'Explain the idea in your own words or give a small example.':'Show your reasoning. What clue, rule or step led you to this answer?'))
 };
 root.hidden=false;
 let chosen=false;
 function paint(){
   root.innerHTML=
     '<div class="forge-workspace-head"><div><h3>'+ (isLesson?'Learn + prove it':'Solve + show your work') +'</h3><p>'+ (isLesson?'Understand the idea, answer the check, then explain it in your own words.':'Choose an answer, then give a short reason so your work can be checked.') +'</p></div><span class="forge-pill">'+(isLesson?'LEARN':'PUZZLE')+'</span></div>'+
     (isLesson?'<div class="forge-lesson">'+esc(normalized.lesson||'Learn the key idea, then test your understanding.')+'</div>':'')+
     '<div class="forge-quiz"><div class="forge-quiz-question">'+esc(normalized.question)+'</div><div class="forge-quiz-options">'+normalized.options.map((o,i)=>'<button type="button" class="forge-option" data-answer="'+i+'">'+esc(o)+'</button>').join('')+'</div></div>'+
     '<div class="forge-result"></div><div class="forge-proof" hidden><label class="forge-proof-label">'+esc(normalized.proofPrompt)+'</label><textarea id="forgeProof" maxlength="500" rows="4" placeholder="'+(isLesson?'Explain the concept or give an example…':'Write the clue, rule or steps that justify your answer…')+'"></textarea><div class="forge-proof-footer"><span id="forgeProofCount">0 / 500</span><button type="button" class="forge-check" id="verifyProof">Check my work</button></div></div>';
   const result=root.querySelector('.forge-result');
   const proof=root.querySelector('.forge-proof');
   const proofInput=root.querySelector('#forgeProof');
   const proofCount=root.querySelector('#forgeProofCount');

   root.querySelectorAll('[data-answer]').forEach(btn=>btn.onclick=()=>{
     const selectedAnswer=Number(btn.dataset.answer);
     root.querySelectorAll('[data-answer]').forEach(x=>x.classList.remove('wrong','correct'));
     root.querySelectorAll('[data-answer]').forEach(x=>x.disabled=true);
     chosen=selectedAnswer===normalized.correct;
     if(chosen){
       activityEvidence={answerIndex:selectedAnswer,proofText:''};
       btn.classList.add('correct');
       result.textContent=isLesson?'Correct. Now explain the idea.':'Correct. Now show why it is correct.';
       result.className='forge-result ok';
       if(normalized.proofRequired){
         proof.hidden=false;
         proofInput?.focus();
       }else{
         setPassed(true);
       }
     }else{
       btn.classList.add('wrong');
       result.textContent='Not quite. Try another option.';
       result.className='forge-result bad';
       root.querySelectorAll('[data-answer]').forEach(x=>x.disabled=false);
     }
   });

   proofInput?.addEventListener('input',()=>{
     if(proofCount) proofCount.textContent=proofInput.value.trim().length+' / 500';
   });
   root.querySelector('#verifyProof')?.addEventListener('click',()=>{
     const proofText=proofInput.value.trim();
     if(!chosen) return;
     if(activityEvidence) activityEvidence.proofText=proofText;
     if(proofText.length<20 || proofText.split(/\s+/).filter(Boolean).length<4){
       result.textContent='Add a little more reasoning (at least 20 characters).';
       result.className='forge-result bad';
       proofInput.focus();
       return;
     }
     result.textContent='Work checked. Activity complete.';
     result.className='forge-result ok';
     setPassed(true);
   });
 }
 paint();
}
function renderChallengeWorkspace(root){
 const customRounds=Array.isArray(activity.interaction?.rounds) && activity.interaction.rounds.length===5
   ? activity.interaction.rounds.map(r=>({q:String(r.q||''),o:Array.isArray(r.o)?r.o.slice(0,4):[],a:Number(r.a)||0}))
   : null;
 const rounds=customRounds || getChallengeRounds((Number(String(activity.engineId||activity.id).replace(/\\D/g,''))||0)%10,5);
 let idx=0,score=0;
 const answers=[];
 root.hidden=false;
 function paint(){
   const q=rounds[idx];
   root.innerHTML='<div class="forge-workspace-head"><div><h3>Challenge round</h3><p>Five rounds. Get 3 right, then finish the reflection.</p></div><span class="forge-pill">5 ROUNDS</span></div><div class="forge-scorebar"><span>Round '+(idx+1)+' / '+rounds.length+'</span><strong>Score '+score+'</strong></div><div class="forge-quiz"><div class="forge-quiz-question">'+esc(q.q)+'</div><div class="forge-quiz-options">'+q.o.map((o,i)=>'<button type="button" class="forge-option" data-answer="'+i+'">'+esc(o)+'</button>').join('')+'</div></div><div class="forge-result"></div>';
   const result=root.querySelector('.forge-result');
   root.querySelectorAll('[data-answer]').forEach(btn=>btn.onclick=()=>{
     const answer=Number(btn.dataset.answer);
     answers[idx]=answer;
     root.querySelectorAll('[data-answer]').forEach(x=>x.disabled=true);
     if(answer===q.a){score++;btn.classList.add('correct');result.textContent='Correct.';result.className='forge-result ok'}
     else{btn.classList.add('wrong');result.textContent='Not this time.';result.className='forge-result bad'}
     const next=document.createElement('button');next.type='button';next.className='forge-next';next.textContent=idx===rounds.length-1?'Finish round':'Next round';result.insertAdjacentElement('afterend',next);
     next.onclick=()=>{
       if(idx<rounds.length-1){idx++;paint();return}
       if(score<3){result.textContent='Final score: '+score+' / '+rounds.length+' · Need 3 or more.';result.className='forge-result bad';return}
       result.textContent='Final score: '+score+' / '+rounds.length+' · One last step.';result.className='forge-result ok';
       const proof=document.createElement('div');proof.className='forge-proof';
       proof.innerHTML='<label class="forge-proof-label">What did you notice while solving these rounds?</label><textarea id="challengeProof" maxlength="500" rows="3" placeholder="Give one short observation or strategy…"></textarea><div class="forge-proof-footer"><span id="challengeProofCount">0 / 500</span><button type="button" class="forge-check" id="verifyChallenge">Finish challenge</button></div>';
       root.appendChild(proof);
       const input=proof.querySelector('#challengeProof'),count=proof.querySelector('#challengeProofCount');
       input.addEventListener('input',()=>{count.textContent=input.value.trim().length+' / 500'});
       proof.querySelector('#verifyChallenge').onclick=()=>{
         const proofText=input.value.trim();
         if(proofText.length<20){result.textContent='Add a little more detail (at least 20 characters).';result.className='forge-result bad';input.focus();return}
         activityEvidence={score,answers:answers.slice(0,5),proofText};setPassed(true,activityEvidence);
         result.textContent='Challenge complete.';result.className='forge-result ok';
       };
     };
   });
 }
 paint();
}
function renderGameWorkspace(root){
 root.hidden=false;
 root.innerHTML='<div class="forge-workspace-head"><div><h3>Room game</h3><p>This activity is designed for people to play together in a live room.</p></div><span class="forge-pill">MULTI-PLAYER</span></div><div class="forge-lesson">Open a room, invite people, and play the rounds together. Your room becomes the shared game board.</div>';
 setPassed(false);
}

function render(){
 const type=activityTypeInfo(activity);
 $('activityStatus').textContent='';$('activityHero').hidden=false;$('activityGrid').hidden=false;
 $('activityKicker').textContent=type.icon+' '+type.label+' · '+(activity.category||'General');
 $('activityTitle').textContent=activity.title;
 $('activityDescription').textContent=activity.description||'';
 $('activityChips').innerHTML='<span class="activity-detail-chip">⏱ '+Number(activity.durationMin||20)+' min</span><span class="activity-detail-chip">'+esc(activity.difficulty||'Medium')+'</span><span class="activity-detail-chip">⌛ '+Number(activity.expiresInDays||30)+'d left</span>';
 $('activityGoal').innerHTML='<div class="activity-brief">'+esc(activity.goal||'Complete the activity and reflect on what you learned or built.')+'</div>';
 const bits=String(activity.instructions||'').split(/\n|\./).map(x=>x.trim()).filter(Boolean);
 $('activityInstructions').innerHTML=bits.length?bits.map(x=>'<li>'+esc(x)+'.</li>').join(''):'<li>Work through the activity and complete its goal.</li>';
 if(activity.challengeBrief){$('activityBriefWrap').hidden=false;$('activityBrief').textContent=activity.challengeBrief}
 $('roomBtn').href='rooms.html?taskId='+encodeURIComponent(activity.id)+'&source='+encodeURIComponent(activity.source||source);
 $('expiryText').textContent=(activity.expiresInDays||30)+' days remaining in this cycle';
 remaining=Math.max(60,Number(activity.durationMin||20)*60);
 timerEndsAt=0;
 paintTimer();
 if(activity.type==='game'){
   $('timerBtn').hidden=true;
   $('timerDisplay').textContent='ROOM';
   $('timerDisplay').setAttribute('aria-label','This game uses the live room timer');
 }else{
   $('timerBtn').hidden=false;
   $('timerBtn').textContent='Start timer';
 }
 const workspace=$('forgeWorkspace');
 const engineId=activity.engineId||activity.id;
 const customCfg = activity.interaction?.kind === 'quiz' ? activity.interaction : null;
 const cfg=customCfg || getInteractiveConfig(engineId);

 if(activity.type==='build')renderBuildWorkspace(workspace,activity,setPassed);
 else if(activity.type==='puzzle'&&cfg)renderQuizWorkspace(workspace,cfg,false);
 else if(activity.type==='learn'&&cfg)renderQuizWorkspace(workspace,cfg,true);
 else if(activity.type==='challenge')renderChallengeWorkspace(workspace);
 else if(activity.type==='game')renderGameWorkspace(workspace);
 else{workspace.hidden=true;setPassed(true)}
 updateCompleteState();
}

function updateCompleteState(){
  const b=$('completeBtn');
  if(!b)return;
  const isOwnCommunity = activity?.source === 'community' && activity?.creatorUid === me?.uid;
  if(isOwnCommunity){
    b.disabled=true;
    b.textContent='Creator preview';
    b.title='Creators can test their activity but do not earn XP from their own activity.';
    return;
  }
  b.disabled=!activityPassed;
  if(activity?.type==='game')b.textContent='Play in a room';
  else b.textContent=activityPassed?'Mark complete':'Finish the activity first';
}

async function refreshExistingCompletion(){
  if(!me || !activity || activity.type==='game') return;
  try{
    const cycleKey=activity.source==='community'
      ? activity.id
      : activity.id+'_'+activity.startAtMs;
    const ref=activity.source==='community'
      ? doc(db,'communityTasks',activity.id,'completions',me.uid)
      : doc(db,'users',me.uid,'activityCompletions',cycleKey);
    const snap=await getDoc(ref);
    if(!snap.exists()) return;
    activityPassed=true;
    const b=$('completeBtn');
    if(b){b.disabled=true;b.textContent='Completed ✓';}
    const xp=Number(activity.xpReward)||(activity.difficulty==='Hard'?60:activity.difficulty==='Medium'?40:25);
    showCompletion({already:true,xp,level:profile?.level||'—'});
    $('completionNote').innerHTML='<div class="activity-success">Completed ✓ This activity is already in your journey.</div>';
  }catch(err){
    console.warn('[Activity] Existing completion check skipped:',err);
  }
}

function paintTimer(){
  if(activity?.type==='game')return;
  const m=Math.floor(remaining/60),s=remaining%60;
  $('timerDisplay').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
$('timerBtn').onclick=()=>{
  if(activity?.type==='game')return;
  if(timer){
    remaining=Math.max(0,Math.ceil((timerEndsAt-Date.now())/1000));
    clearInterval(timer);timer=null;timerEndsAt=0;
    $('timerBtn').textContent=remaining>0?'Resume timer':'Restart timer';
    $('activityTimer')?.classList.remove('is-running');
    return;
  }
  if(remaining<=0) remaining=Math.max(60,Number(activity?.durationMin||20)*60);
  timerEndsAt=Date.now()+remaining*1000;
  $('timerBtn').textContent='Pause timer';
  $('activityTimer')?.classList.add('is-running');
  timer=setInterval(()=>{
    remaining=Math.max(0,Math.ceil((timerEndsAt-Date.now())/1000));
    paintTimer();
    if(!remaining){
      clearInterval(timer);timer=null;timerEndsAt=0;
      $('timerBtn').textContent='Restart timer';
      $('activityTimer')?.classList.remove('is-running');
      $('timerDisplay').setAttribute('aria-label','Session timer complete');
    }
  },250);
};

$('completeBtn').onclick=async()=>{
  if(!me||!activity||!activityPassed||activity.type==='game')return;
  const b=$('completeBtn');b.disabled=true;b.textContent='Saving…';
  let completionAlready=false;
  let award=null;
  try{
    if(activity.source==='community'){
      const result=await completeCommunityTask(activity.id,me.uid,profile,activityEvidence);
      completionAlready=!!result?.already;
      award=result?.award||null;
    }else{
      const cycleKey=activity.id+'_'+activity.startAtMs;
      const ref=doc(db,'users',me.uid,'activityCompletions',cycleKey);
      const old=await getDoc(ref);
      if(!old.exists()){
        await setDoc(ref,{uid:me.uid,activityId:activity.id,cycleKey,title:activity.title,type:activity.type,completedAtMs:Date.now(),cycleEndsAtMs:activity.endAtMs});
      }else{
        completionAlready=true;
      }
      const xp=activity.difficulty==='Hard'?60:activity.difficulty==='Medium'?40:25;
      try{
        award=await awardXp(me.uid,xp,{catalogActivityId:activity.id,catalogCycleKey:cycleKey});
        if(!completionAlready){
          showAchievement({title:activity.title,subtitle:'+'+xp+' XP',icon:activity.icon||'🎯',leveledUp:award?.leveledUp,level:award?.level,badges:award?.badgesEarned||[]});
        }
      }catch(xpErr){
        console.warn('[Activity] XP award skipped; completion is still saved:',xpErr);
      }
    }
    if(timer){clearInterval(timer);timer=null;timerEndsAt=0;}
    const earnedXp=Number(activity.xpReward)||(activity.difficulty==='Hard'?60:activity.difficulty==='Medium'?40:25);
    $('completionNote').innerHTML='<div class="activity-success">Completed ✓ Your activity is saved in your journey.</div>';
    b.textContent='Completed ✓';
    showCompletion({
      already:completionAlready,
      xp:earnedXp,
      level:award?.level||profile?.level||'—'
    });
  }catch(e){
    b.disabled=false;
    updateCompleteState();
    $('completionNote').textContent=e.message||'Could not save completion.';
  }
};
onAuthStateChanged(auth,async u=>{
 if(!u){location.href='login.html?redirect=activity.html?id='+encodeURIComponent(id||'');return}
 me=u;
 const userSnap=await getDoc(doc(db,'users',u.uid));
 profile=userSnap.exists()?userSnap.data():{};
 if(source==='community'){
   const snap=await getDoc(doc(db,'communityTasks',id));
   if(!snap.exists())return fail('Activity not found.');
   const data=snap.data();
   const start=Number(data.startAtMs)||Number(data.createdAtMs)||0;
   const end=Number(data.endAtMs)||start+(Number(data.expiresInDays)||14)*86400000;
   if(start>Date.now()||end<=Date.now())return fail('Activity is not active right now.');
   if(data.activityType !== 'game' && !data.interaction && !data.templateId) return fail('This activity has no interactive setup yet.');
   activity={id:snap.id,...data,type:data.activityType,source:'community',engineId:data.templateId||null,expiresInDays:Math.max(0,Math.ceil((end-Date.now())/86400000)),endAtMs:end,startAtMs:start};
 }else{
   activity=activeCatalogActivities().find(x=>x.id===id)||null;
   if(activity)activity.engineId=activity.id;
 }
 if(!activity)return fail('Activity not found or its cycle has ended.');
 render();
});