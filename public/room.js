import{auth,db}from'./firebase-init.js';
import{onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import{collection,query,orderBy,limit,onSnapshot,getDoc,getDocs,doc,setDoc,deleteDoc,addDoc,updateDoc,runTransaction}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import{escapeHtml as esc,avatarHtml}from'./utils.js';
import{activityCardHtml}from'./activity-ui.js';
import{showToast}from'./ui/toast.js';
import{activeCatalogActivities}from'./activity-catalog.js';
import{createNotificationViaWorker}from'./services/notificationWorker.js';
import{mountSharedBuildWorkspace}from'./room-workspace.js';
import{mountSharedQuizWorkspace}from'./room-quiz-workspace.js';
import{mountSharedChallengeWorkspace}from'./room-challenge-workspace.js';
const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
let me=null,p={},room=null,stopSharedWorkspace=()=>{};
const voicePeers=new Map(),voicePCs=new Map(),voiceAudio=new Map(),pendingCandidates=new Map();let localStream=null,voiceReady=false,micEnabled=false;let rtcUnsubs=[];
function fail(t){$('roomStatus').textContent=t;$('roomStatus').classList.add('error')}
function pairId(a,b){return [a,b].sort().join('__')}
async function loadFriends(){
 const host=$('friendList'); if(!host)return;
 try{
  const a=await getDocs(collection(db,'users',me.uid,'following')); const b=await getDocs(collection(db,'users',me.uid,'followers'));
  const following=new Set(a.docs.map(d=>d.id)); const ids=b.docs.map(d=>d.id).filter(x=>following.has(x)&&x!==me.uid); const memberSnap=await getDocs(collection(db,'rooms',id,'members')); const joined=new Set(memberSnap.docs.map(d=>d.id));
  if(!ids.length){host.innerHTML='<div class="room-empty">No connected friends yet.</div>';return}
  const rows=await Promise.all(ids.slice(0,30).map(async uid=>{const s=await getDoc(doc(db,'users',uid));return s.exists()?{uid,...s.data()}:null}));
  host.innerHTML=rows.filter(Boolean).map(f=>'<div class="room-friend"><span class="room-friend-avatar">'+avatarHtml(f)+'</span><span class="room-friend-info"><strong>'+esc(f.name||f.userId||'Friend')+'</strong><small>'+(joined.has(f.uid)?'Already here':'Connected friend')+'</small></span><button type="button" data-invite="'+f.uid+'" '+(joined.has(f.uid)?'disabled':'')+'>'+(joined.has(f.uid)?'Joined':'Invite')+'</button></div>').join('');
  host.querySelectorAll('[data-invite]').forEach(b=>b.onclick=()=>inviteFriend(b.dataset.invite,b));
 }catch(e){host.innerHTML='<div class="room-empty">Could not load friends.</div>'}
}
async function inviteFriend(uid,btn){
 if(room?.hostUid!==me.uid)return showToast('Only the host can invite friends.','warn');
 btn.disabled=true;btn.textContent='Sending…';
 try{await setDoc(doc(db,'rooms',id,'invites',uid),{targetUid:uid,hostUid:me.uid,hostName:p.name||me.displayName||'User',roomTitle:room.title||'Live room',roomId:id,status:'pending',createdAtMs:Date.now()});
  await createNotificationViaWorker(uid,{type:'room_invite',actorName:p.name||me.displayName||'User',text:(p.name||'A friend')+' invited you to '+(room.title||'a live room'),title:'Join '+(room.title||'live room'),urlPath:'room.html?id='+encodeURIComponent(id),roomId:id});
  btn.textContent='Invited ✓';
 }catch(e){try{await deleteDoc(doc(db,'rooms',id,'invites',uid))}catch(_){}btn.disabled=false;btn.textContent='Invite';showToast(e.message||'Invite failed.','error')}
}
async function startVoice(){
 if(voiceReady)return;
 try{localStream=await navigator.mediaDevices.getUserMedia({audio:true});localStream.getAudioTracks().forEach(t=>t.enabled=false);voiceReady=true;$('voiceStatus').textContent='Mic ready';connectVoicePeers()}catch(e){$('voiceStatus').textContent='Voice unavailable';showToast('Microphone permission is needed for voice.','warn')}
}
function voicePc(uid){
 if(voicePCs.has(uid))return voicePCs.get(uid);
 const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
 localStream?.getTracks().forEach(t=>pc.addTrack(t,localStream));
 pc.ontrack=e=>{let a=voiceAudio.get(uid);if(!a){a=document.createElement('audio');a.autoplay=true;a.playsInline=true;$('remoteAudio').appendChild(a);voiceAudio.set(uid,a)}a.srcObject=e.streams[0];a.muted=!!voicePeers.get(uid)?.speakerMuted};
 pc.onicecandidate=e=>e.candidate&&addDoc(collection(db,'rooms',id,'rtc',pairId(me.uid,uid),'candidates'),{from:me.uid,candidate:e.candidate.toJSON(),createdAtMs:Date.now()}).catch(()=>{});
 voicePCs.set(uid,pc);return pc
}
async function watchVoicePeer(uid){
 const ref=doc(db,'rooms',id,'rtc',pairId(me.uid,uid));const pc=voicePc(uid);pendingCandidates.set(uid,pendingCandidates.get(uid)||[]);
 const stop=onSnapshot(ref,async s=>{if(!s.exists())return;const d=s.data();try{if(d.offer&&d.offerFrom!==me.uid&&!pc.currentRemoteDescription){await pc.setRemoteDescription(d.offer);for(const candidate of pendingCandidates.get(uid)||[])await pc.addIceCandidate(candidate).catch(()=>{});pendingCandidates.set(uid,[]);const ans=await pc.createAnswer();await pc.setLocalDescription(ans);await setDoc(ref,{answer:{type:ans.type,sdp:ans.sdp},answerFrom:me.uid,updatedAtMs:Date.now()},{merge:true})}else if(d.answer&&d.answerFrom!==me.uid&&!pc.currentRemoteDescription&&pc.localDescription){await pc.setRemoteDescription(d.answer)}}catch(e){console.warn('voice signalling',e)}});rtcUnsubs.push(stop);
 const cand=onSnapshot(query(collection(db,'rooms',id,'rtc',pairId(me.uid,uid),'candidates'),orderBy('createdAtMs','asc'),limit(100)),s=>s.docChanges().forEach(ch=>{const d=ch.doc.data();if(ch.type==='added'&&d.from!==me.uid){const candidate=new RTCIceCandidate(d.candidate);if(pc.remoteDescription)pc.addIceCandidate(candidate).catch(()=>{});else pendingCandidates.get(uid)?.push(candidate)}}));rtcUnsubs.push(cand);
 if(me.uid<uid){try{const offer=await pc.createOffer();await pc.setLocalDescription(offer);await setDoc(ref,{offer:{type:offer.type,sdp:offer.sdp},offerFrom:me.uid,updatedAtMs:Date.now()},{merge:true})}catch(e){}}
}
async function connectVoicePeers(){for(const uid of voicePeers.keys())if(uid!==me.uid&&!voicePCs.has(uid))await watchVoicePeer(uid)}
function renderVoiceMembers(s){
 const ids=new Set(s.docs.map(d=>d.data().uid));for(const uid of [...voicePeers.keys()])if(!ids.has(uid)){voicePCs.get(uid)?.close();voicePCs.delete(uid);voiceAudio.get(uid)?.remove();voiceAudio.delete(uid);voicePeers.delete(uid)}
 s.docs.forEach(d=>{const m=d.data();if(m.uid!==me.uid)voicePeers.set(m.uid,{...m,speakerMuted:voicePeers.get(m.uid)?.speakerMuted||false})});
 if(voiceReady)connectVoicePeers();
 const list=$('memberList');if(!list)return;
 list.querySelectorAll('.room-member').forEach(row=>{const uid=row.dataset.uid;const m=uid?([uid,voicePeers.get(uid)]):null;if(!m||!m[1]||row.querySelector('[data-speaker]'))return;const b=document.createElement('button');b.type='button';b.className='room-member-speaker';b.dataset.speaker=m[0];b.textContent=m[1].speakerMuted?'🔇':'🔊';b.onclick=()=>{const x=voicePeers.get(m[0]);x.speakerMuted=!x.speakerMuted;const a=voiceAudio.get(m[0]);if(a)a.muted=x.speakerMuted;b.textContent=x.speakerMuted?'🔇':'🔊'};row.appendChild(b)})
}
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
 if(room.hostUid===me.uid){loadFriends();$('inviteBtn').hidden=false}else $('inviteBtn').hidden=true;
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
     if(activity.type==='build' && (room.activitySource==='catalog'||activity.engineId||activity.interaction?.kind==='build')){
       stopSharedWorkspace=await mountSharedBuildWorkspace($('roomWorkspace'),{db,roomId:id,activity,me,onStateChange:(result)=>{if(result?.passed)$('roomWorkspaceStatus').textContent='Shared build complete ✓ Everyone reached a valid solution.'}});
     }else if((activity.type==='puzzle'||activity.type==='learn') && (room.activitySource==='catalog'||activity.engineId||activity.interaction?.kind==='quiz')){
       stopSharedWorkspace=await mountSharedQuizWorkspace($('roomWorkspace'),{db,roomId:id,activity,me,mode:activity.type,onStateChange:(result)=>{if(result?.passed)$('roomWorkspaceStatus').textContent=activity.type==='learn'?'Concept understood by the room ✓':'Shared puzzle solved ✓'}});
     }else if(activity.type==='challenge' && (room.activitySource==='catalog'||activity.engineId||activity.interaction?.kind==='challenge')){
       stopSharedWorkspace=await mountSharedChallengeWorkspace($('roomWorkspace'),{db,roomId:id,activity,me,hostUid:room.hostUid});
     }
   }
 }
 onSnapshot(query(collection(db,'rooms',id,'members'),orderBy('joinedAtMs','asc'),limit(20)),s=>{
   $('roomPeopleBadge').textContent=s.size+' / '+(room.maxPlayers||3);
   $('memberList').innerHTML=s.docs.map(d=>{const m=d.data();return '<div class="room-member" data-uid="'+esc(m.uid)+'"><span class="room-member-avatar">'+avatarHtml({name:m.name,photoURL:m.photoURL})+'</span><span class="room-member-name">'+esc(m.name||'User')+'</span><span class="room-member-role">'+(m.uid===room.hostUid?'Host':'Member')+'</span></div>'}).join('');
 });
 onSnapshot(query(collection(db,'rooms',id,'members'),orderBy('joinedAtMs','asc'),limit(20)),renderVoiceMembers);
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
$('inviteBtn')?.addEventListener('click',async()=>{const panel=$('invitePanel');if(!panel)return;panel.hidden=!panel.hidden;if(!panel.hidden)await loadFriends()});
$('closeInviteBtn')?.addEventListener('click',()=>$('invitePanel').hidden=true);
$('micBtn')?.addEventListener('click',async()=>{if(!voiceReady)await startVoice();if(!voiceReady)return;micEnabled=!micEnabled;localStream.getAudioTracks().forEach(t=>t.enabled=micEnabled);$('micBtn').textContent=micEnabled?'🎙️ Mic on':'🎙️ Mic off';$('micBtn').classList.toggle('is-on',micEnabled);$('voiceStatus').textContent=micEnabled?'Others can hear you':'You can hear others'});
$('chatToggleBtn')?.addEventListener('click',()=>{const chat=document.querySelector('.room-chat');const btn=$('chatToggleBtn');if(!chat||!btn)return;const collapsed=chat.classList.toggle('is-collapsed');btn.textContent=collapsed?'Chat':'Hide';btn.setAttribute('aria-expanded',String(!collapsed));});
onAuthStateChanged(auth,async u=>{if(!u)return location.href='login.html?redirect=room.html?id='+encodeURIComponent(id||'');me=u;const s=await getDoc(doc(db,'users',u.uid));p=s.exists()?s.data():{};await load()});
window.addEventListener('beforeunload',()=>{rtcUnsubs.forEach(fn=>fn());voicePCs.forEach(pc=>pc.close());voiceAudio.forEach(a=>a.remove());localStream?.getTracks().forEach(t=>t.stop());stopSharedWorkspace?.();});
