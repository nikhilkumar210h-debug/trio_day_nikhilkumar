import{auth,db}from'./firebase-init.js';
import{onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import{doc,getDoc,setDoc}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import{activeCatalogActivities}from'./activity-catalog.js';
import{activityTypeInfo}from'./activity-ui.js';
import{awardXp}from'./gamification/xp-levels.js';
import{showAchievement}from'./ui/achievements.js';
import{escapeHtml as esc}from'./utils.js';
const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
let me=null,activity=null,timer=null,remaining=0;
function fail(t){$('activityStatus').textContent=t;$('activityStatus').classList.add('error')}
function render(){
 const type=activityTypeInfo(activity);
 $('activityStatus').textContent='';
 $('activityHero').hidden=false;$('activityGrid').hidden=false;
 $('activityKicker').textContent=type.icon+' '+type.label+' · '+activity.category;
 $('activityTitle').textContent=activity.title;
 $('activityDescription').textContent=activity.description;
 $('activityChips').innerHTML='<span class="activity-detail-chip">⏱ '+Number(activity.durationMin)+' min</span><span class="activity-detail-chip">'+esc(activity.difficulty)+'</span><span class="activity-detail-chip">⌛ '+activity.expiresInDays+'d left</span>';
 $('activityGoal').innerHTML='<div class="activity-brief">'+esc(activity.goal||'Complete the activity and reflect on what you learned or built.')+'</div>';
 const bits=String(activity.instructions||'').split(/\.|\n/).map(x=>x.trim()).filter(Boolean);
 $('activityInstructions').innerHTML=bits.map(x=>'<li>'+esc(x)+'.</li>').join('');
 if(activity.challengeBrief){$('activityBriefWrap').hidden=false;$('activityBrief').textContent=activity.challengeBrief}
 $('roomBtn').href='rooms.html?taskId='+encodeURIComponent(activity.id)+'&source=catalog';
 $('expiryText').textContent=activity.expiresInDays+' days remaining in this cycle';
 remaining=Math.max(60,Number(activity.durationMin||20)*60);paintTimer();
}
function paintTimer(){const m=Math.floor(remaining/60),s=remaining%60;$('timerDisplay').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
$('timerBtn').onclick=()=>{if(timer){clearInterval(timer);timer=null;$('timerBtn').textContent='Resume timer';return}timer=setInterval(()=>{remaining=Math.max(0,remaining-1);paintTimer();if(!remaining){clearInterval(timer);timer=null;$('timerBtn').textContent='Time complete'}} ,1000);$('timerBtn').textContent='Pause timer'};
$('completeBtn').onclick=async()=>{if(!me||!activity)return;const b=$('completeBtn');b.disabled=true;b.textContent='Saving…';try{const ref=doc(db,'users',me.uid,'activityCompletions',activity.id);const old=await getDoc(ref);if(old.exists()){$('completionNote').textContent='Already completed in this cycle ✓';b.textContent='Completed';return}await setDoc(ref,{uid:me.uid,activityId:activity.id,title:activity.title,type:activity.type,completedAtMs:Date.now(),cycleEndsAtMs:activity.endAtMs});const xp=activity.difficulty==='Hard'?60:activity.difficulty==='Medium'?40:25;const award=await awardXp(me.uid,xp,{catalogActivityId:activity.id});showAchievement({title:activity.title,subtitle:'+'+xp+' XP',icon:activity.icon||'🎯',leveledUp:award?.leveledUp,level:award?.level,badges:award?.badgesEarned||[]});$('completionNote').innerHTML='<div class="activity-success">Completed ✓ Great job. You can rate community activities after finishing them.</div>';b.textContent='Completed'}catch(e){b.disabled=false;b.textContent='Mark complete';$('completionNote').textContent=e.message||'Could not save completion.'}};
onAuthStateChanged(auth,u=>{if(!u){location.href='login.html?redirect=activity.html?id='+encodeURIComponent(id||'');return}me=u;activity=activeCatalogActivities().find(x=>x.id===id)||null;if(!activity)return fail('Activity not found or its cycle has ended.');render()});