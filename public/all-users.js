import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, query, where, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const CHALLENGES = [
  {id:'choice-trip',q:'You get one free trip tomorrow. Where are you going?',o:['Japan 🇯🇵','Switzerland 🇨🇭','Somewhere unexpected 🌍'],tag:'CHOICE'},
  {id:'choice-night',q:'It is 10 PM and you have one free hour. What sounds better?',o:['Talk to someone 💬','Play something 🎮','Learn something 🧠'],tag:'MOOD'},
  {id:'choice-build',q:'You have one weekend to make something. What do you pick?',o:['An app 💻','A game 🎮','Something useful 🛠️'],tag:'MAKE'},
  {id:'choice-food',q:'Pick one forever: street food, home food or restaurant food?',o:['Street 🌮','Home 🍲','Restaurant 🍽️'],tag:'LIFE'}
];
let previewIndex=0;

function renderPreview(){
  const host=document.getElementById('challengePreview'); if(!host)return;
  const c=CHALLENGES[previewIndex%CHALLENGES.length];
  host.innerHTML='<div class="challenge-card-question">'+c.q+'</div><div class="challenge-options">'+c.o.map((x,i)=>'<button class="challenge-option" type="button" data-choice="'+i+'">'+x+'<small>Choose this</small></button>').join('')+'</div>';
  host.querySelectorAll('[data-choice]').forEach(btn=>btn.onclick=()=>{
    const selected=Number(btn.dataset.choice);
    localStorage.setItem('trio_last_challenge',JSON.stringify({id:c.id,choice:selected,at:Date.now()}));
    host.innerHTML='<div class="challenge-card-question">Locked in ✓</div><p style="margin:8px 0 0;color:var(--color-ink-muted);font-size:11px">Your choice is saved. Open Challenges to continue the interaction.</p><a class="nkm-btn nkm-btn--primary" href="challenge.html?id='+encodeURIComponent(c.id)+'" style="display:inline-flex;margin-top:12px">See the room →</a>';
  });
}
renderPreview();

let roomsUnsubscribe=null;
function initRoomListener(user){
  if(roomsUnsubscribe){roomsUnsubscribe();roomsUnsubscribe=null;}
  const host=document.getElementById('discoverRoomList'); if(!host)return;
  if(!user){host.innerHTML='<div class="discover-empty">Sign in to see live rooms.</div>';return;}
  const q=query(collection(db,'rooms'),where('status','==','open'),limit(12));
  roomsUnsubscribe=onSnapshot(q,snap=>{
    const now=Date.now();
    const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>(Number(r.expiresAtMs)||now+21600000)>now).sort((a,b)=>(b.createdAtMs||0)-(a.createdAtMs||0)).slice(0,8);
    host.innerHTML=rows.length?rows.map(room=>'<a class="live-room-card" href="room.html?id='+encodeURIComponent(room.id)+'"><span class="live-room-pulse"><i></i></span><span class="live-room-copy"><strong>'+String(room.title||'Open room')+'</strong><small><span class="live-dot">LIVE</span> '+Number(room.memberCount||0)+'/'+Number(room.maxPlayers||6)+' people</small></span><span class="live-room-arrow">↗</span></a>').join(''):'<div class="discover-empty">No live rooms right now. Start a challenge and invite someone.</div>';
  },()=>{host.innerHTML='<div class="discover-empty">Live rooms are temporarily unavailable.</div>';});
}
onAuthStateChanged(auth,initRoomListener);
