import{auth,db}from'./firebase-init.js';
import{onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import{collection,query,where,limit,onSnapshot,getDoc,doc,addDoc,setDoc,serverTimestamp,getDocs}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import{escapeHtml as esc}from'./utils.js';
import{activityCardHtml}from'./activity-ui.js';
const $=id=>document.getElementById(id);
let me=null,profile={},selectedActivity=null,capacity=3;
function msg(t,e=false){$('createStatus').textContent=t||'';$('createStatus').classList.toggle('error',e)}
async function loadActivity(){
 const id=new URLSearchParams(location.search).get('taskId');
 if(!id){$('selectedActivity').innerHTML='<span>Choose an activity from Discover to create an activity room.</span>';return;}
 const s=await getDoc(doc(db,'communityTasks',id));
 if(!s.exists()){msg('Activity not found.',true);return;}
 selectedActivity={id:s.id,...s.data()};
 $('challengeId').value=id;
 $('selectedActivity').innerHTML=activityCardHtml(selectedActivity,{compact:true});
 $('roomTitle').value=(selectedActivity.title||'Activity')+' · Room';
}
function render(rs){
 $('roomStatus').textContent=rs.length?rs.length+' live room'+(rs.length>1?'s':''):'No rooms live yet';
 $('roomList').innerHTML=rs.length?rs.map(r=>`<a class="room-card" href="room.html?id=${encodeURIComponent(r.id)}"><span class="room-orb">✦</span><span class="room-card-main"><span class="room-card-title">${esc(r.title||'Open room')}</span><span class="room-card-meta"><span class="room-live">● LIVE</span><span>${Number(r.memberCount)||0}/${Number(r.maxPlayers)||6} people</span><span>${esc(r.activityTitle||'Open activity')}</span></span></span><span>↗</span></a>`).join(''):'<div class="room-empty">No open rooms. Start one around an activity and let people join.</div>';
}
document.querySelectorAll('[data-cap]').forEach(b=>b.onclick=()=>{capacity=Number(b.dataset.cap);document.querySelectorAll('[data-cap]').forEach(x=>x.classList.toggle('is-active',x===b));});
$('roomForm').onsubmit=async e=>{
 e.preventDefault();if(!me)return;
 if(!selectedActivity)return msg('Select an activity from Discover first.',true);
 const title=$('roomTitle').value.trim();if(!title)return msg('Give the room a name.',true);
 const b=e.target.querySelector('.room-create-btn');b.disabled=true;
 try{
  const ref=await addDoc(collection(db,'rooms'),{title:title.slice(0,80),maxPlayers:capacity,hostUid:me.uid,hostName:profile.name||me.displayName||'User',challengeId:selectedActivity.id,activityTitle:selectedActivity.title||'Activity',activityType:selectedActivity.activityType||null,status:'open',memberCount:1,createdAt:serverTimestamp(),createdAtMs:Date.now()});
  await setDoc(doc(db,'rooms',ref.id,'members',me.uid),{uid:me.uid,name:profile.name||me.displayName||'User',photoURL:profile.photoURL||me.photoURL||null,joinedAtMs:Date.now()});
  location.href='room.html?id='+ref.id;
 }catch(err){msg(err.message||'Could not create room.',true)}finally{b.disabled=false}
};
onAuthStateChanged(auth,async u=>{
 if(!u){location.href='login.html?redirect=rooms.html';return}
 me=u;const s=await getDoc(doc(db,'users',u.uid));profile=s.exists()?s.data():{};
 await loadActivity();
 onSnapshot(query(collection(db,'rooms'),where('status','==','open'),limit(30)),async snap=>{
  const rooms=await Promise.all(snap.docs.map(async d=>{
   const r={id:d.id,...d.data()};const ms=await getDocs(query(collection(db,'rooms',d.id,'members'),limit(20)));return {...r,memberCount:ms.size};
  }));
  render(rooms.sort((a,b)=>(b.createdAtMs||0)-(a.createdAtMs||0)));
 },e=>$('roomStatus').textContent=e.message);
});