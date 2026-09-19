import{auth,db}from'./firebase-init.js';
import{onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import{doc,getDoc}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import{createCommunityTask}from'./gamification/community-tasks.js';
import{ACTIVITY_TYPES}from'./activity-ui.js';
import{ACTIVITY_CATALOG}from'./activity-catalog.js';
import{mechanicInfo}from'./forge-mechanics.js';
import{escapeHtml as esc}from'./utils.js';
import{showToast}from'./ui/toast.js';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
let me=null,profile={},activeType=params.get('activity')||'puzzle',selected=null;

if(!ACTIVITY_TYPES[activeType])activeType='puzzle';

function escText(v){return esc(String(v||''))}
function starters(){return ACTIVITY_CATALOG.filter(x=>x.type===activeType).slice(0,6)}
function selectedMechanic(){return selected?.mechanic||mechanicInfo(activeType,selected?.mechanic)?.id||'custom'}

function renderLanes(){
 const lanes=Object.entries(ACTIVITY_TYPES);
 $('creatorLanes').innerHTML=lanes.map(([type,info])=>'<button type="button" class="creator-lane-card creator-lane-card--'+info.tone+' '+(type===activeType?'selected':'')+'" data-type="'+type+'"><span class="creator-lane-art">'+info.icon+'</span><span class="creator-lane-copy"><strong>'+info.label+'</strong><small>'+escText(info.desc)+'</small></span><span class="creator-lane-arrow">→</span></button>').join('');
 document.querySelectorAll('[data-type]').forEach(btn=>btn.onclick=()=>{activeType=btn.dataset.type;selected=starters()[0]||null;renderLanes();renderTemplates();fillForm(selected);renderPreview()});
}
function renderTemplates(){
 const list=starters();
 $('creatorTemplates').innerHTML=list.map((t,i)=>{
   const mechanic=mechanicInfo(activeType,t.mechanic);
   return '<button type="button" class="creator-starter '+(selected?.id===t.id?'selected':'')+'" data-starter="'+t.id+'"><span class="creator-starter-icon">'+escText(t.icon)+'</span><span class="creator-starter-main"><strong>'+escText(t.title)+'</strong><small>'+escText(t.description)+'</small><span class="creator-starter-foot"><em>'+escText(mechanic?.label||'Ready to use')+'</em><em>⏱ '+Number(t.durationMin||20)+'m</em></span></span><span class="creator-starter-go">↗</span></button>';
 }).join('');
 document.querySelectorAll('[data-starter]').forEach(btn=>btn.onclick=()=>{selected=ACTIVITY_CATALOG.find(x=>x.id===btn.dataset.starter)||null;fillForm(selected);renderTemplates();renderPreview()});
}
function fillForm(t){
 const base=t||starters()[0];if(!base)return;
 if(!$('title').value||$('title').value===selected?.title)$('title').value=base.title||'';
 $('category').value=base.category||'General';
 $('description').value=base.description||'';
 $('durationMin').value=String(base.durationMin||20);
 $('difficulty').value=base.difficulty||'Medium';
 $('expiresDays').value=String(base.cycleDays||14);
 renderPreview();
}
function renderPreview(){
 const type=ACTIVITY_TYPES[activeType],t=selected||starters()[0],mechanic=mechanicInfo(activeType,t?.mechanic);
 const title=$('title').value.trim()||t?.title||'Your activity';
 const desc=$('description').value.trim()||t?.description||type.desc;
 $('creatorSelectedStarter').innerHTML='<div class="creator-mini-starter"><span>'+escText(t?.icon||type.icon)+'</span><div><strong>Starter: '+escText(t?.title||'Custom')+'</strong><small>'+escText(mechanic?.label||'Custom activity')+' · Forge will handle the interaction.</small></div></div>';
 $('creatorLivePreviewCard').innerHTML='<article class="creator-preview-activity"><div class="creator-preview-art"><span>'+escText(t?.icon||type.icon)+'</span><i></i><b></b></div><div class="creator-preview-body"><div class="creator-preview-tags"><em>'+type.label+'</em><em>'+escText($('category').value||t?.category||'General')+'</em></div><h3>'+escText(title)+'</h3><p>'+escText(desc)+'</p><div class="creator-preview-meta"><span>⏱ '+Number($('durationMin').value||20)+' min</span><span>'+escText($('difficulty').value||'Medium')+'</span><span>⌛ '+Number($('expiresDays').value||14)+'d</span></div></div><footer><span>'+escText(mechanic?.label||'Custom')+'</span><strong>Open →</strong></footer></article>';
}
document.querySelectorAll('#title,#description,#durationMin,#difficulty,#expiresDays').forEach(el=>el.addEventListener('input',renderPreview));
document.querySelectorAll('#durationMin,#difficulty,#expiresDays').forEach(el=>el.addEventListener('change',renderPreview));

$('creatorForm').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!me)return showToast('Please login first','error');
 if(!selected)return showToast('Pick a starter first.','warn');
 const title=$('title').value.trim(),desc=$('description').value.trim();
 if(!title)return showToast('Give it a short name.','warn');
 if(!desc)return showToast('Tell people what to do.','warn');
 const btn=$('submitBtn');const status=$('formStatus');btn.disabled=true;status.textContent='Publishing…';
 try{
   const days=[7,14,21,30,40].includes(Number($('expiresDays').value))?Number($('expiresDays').value):14;
   const id=await createCommunityTask(me.uid,profile,{
     title,description:desc,goal:selected.goal||'Complete the activity and reach the goal.',instructions:selected.instructions||'Follow the starter activity and use the interactive workspace.',
     icon:selected.icon||ACTIVITY_TYPES[activeType].icon,kind:activeType==='challenge'?'challenge':'community',activityType:activeType,
     category:$('category').value.trim()||selected.category||'General',mechanic:selected.mechanic||'custom',templateId:selected.id,
     durationMin:Number($('durationMin').value)||Number(selected.durationMin)||20,difficulty:$('difficulty').value||selected.difficulty||'Medium',
     expiresInDays:days,target:1,metric:'manual',xpReward:$('difficulty').value==='Hard'?60:$('difficulty').value==='Medium'?40:25
   });
   status.textContent='Published ✓';showToast('Your activity is live on Forge.');
   setTimeout(()=>location.href='activity.html?id='+encodeURIComponent(id)+'&source=community',500);
 }catch(err){status.textContent=err.message||'Could not publish activity.';showToast(status.textContent,'error');btn.disabled=false;btn.querySelector('span').textContent='Publish to Forge'}
});

onAuthStateChanged(auth,async u=>{
 if(!u){location.href='login.html?redirect=task-create.html';return}
 me=u;const s=await getDoc(doc(db,'users',u.uid));profile=s.exists()?s.data():{name:u.displayName||'User'};
 selected=starters()[0]||null;
 renderLanes();renderTemplates();fillForm(selected);renderPreview();
});