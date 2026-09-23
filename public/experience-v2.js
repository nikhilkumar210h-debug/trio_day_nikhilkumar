/* Trio Day Experience V2 — visual rhythm layer */
(function(){
'use strict';
const isToday=document.body.classList.contains('today-page')||location.pathname.endsWith('/index.html')||location.pathname==='/';
const isChallenge=document.body.classList.contains('app-page')&&location.pathname.includes('challenge.html');
const sparks=[
['⚡','Quick spark','Pick fast. Trust your first instinct.'],
['🧠','Think different','Your answer is only interesting when someone disagrees.'],
['🌍','Open the room','See how your choice compares with the community.'],
['🎯','One more move','Finish today’s moment, then explore what’s next.'],
['✨','Fresh perspective','A tiny decision can start a real conversation.'],
['🔥','Keep your streak','Come back tomorrow for a different moment.']
];
function el(tag,cls,html){const n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n;}
function addPulse(){
 const home=document.querySelector('.nkm-home');if(!home||document.querySelector('.td-v2-pulse'))return;
 const p=el('section','td-v2-pulse');p.setAttribute('aria-label','Trio Day live pulse');
 p.innerHTML='<div class="td-v2-pulse-icon">✦</div><div class="td-v2-pulse-copy"><strong id="tdV2PulseTitle">A new moment starts here</strong><span id="tdV2PulseText">Answer, compare, then find your next move.</span></div><div class="td-v2-pulse-time" id="tdV2PulseTime">NOW</div>';
 const stories=document.getElementById('storiesStrip');home.insertBefore(p,stories||home.firstElementChild?.nextSibling);
 let i=Math.floor(Date.now()/60000)%sparks.length;
 const paint=()=>{const s=sparks[i%sparks.length],a=p.querySelector('#tdV2PulseTitle'),b=p.querySelector('#tdV2PulseText'),t=p.querySelector('#tdV2PulseTime');if(a)a.textContent=s[1];if(b)b.textContent=s[2];if(t)t.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});i++;};
 paint();setInterval(paint,60000);
}
function addSparkSection(){
 const home=document.querySelector('.nkm-home'),focus=document.getElementById('todayFocus');if(!home||!focus||document.querySelector('.td-v2-section'))return;
 const section=el('section','td-v2-section');section.innerHTML='<div class="td-v2-section-head"><h2>Little things worth doing</h2><span>FRESH MOMENTS</span></div><div class="td-v2-sparks"></div>';
 const grid=section.querySelector('.td-v2-sparks');
 sparks.slice(0,3).forEach((s,idx)=>{const c=el('article','td-v2-spark',`<b>${s[0]}</b><strong>${s[1]}</strong><span>${s[2]}</span>`);c.dataset.spark=idx;grid.appendChild(c);});
 const rail=el('div','td-v2-rail');rail.innerHTML='<span class="td-v2-chip"><b>Today</b> · make one choice</span><span class="td-v2-chip"><b>Explore</b> · meet a new perspective</span><span class="td-v2-chip"><b>Connect</b> · start a conversation</span>';section.appendChild(rail);
 home.insertBefore(section,document.getElementById('continueSection')||null);
}
function enrichFocus(){
 const primary=document.getElementById('focusPrimary');if(!primary)return;
 const observer=new MutationObserver(()=>{const card=primary.querySelector('.focus-card');if(card)card.classList.add('td-v2-focus-ready');});
 observer.observe(primary,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),12000);
}
function challengeMotion(){
 document.querySelectorAll('.challenge-main-options button').forEach(b=>{b.addEventListener('pointerdown',()=>b.classList.add('td-v2-press'),{passive:true});b.addEventListener('pointerup',()=>setTimeout(()=>b.classList.remove('td-v2-press'),160),{passive:true});});
}

async function loadFreshCommunity(){
 const feed=document.getElementById('todayFreshChallenges'); if(!feed||feed.dataset.loaded)return;
 try{
  const mod=await import('./gamification/community-tasks.js?v=20260923-v2feed');
  const items=await mod.listCommunityTasks({status:'active',max:12});
  const fresh=Array.isArray(items)?items.slice(0,3):[];
  if(!fresh.length){
   feed.innerHTML='<article class="td-v2-feed-card"><div class="td-v2-feed-top"><span class="td-v2-feed-tag">START HERE</span><span class="td-v2-feed-time">NOW</span></div><h3>Be the person who starts the next conversation.</h3><div class="td-v2-feed-options"><span>Create a challenge</span><span>Invite someone</span></div><div class="td-v2-feed-foot"><small>Your next moment can be yours.</small><a href="challenge-create.html">Create →</a></div></article>';
  }else{
   feed.innerHTML=fresh.map((c,i)=>{
    const title=escapeHtmlV2(c.title||c.question||'Community challenge');
    const desc=escapeHtmlV2(c.description||'Make a quick choice and compare.');
    const icon=escapeHtmlV2(c.icon||['⚡','✦','◎'][i%3]);
    const id=encodeURIComponent(c.id||'');
    const count=Number(c.joins||c.completions||0);
    return '<article class="td-v2-feed-card"><div><div class="td-v2-feed-top"><span class="td-v2-feed-tag">'+icon+' · COMMUNITY</span><span class="td-v2-feed-time">FRESH</span></div><h3>'+title+'</h3><div class="td-v2-feed-options"><span>'+desc.slice(0,55)+'</span></div></div><div class="td-v2-feed-foot"><small>'+count+' people moving through it</small><a href="challenge.html?challenge='+id+'">Open →</a></div></article>';
   }).join('');
  }
  feed.dataset.loaded='1';
 }catch(e){
  console.warn('[experience-v2] fresh community feed failed',e);
  feed.innerHTML='<article class="td-v2-feed-card"><div><span class="td-v2-feed-tag">YOUR MOMENT</span><h3>What would you choose if nobody could judge the answer?</h3></div><div class="td-v2-feed-foot"><small>Start with the daily challenge.</small><a href="challenge.html">Go →</a></div></article>';
  feed.dataset.loaded='1';
 }
}
function escapeHtmlV2(value){
 return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function rotateNextMoment(){
 const title=document.getElementById('todayNextTitle'),text=document.getElementById('todayNextText'),copy=document.getElementById('todayLiveCopy');
 if(!title)return;
 const moments=[
 ['Make one choice.','Then see who thinks differently.','Fresh challenges are waiting.'],
 ['Find one person.','Start with something you both answered.','Someone new can change the moment.'],
 ['Ask something.','Give the community a reason to respond.','New questions keep Today moving.'],
 ['Come back later.','The room should feel different in an hour.','Today is a moving timeline, not a checklist.']
 ];
 let i=Math.floor(Date.now()/60000)%moments.length;
 const paint=()=>{const m=moments[i%moments.length];title.textContent=m[0];text.textContent=m[1];if(copy)copy.textContent=m[2];i++;};
 paint();setInterval(paint,60000);
}

function run(){if(isToday){addPulse();addSparkSection();enrichFocus();loadFreshCommunity();rotateNextMoment();}if(isChallenge)challengeMotion();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();setTimeout(run,1200);
})();