import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { listCommunityTasks, isMember, joinTask } from './gamification/community-tasks.js';
import { getMyProfile } from './services/userCache.js';
import { escapeHtml as esc } from './utils.js';
const $=id=>document.getElementById(id); let me=null, profile=null, challenges=[];
const difficulty=c=>c.difficulty||(Number(c.target)>5?'Hard':Number(c.target)>2?'Medium':'Easy');
const category=c=>c.category||c.kindLabel||'Challenge';
const minutes=c=>Number(c.durationMinutes||c.timeMinutes||c.time||0);
const rating=c=>Number(c.ratingAverage||c.rating||0);
function render(){
 const q=($('usersSearch').value||'').toLowerCase().trim(),cat=$('categoryFilter').value,diff=$('difficultyFilter').value,tm=Number($('timeFilter').value)||0,mr=Number($('ratingFilter').value)||0,sort=$('sortFilter').value;
 let list=challenges.filter(c=>{const text=[c.title,c.description,c.creatorName,category(c)].join(' ').toLowerCase();return(!q||text.includes(q))&&(!cat||category(c)===cat)&&(!diff||difficulty(c)===diff)&&(!tm||!minutes(c)||minutes(c)<=tm)&&(!mr||rating(c)>=mr)});
 list.sort((a,b)=>sort==='rating'?rating(b)-rating(a):sort==='new'?(b.createdAtMs||0)-(a.createdAtMs||0):sort==='ending'?(a.endAtMs||Infinity)-(b.endAtMs||Infinity):(b.completions||0)+(b.joins||0)*.25-(a.completions||0)-(a.joins||0)*.25);
 const grid=$('challengeGrid'); if(!list.length){grid.innerHTML='<div class="discover-empty">No challenges match these filters.</div>';return;}
 grid.innerHTML=list.map(c=>'<article class="discover-card"><a href="task-detail.html?id='+encodeURIComponent(c.id)+'" style="color:inherit;text-decoration:none"><div class="challenge-art">'+esc(c.artEmoji||c.icon||'✦')+'</div><div class="challenge-body"><h2 class="challenge-title">'+esc(c.title||'Challenge')+'</h2><div class="challenge-objective">'+esc(c.objective||c.description||'Complete this challenge.')+'</div><div class="challenge-meta"><span class="pill">'+esc(category(c))+'</span><span class="pill">'+esc(difficulty(c))+'</span><span class="pill">'+(minutes(c)?minutes(c)+' min':'Flexible')+'</span></div><div class="challenge-stats"><div><strong>'+Number(c.joins||0)+'</strong>Accepted</div><div><strong>'+Number(c.solvingNow||0)+'</strong>Solving now</div><div><strong>'+(rating(c)?rating(c).toFixed(1)+' ★':'New')+'</strong>Rating</div></div><button class="accept-btn" type="button" data-accept="'+esc(c.id)+'">'+(c._joined?'REJECT':'ACCEPT')+'</button></div></a></article>').join('');
 grid.querySelectorAll('[data-accept]').forEach(btn=>btn.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();const id=btn.dataset.accept;if(!me)return;if(challenges.find(c=>c.id===id)?._joined){location.href='task-detail.html?id='+encodeURIComponent(id)+'&confirmReject=1';return;}btn.disabled=true;btn.textContent='…';try{await joinTask(id,me.uid,profile);const c=challenges.find(x=>x.id===id);if(c)c._joined=true;render();}catch(err){alert(err.message||'Could not accept challenge');btn.disabled=false;btn.textContent='ACCEPT';}});
}
async function load(){ $('challengeGrid').innerHTML='<div class="nkm-skeleton" style="height:310px;border-radius:18px"></div><div class="nkm-skeleton" style="height:310px;border-radius:18px"></div>';try{challenges=await listCommunityTasks({status:'active',max:60});if(me)challenges=await Promise.all(challenges.map(async c=>({...c,_joined:await isMember(c.id,me.uid)})));render();}catch(e){console.error(e);$('challengeGrid').innerHTML='<div class="discover-empty">Could not load challenges.</div>';}}
['usersSearch','categoryFilter','difficultyFilter','timeFilter','ratingFilter','sortFilter'].forEach(id=>$(id).addEventListener(id==='usersSearch'?'input':'change',render));
onAuthStateChanged(auth,async u=>{me=u;if(u)profile=await getMyProfile(u.uid);await load();});
