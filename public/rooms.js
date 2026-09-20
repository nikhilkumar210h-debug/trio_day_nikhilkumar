import{auth,db}from'./firebase-init.js';
import{onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import{collection,query,where,limit,onSnapshot,getDoc,doc,getDocs,writeBatch,serverTimestamp}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import{escapeHtml as esc}from'./utils.js';
import{activityCardHtml,ACTIVITY_TYPES,normalizeActivityType}from'./activity-ui.js';
import{activeCatalogActivities}from'./activity-catalog.js?v=20260920-audit2';
const $=id=>document.getElementById(id);
let me=null,profile={},selectedActivity=null,capacity=3,filterActivityId=new URLSearchParams(location.search).get('taskId');
function msg(t,e=false){$('createStatus').textContent=t||'';$('createStatus').classList.toggle('error',e)}
async function loadActivity(){
 const id=new URLSearchParams(location.search).get('taskId');
 const source=new URLSearchParams(location.search).get('source');
 if(id){
   let a=null;
   if(source==='catalog'){a=activeCatalogActivities().find(x=>x.id===id)||null;if(a)a={...a,source:'catalog',activityType:a.activityType||a.type};}
   else{const s=await getDoc(doc(db,'communityTasks',id));if(s.exists())a={id:s.id,...s.data(),source:'community',activityType:normalizeActivityType(s.data())};}
   if(!a){msg('Activity not found.',true);return;}
   selectedActivity=a;$('challengeId').value=a.id;$('selectedActivity').innerHTML=activityCardHtml(a,{compact:true});$('roomTitle').value=(a.title||'Activity')+' · Room';return;
 }
 try{
   const snap=await getDocs(query(collection(db,'communityTasks'),where('status','==','active'),limit(40))).catch(()=>null);
   const community=snap?snap.docs.map(d=>({id:d.id,...d.data(),source:'community',activityType:normalizeActivityType(d.data())})):[]; 
   const communityActive=community.filter(t=>!t.hidden&&((t.endAtMs||((t.createdAtMs||Date.now())+30*86400000))>Date.now()));
   const activities=[...activeCatalogActivities().map(a=>({...a,source:'catalog',activityType:a.activityType||a.type})),...communityActive];
   const laneOrder=['build','learn','challenge','puzzle'];
   $('roomActivityPicker').innerHTML=activities.length?laneOrder.map(type=>{
     const lane=activities.filter(a=>a.activityType===type||a.type===type).slice(0,5);
     return lane.length?`<div class="room-picker-lane"><div class="room-picker-heading"><span>${ACTIVITY_TYPES[type].icon}</span><strong>${ACTIVITY_TYPES[type].label}</strong></div><div class="room-picker-list">${lane.map(a=>`<button type="button" class="room-picker-card" data-activity-id="${a.id}" data-source="${a.source||'catalog'}"><span>${esc(a.icon||ACTIVITY_TYPES[type].icon)}</span><span><strong>${esc(a.title||'Activity')}</strong><small>${esc(a.category||'General')} · ${esc(a.description||ACTIVITY_TYPES[type].desc)}</small></span></button>`).join('')}</div></div>`:'';
   }).join(''):'<div class="room-empty">No activities available yet.</div>';
   document.querySelectorAll('[data-activity-id]').forEach(btn=>btn.onclick=()=>{
     const a=activities.find(x=>x.id===btn.dataset.activityId);if(!a)return;
     selectedActivity=a;$('challengeId').value=a.id;$('selectedActivity').innerHTML=activityCardHtml(a,{compact:true});$('roomTitle').value=(a.title||'Activity')+' · Room';$('roomForm').dataset.source=a.source||'catalog';
     document.querySelectorAll('[data-activity-id]').forEach(x=>x.classList.toggle('is-selected',x===btn));
   });
 }catch(e){msg(e.message||'Could not load activities.',true)}
}
function render(rs){
 const now=Date.now();
 const activeRooms=rs.filter(r=>{const expires=Number(r.expiresAtMs)||((Number(r.createdAtMs)||now)+6*60*60*1000);return expires>now;});
 const visible=filterActivityId?activeRooms.filter(r=>r.challengeId===filterActivityId):activeRooms;
 $('roomStatus').textContent=visible.length?visible.length+' live room'+(visible.length>1?'s':''):(filterActivityId?'No room is open for this activity yet':'No rooms live yet');
 $('roomList').innerHTML=visible.length?visible.map(r=>`<a class="room-card" href="room.html?id=${encodeURIComponent(r.id)}"><span class="room-orb">✦</span><span class="room-card-main"><span class="room-card-title">${esc(r.title||'Open room')}</span><span class="room-card-meta"><span class="room-live">● LIVE</span><span>${Number(r.memberCount)||0}/${Number(r.maxPlayers)||6} people</span><span>${esc(r.activityTitle||'Open activity')}</span><span>${'⌛ '+Math.max(0,Math.ceil(((Number(r.expiresAtMs)||((Number(r.createdAtMs)||Date.now())+6*60*60*1000))-Date.now())/3600000))+'h left'}</span></span></span><span>↗</span></a>`).join(''):'<div class="room-empty">No open rooms. Start one around an activity and let people join.</div>';
}
document.querySelectorAll('[data-cap]').forEach(b=>b.onclick=()=>{capacity=Number(b.dataset.cap);document.querySelectorAll('[data-cap]').forEach(x=>x.classList.toggle('is-active',x===b));});
$('roomForm').onsubmit=async e=>{
 e.preventDefault();if(!me)return;
 if(!selectedActivity)return msg('Select an activity from Discover first.',true);
 const title=$('roomTitle').value.trim();if(!title)return msg('Give the room a name.',true);
 const b=e.target.querySelector('.room-create-btn');b.disabled=true;
 try{
  const roomRef=doc(collection(db,'rooms'));
  const batch=writeBatch(db);
  const now=Date.now();
  batch.set(roomRef,{title:title.slice(0,80),maxPlayers:capacity,hostUid:me.uid,hostName:profile.name||me.displayName||'User',challengeId:selectedActivity.id,activityTitle:selectedActivity.title||'Activity',activityType:selectedActivity.activityType||selectedActivity.type||null,activitySource:selectedActivity.source||'community',activityCategory:selectedActivity.category||'General',status:'open',memberCount:1,expiresAtMs:now+6*60*60*1000,createdAt:serverTimestamp(),createdAtMs:now});
  batch.set(doc(db,'rooms',roomRef.id,'members',me.uid),{uid:me.uid,name:profile.name||me.displayName||'User',photoURL:profile.photoURL||me.photoURL||null,joinedAtMs:now});
  await batch.commit();
  location.href='room.html?id='+roomRef.id;
 }catch(err){msg(err.message||'Could not create room.',true)}finally{b.disabled=false}
};
onAuthStateChanged(auth,async u=>{
 if(!u){location.href='login.html?redirect=rooms.html';return}
 me=u;const s=await getDoc(doc(db,'users',u.uid));profile=s.exists()?s.data():{};
 await loadActivity();
 onSnapshot(query(collection(db,'rooms'),where('status','==','open'),limit(30)),snap=>{
  const rooms=snap.docs.map(d=>({id:d.id,...d.data(),memberCount:Number(d.data().memberCount)||0}));
  render(rooms.sort((a,b)=>(b.createdAtMs||0)-(a.createdAtMs||0)));
 },e=>$('roomStatus').textContent=e.message);
});