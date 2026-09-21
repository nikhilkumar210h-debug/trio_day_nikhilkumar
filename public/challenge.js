import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, doc, getDocs, query, where, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { listCommunityTasks } from './gamification/community-tasks.js?v=20260919-community5';

const CHALLENGES=[
{id:'trip',tag:'CHOICE',q:'You get one free trip tomorrow. Where are you going?',o:['Japan 🇯🇵','Switzerland 🇨🇭','Somewhere unexpected 🌍']},
{id:'hour',tag:'MOOD',q:'You have one free hour tonight. What sounds better?',o:['Talk to someone 💬','Play something 🎮','Learn something 🧠']},
{id:'weekend',tag:'MAKE',q:'You have one weekend to make something. What do you pick?',o:['An app 💻','A game 🎮','Something useful 🛠️']},
{id:'food',tag:'LIFE',q:'Pick one forever.',o:['Street food 🌮','Home food 🍲','Restaurant food 🍽️']}
];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const host=document.getElementById('challengeList'); let currentUser=null; const cards=new Map();

async function getCounts(id){
 try{
  const snap=await getDocs(query(collection(db,'challengeAnswers'),where('challengeId','==',id)));
  const counts={}; snap.forEach(d=>{const n=Number(d.data().choice);counts[n]=(counts[n]||0)+1;});
  return counts;
 }catch(err){console.warn('challenge counts unavailable',err);return {};}
}
function addCard(c){
 const card=document.createElement('article');card.className='challenge-main-card';
 card.innerHTML='<span class="challenge-tag">'+esc(c.tag||'COMMUNITY')+'</span><h2>'+esc(c.q)+'</h2><div class="challenge-main-options">'+c.o.map((x,i)=>'<button type="button" data-choice="'+i+'">'+esc(x)+'</button>').join('')+'</div><div class="challenge-result" hidden></div><div class="challenge-links" hidden><a class="nkm-btn nkm-btn--secondary" href="chat.html?challenge='+encodeURIComponent(c.id)+'">Discuss in Chat →</a><a class="nkm-btn nkm-btn--primary" href="all-users.html">Next Challenge →</a></div>';
 const result=card.querySelector('.challenge-result'),links=card.querySelector('.challenge-links'); cards.set(c.id,{card,result,links,c});
 card.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',async()=>{
   if(!currentUser)return;
   const choice=Number(btn.dataset.choice);
   try{
    await setDoc(doc(db,'challengeAnswers',currentUser.uid+'_'+c.id),{challengeId:c.id,uid:currentUser.uid,choice,createdAt:serverTimestamp(),createdAtMs:Date.now()},{merge:true});
    localStorage.setItem('trio_last_challenge',JSON.stringify({id:c.id,choice,at:Date.now()}));
    card.querySelectorAll('[data-choice]').forEach(x=>x.disabled=true);
    const counts=await getCounts(c.id), total=Object.values(counts).reduce((a,b)=>a+b,0), same=counts[choice]||1;
    result.hidden=false;result.innerHTML='<strong>'+same+' people</strong> chose this answer · '+total+' total response'+(total===1?'':'s');
    links.hidden=false;
    card.querySelectorAll('[data-choice]').forEach((x,i)=>{x.textContent=c.o[i]+' · '+(counts[i]||0);});
   }catch(err){console.error(err);result.hidden=false;result.textContent='Could not save your answer. Please try again.';}
 });
 host?.appendChild(card);
}
async function hydrateCounts(){
 for(const [id,{card,c}] of cards){
  const counts=await getCounts(id);
  card.querySelectorAll('[data-choice]').forEach((x,i)=>{if(counts[i])x.textContent=c.o[i]+' · '+counts[i];});
 }
}
async function loadCommunityChallenges(){
 if(!host)return;
 try{
   const tasks=await listCommunityTasks({kind:'challenge',status:'active',max:12});
   const custom=tasks.filter(t=>t.interaction?.kind==='choice'&&t.interaction?.question&&Array.isArray(t.interaction?.options));
   if(custom.length){const heading=document.createElement('div');heading.className='challenge-community-heading';heading.innerHTML='<span class="challenge-tag">COMMUNITY</span><h2>Questions from people</h2><p>Real prompts created by the community.</p>';host.prepend(heading);custom.forEach(t=>addCard({id:t.id,tag:'COMMUNITY',q:t.interaction.question,o:t.interaction.options}));}
   await hydrateCounts();
 }catch(err){console.warn('community challenges unavailable',err);}
}
onAuthStateChanged(auth,u=>{currentUser=u;if(u)hydrateCounts();});
CHALLENGES.forEach(addCard);
loadCommunityChallenges();
