import{auth,db}from'./firebase-init.js';
import{onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import{collection,query,orderBy,limit,onSnapshot,getDoc,getDocs,doc,setDoc,deleteDoc,addDoc,updateDoc,runTransaction}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import{escapeHtml as esc,avatarHtml}from'./utils.js';
import{activityCardHtml}from'./activity-ui.js';
import{showToast}from'./ui/toast.js';
import{activeCatalogActivities}from'./activity-catalog.js';
import{mountSharedBuildWorkspace}from'./room-workspace.js';
import{mountSharedQuizWorkspace}from'./room-quiz-workspace.js';
import{mountSharedChallengeWorkspace}from'./room-challenge-workspace.js';
const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
let me=null,p={},room=null,stopSharedWorkspace=()=>{};
function fail(t){$('roomStatus').textContent=t;$('roomStatus').classList.add('error')}
async function load(){
 if(!id)return fail('Missing room id.');
 const s=await getDoc(doc(db,'rooms',id));if(!s.exists())return fail('Room not found.');
 room={id:s.id,...s.data()};if(room.status==='closed'||((Number(room.expiresAtMs)||((Number(room.createdAtMs)||Date.now())+6*60*60*1000))<=Date.now()))return fail('This room has expired.');
 const mine=await getDoc(doc(db,'rooms',id,'members',me.uid));
 if(!mine.exists()){
   try{
     await runTransaction(db, async transaction => {
       const roomRef=doc(db,'rooms',id);
       const memberRef=doc(db,'rooms',id,'members',me.uid);
       const roomSnap=await transaction.get(roomRef);
       const memberSnap=await transaction.get(memberRef);
       if(!roomSnap.exists())throw new Error('Room not found.');
       const latest=roomSnap.data();
       if(memberSnap.exists())return;
       const expires=Number(latest.expiresAtMs)||((Number(latest.createdAtMs)||Date.now())+6*60*60*1000);
       if(latest.status!=='open'||expires<=Date.now())throw new Error('This room is no longer open.');
       const count=Math.max(0,Number(latest.memberCount)||0);
       const max=Math.max(2,Number(latest.maxPlayers)||3);
       if(count>=max)throw new Error('This room is full.');
       transaction.set(memberRef,{uid:me.uid,name:p.name||me.displayName||'User',photoURL:p.photoURL||me.photoURL||null,joinedAtMs:Date.now()});
       transaction.update(roomRef,{memberCount:count+1});
     });
     room.memberCount=Math.min(Number(room.maxPlayers||3),Number(room.memberCount||0)+1);
   }catch(joinErr){return fail(joinErr.message||'Could not join this room.');}
 }
 $('roomGrid').hidden=false;
 $('roomTitle').textContent=room.title||'Open room';
 $('roomSub').textContent='Open activity room · '+(room.maxPlayers||3)+' people max'+(room.expiresAtMs?' · '+Math.max(0,Math.ceil((Number(room.expiresAtMs)-Date.now())/3600000))+'h remaining':'');
 $('endBtn').hidden=room.hostUid!==me.uid;
 $('roomPeopleBadge').textContent='… / '+(room.maxPlayers||3);
 if(room.challengeId){
   let activity=null;
   if(room.activitySource==='catalog') activity=activeCatalogActivities().find(x=>x.id===room.challengeId)||null;
   else {const ts=await getDoc(doc(db,'communityTasks',room.challengeId));if(ts.exists()){const data=ts.data();activity={id:ts.id,...data,type:data.activityType,source:'community',engineId:data.templateId||null};}}
   if(activity){
     $('roomActivity').innerHTML=activityCardHtml(activity,{compact:true});
     $('workspaceTitle').textContent=activity.title||'Activity workspace';
     $('roomWorkspaceStatus').textContent=activity.challengeBrief||activity.goal||activity.description||'Work together on the activity and use room chat to compare ideas.';
     $('challengeLink').href=activity.source==='catalog'?'activity.html?id='+encodeURIComponent(room.challengeId):'task-detail.html?id='+encodeURIComponent(room.challengeId);
     stopSharedWorkspace();
     if(activity.type==='build' && (room.activitySource==='catalog'||activity.engineId)){
       stopSharedWorkspace=await mountSharedBuildWorkspace($('roomWorkspace'),{db,roomId:id,activity,me,onStateChange:(result)=>{if(result?.passed)$('roomWorkspaceStatus').textContent='Shared build complete ✓ Everyone reached a valid solution.'}});
     }else if((activity.type==='puzzle'||activity.type==='learn') && (room.activitySource==='catalog'||activity.engineId)){
       stopSharedWorkspace=await mountSharedQuizWorkspace($('roomWorkspace'),{db,roomId:id,activity,me,mode:activity.type,onStateChange:(result)=>{if(result?.passed)$('roomWorkspaceStatus').textContent=activity.type==='learn'?'Concept understood by the room ✓':'Shared puzzle solved ✓'}});
     }else if(activity.type==='challenge' && (room.activitySource==='catalog'||activity.engineId)){
       stopSharedWorkspace=await mountSharedChallengeWorkspace($('roomWorkspace'),{db,roomId:id,activity,me,hostUid:room.hostUid});
     }
   }
 }
 onSnapshot(query(collection(db,'rooms',id,'members'),orderBy('joinedAtMs','asc'),limit(20)),s=>{
   $('roomPeopleBadge').textContent=s.size+' / '+(room.maxPlayers||3);
   $('memberList').innerHTML=s.docs.map(d=>{const m=d.data();return '<div class="room-member"><span class="room-member-avatar">'+avatarHtml({name:m.name,photoURL:m.photoURL})+'</span><span class="room-member-name">'+esc(m.name||'User')+'</span><span class="room-member-role">'+(m.uid===room.hostUid?'Host':'Member')+'</span></div>'}).join('');
 });
 onSnapshot(query(collection(db,'rooms',id,'messages'),orderBy('createdAtMs','asc'),limit(100)),s=>{
   $('messageLog').innerHTML=s.docs.map(d=>{const m=d.data();return '<div class="room-msg '+(m.uid===me.uid?'mine':'')+'"><div class="room-msg-bubble"><div class="room-msg-name">'+esc(m.name||'User')+'</div><div class="room-msg-text">'+esc(m.text||'')+'</div></div></div>'}).join('');
   $('messageLog').scrollTop=$('messageLog').scrollHeight;
 });
}
$('messageForm').onsubmit=async e=>{e.preventDefault();const i=$('messageInput'),t=i.value.trim();if(!t)return;await addDoc(collection(db,'rooms',id,'messages'),{uid:me.uid,name:p.name||me.displayName||'User',text:t.slice(0,500),createdAtMs:Date.now()});i.value='';i.focus()};
$('leaveBtn').onclick=async()=>{
  if(room?.hostUid===me.uid)return showToast('Host must end the room.', 'warn');
  try{
    await runTransaction(db,async transaction=>{
      const roomRef=doc(db,'rooms',id);
      const memberRef=doc(db,'rooms',id,'members',me.uid);
      const roomSnap=await transaction.get(roomRef);
      const memberSnap=await transaction.get(memberRef);
      if(!roomSnap.exists()||!memberSnap.exists())return;
      const data=roomSnap.data();
      const nextCount=Math.max(0,Number(data.memberCount||0)-1);
      transaction.delete(memberRef);
      transaction.update(roomRef,{memberCount:nextCount});
    });
    location.href='rooms.html';
  }catch(err){
    showToast(err.message||'Could not leave the room.', 'error');
  }
};
$('endBtn').onclick=async()=>{if(room?.hostUid!==me.uid)return;await updateDoc(doc(db,'rooms',id),{status:'closed',endedAtMs:Date.now()});location.href='rooms.html'};
onAuthStateChanged(auth,async u=>{if(!u)return location.href='login.html?redirect=room.html?id='+encodeURIComponent(id||'');me=u;const s=await getDoc(doc(db,'users',u.uid));p=s.exists()?s.data():{};await load()});