import{auth,db}from'./firebase-init.js';
import{onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import{collection,doc,getDoc,getDocs,query,where,limit}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import{createCommunityTask}from'./gamification/community-tasks.js';
import{ACTIVITY_TYPES}from'./activity-ui.js';
import{ACTIVITY_CATALOG}from'./activity-catalog.js';
import{escapeHtml as esc}from'./utils.js';
import{showToast}from'./ui/toast.js';

const $=id=>document.getElementById(id);
let me=null,profile=null,activeType=new URLSearchParams(location.search).get('activity')||'puzzle',selected=null;

const validTypes=Object.keys(ACTIVITY_TYPES);
if(!validTypes.includes(activeType))activeType='puzzle';

function escText(v){return esc(String(v||''))}
function renderLanes(){
 $('creatorLanes').innerHTML=validTypes.map(type=>{const i=ACTIVITY_TYPES[type];return '<button type="button" class="creator-lane '+(type===activeType?'active':'')+'" data-type="'+type+'">'+i.icon+' '+i.label+'</button>'}).join('');
 document.querySelectorAll('.creator-lane').forEach(b=>b.onclick=()=>{activeType=b.dataset.type;renderLanes();renderCategorySuggestions();renderTemplates()});
}
function renderCategorySuggestions(){
 const cats=[...new Set(ACTIVITY_CATALOG.filter(a=>a.type===activeType).map(a=>a.category).filter(Boolean))].sort();
 $('categoryOptions').innerHTML=cats.map(x=>'<option value="'+escText(x)+'"></option>').join('');
}
function renderTemplates(){
 const list=ACTIVITY_CATALOG.filter(a=>a.type===activeType).slice(0,12);
 $('creatorTemplates').innerHTML=list.map(t=>'<button type="button" class="creator-template '+(selected?.id===t.id?'selected':'')+'" data-id="'+t.id+'"><div class="creator-template-art">'+escText(t.icon)+'</div><strong>'+escText(t.title)+'</strong><small>'+escText(t.category)+' · '+escText(t.description)+'</small><div class="creator-template-meta"><span>⏱ '+Number(t.durationMin)+'m</span><span>'+escText(t.difficulty)+'</span><span>⌛ '+Number(t.cycleDays)+'d</span></div></button>').join('');
 document.querySelectorAll('.creator-template').forEach(b=>b.onclick=()=>{selected=ACTIVITY_CATALOG.find(t=>t.id===b.dataset.id)||null;fillForm(selected);renderTemplates()});
 if(!selected||selected.type!==activeType){selected=list[0]||null;if(selected)fillForm(selected)}
}
function fillForm(t){
 if(!t)return;
 $('title').value=t.title||'';$('category').value=t.category||'';$('description').value=t.description||'';$('goal').value=t.goal||'';$('instructions').value=t.instructions||'';$('durationMin').value=String(t.durationMin||20);$('difficulty').value=t.difficulty||'Medium';$('expiresDays').value=String(t.cycleDays||14);$('icon').value=t.icon||ACTIVITY_TYPES[activeType].icon;
 updateExpiry();
}
function updateExpiry(){$('expiryCopy').textContent=$('expiresDays').value+' days live';}
document.querySelectorAll('#expiresDays').forEach(e=>e.addEventListener('change',updateExpiry));
$('creatorForm').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!me)return showToast('Please login first','error');
 const btn=$('submitBtn');const status=$('formStatus');const title=$('title').value.trim();
 if(!title)return showToast('Give the activity a clear title.','warn');
 if(!$('description').value.trim())return showToast('Add a short activity description.','warn');
 btn.disabled=true;btn.textContent='Publishing…';status.textContent='';
 try{
   const days=Math.min(40,Math.max(7,Number($('expiresDays').value)||14));
   const start=Date.now(),end=start+days*86400000;
   const id=await createCommunityTask(me.uid,profile,{
     title,description:$('description').value.trim(),goal:$('goal').value.trim(),instructions:$('instructions').value.trim(),
     icon:$('icon').value.trim()||ACTIVITY_TYPES[activeType].icon,kind:activeType==='challenge'?'challenge':'community',activityType:activeType,
     category:$('category').value.trim()||'General',durationMin:Number($('durationMin').value)||20,difficulty:$('difficulty').value,
     expiresInDays:days,startAtMs:start,endAtMs:end,target:1,metric:'manual',xpReward:Number($('xpReward')?.value)||40
   });
   status.textContent='Published ✓';
   showToast('Activity published successfully!');
   setTimeout(()=>{location.href='task-detail.html?id='+encodeURIComponent(id)},700);
 }catch(err){status.textContent=err.message||'Could not publish activity.';status.classList.add('error');showToast(status.textContent,'error');btn.disabled=false;btn.textContent='Publish activity'}
});
onAuthStateChanged(auth,async u=>{
 me=u;if(!u){location.href='login.html?redirect=task-create.html';return}
 const s=await getDoc(doc(db,'users',u.uid));profile=s.exists()?s.data():{name:u.displayName};
 renderLanes();renderCategorySuggestions();renderTemplates();updateExpiry();
});