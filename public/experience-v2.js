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
 sparks.slice(0,3).forEach((s,idx)=>{const c=el('article','td-v2-spark',\`<b>\${s[0]}</b><strong>\${s[1]}</strong><span>\${s[2]}</span>\`);c.dataset.spark=idx;grid.appendChild(c);});
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
function run(){if(isToday){addPulse();addSparkSection();enrichFocus();}if(isChallenge)challengeMotion();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();setTimeout(run,1200);
})();