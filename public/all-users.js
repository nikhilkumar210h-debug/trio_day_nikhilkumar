import { auth } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

const CHALLENGES = [
  {id:'trip',q:'You get one free trip tomorrow. Where are you going?',o:['Japan 🇯🇵','Switzerland 🇨🇭','Somewhere unexpected 🌍'],tag:'CHOICE'},
  {id:'hour',q:'It is 10 PM and you have one free hour. What sounds better?',o:['Talk to someone 💬','Play something 🎮','Learn something 🧠'],tag:'MOOD'},
  {id:'weekend',q:'You have one weekend to make something. What do you pick?',o:['An app 💻','A game 🎮','Something useful 🛠️'],tag:'MAKE'},
  {id:'food',q:'Pick one forever: street food, home food or restaurant food?',o:['Street 🌮','Home 🍲','Restaurant 🍽️'],tag:'LIFE'}
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
