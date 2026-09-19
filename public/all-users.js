import { auth } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { listCommunityTasks, isMember, joinTask } from './gamification/community-tasks.js';
import { getMyProfile } from './services/userCache.js';
import { escapeHtml as esc } from './utils.js';

const $ = id => document.getElementById(id);
let me = null;
let profile = null;
let challenges = [];
let refreshTimer = null;

const categoryList = ['Logic','Observation','Speed','Reasoning','Memory','Decision','Knowledge'];
const difficultyList = ['Easy','Medium','Hard'];

function getDifficulty(c) {
  return c.difficulty || (Number(c.target) > 5 ? 'Hard' : Number(c.target) > 2 ? 'Medium' : 'Easy');
}
function getCategory(c) { return c.category || c.kindLabel || 'Challenge'; }
function getMinutes(c) { return Number(c.durationMinutes ?? c.timeMinutes ?? c.time ?? 0); }
function getRating(c) { return Number(c.ratingAverage ?? c.rating ?? 0); }
function qualityScore(c) {
  const rating = getRating(c);
  const ratingConfidence = Math.min(1, Number(c.ratingCount || 0) / 8);
  const completionRate = Number(c.joins) > 0 ? Math.min(1, Number(c.completions || 0) / Number(c.joins)) : 0;
  const activity = Math.min(1, (Number(c.solvingNow || 0) + Number(c.joins || 0)) / 20);
  return (rating / 5) * 0.48 * (0.5 + ratingConfidence / 2) + completionRate * 0.20 + activity * 0.12 + Math.min(1, (Number(c.joins||0)/50)) * 0.08 + (c.challengeType === 'mystery' ? 0.02 : 0);
}
function endingLabel(ms) {
  const diff = Number(ms || 0) - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 'Ending';
  const h = Math.ceil(diff / 3600000);
  if (h < 24) return `Ends in ${h}h`;
  const d = Math.ceil(h / 24);
  return `Ends in ${d}d`;
}

function updateOverview(joined = 0) {
  const set=(id,v)=>{const el=$(id);if(el)el.textContent=String(v)};
  set('discoverCount', challenges.length);
  set('discoverMysteryCount', challenges.filter(c=>c.challengeType==='mystery').length);
  set('discoverJoinedCount', joined);
  const line=$('peopleStatus');
  if(line)line.textContent=`${challenges.length} live challenges`;
}

async function render() {
  const search = ($('usersSearch')?.value || '').toLowerCase().trim();
  const category = $('categoryFilter')?.value || '';
  const difficulty = $('difficultyFilter')?.value || '';
  const maxTime = Number($('timeFilter')?.value || 0);
  const minRating = Number($('ratingFilter')?.value || 0);
  const sort = $('sortFilter')?.value || 'active';

  let list = challenges.filter(c => {
    const text=[c.title,c.description,c.objective,c.creatorName,getCategory(c)].filter(Boolean).join(' ').toLowerCase();
    const minutes=getMinutes(c);
    return (!search || text.includes(search))
      && (!category || getCategory(c)===category)
      && (!difficulty || getDifficulty(c)===difficulty)
      && (!maxTime || !minutes || minutes<=maxTime)
      && (!minRating || getRating(c)>=minRating);
  });

  list.sort((a,b)=>{
    if(sort==='rating') return getRating(b)-getRating(a) || Number(b.ratingCount||0)-Number(a.ratingCount||0);
    if(sort==='new') return Number(b.createdAtMs||0)-Number(a.createdAtMs||0);
    if(sort==='ending') return (Number(a.endAtMs)||Infinity)-(Number(b.endAtMs)||Infinity);
    return qualityScore(b)-qualityScore(a) || Number(b.createdAtMs||0)-Number(a.createdAtMs||0);
  });

  const joinedCount=challenges.filter(c=>c._joined).length;
  updateOverview(joinedCount);
  const countEl=$('discoverResultCount'); if(countEl) countEl.textContent=`${list.length} shown`;

  const grid=$('challengeGrid'); if(!grid)return;
  if(!list.length){
    grid.innerHTML='<div class="discover-empty"><strong>No challenge matched.</strong>Try another keyword or loosen a filter.</div>';
    return;
  }
  grid.innerHTML=list.map(c=>{
    const category=getCategory(c), difficulty=getDifficulty(c), minutes=getMinutes(c), rating=getRating(c);
    const art=esc(c.artEmoji||c.icon||(c.challengeType==='mystery'?'🕵️':'✦'));
    const type=c.challengeType==='mystery'?'Mystery case':'Challenge';
    const ratingText=rating?rating.toFixed(1)+' ★':'New';
    return `<article class="discover-card">
      <a href="task-detail.html?id=${encodeURIComponent(c.id)}" class="discover-card-link">
        <div class="challenge-art"><span>${art}</span><span class="challenge-type">${type}</span></div>
        <div class="challenge-body">
          <h2 class="challenge-title">${esc(c.title||'Challenge')}</h2>
          <div class="challenge-objective">${esc(c.objective||c.description||'Complete this challenge.')}</div>
          <div class="challenge-meta"><span class="pill">${esc(category)}</span><span class="pill">${esc(difficulty)}</span><span class="pill">${minutes?minutes+' min':'Flexible'}</span><span class="pill">${esc(endingLabel(c.endAtMs))}</span></div>
          <div class="challenge-stats"><div><strong>${Number(c.joins||0)}</strong>Accepted</div><div><strong>${Number(c.solvingNow||0)}</strong>Solving now</div><div><strong>${ratingText}</strong>Rating</div></div>
        </div>
      </a>
      <div class="discover-card-footer"><button class="accept-btn ${c._joined?'joined':''}" type="button" data-accept="${esc(c.id)}" data-state="${c._joined?'joined':'new'}">${c._joined?'REJECT':'ACCEPT'}</button></div>
    </article>`;
  }).join('');

  grid.querySelectorAll('[data-accept]').forEach(btn=>{
    btn.addEventListener('click',async e=>{
      e.preventDefault();e.stopPropagation();
      const c=challenges.find(x=>x.id===btn.dataset.accept);
      if(!me||!c)return;
      if(c._joined){location.href=`task-detail.html?id=${encodeURIComponent(c.id)}&confirmReject=1`;return;}
      btn.disabled=true;btn.textContent='…';
      try{await joinTask(c.id,me.uid,profile);c._joined=true;render();}
      catch(err){console.error(err);alert(err.message||'Could not accept challenge.');btn.disabled=false;btn.textContent='ACCEPT';}
    });
  });
}

async function loadChallenges() {
  const grid=$('challengeGrid'); if(!grid)return;
  if(!challenges.length)grid.innerHTML='<div class="nkm-skeleton" style="height:360px;border-radius:22px"></div><div class="nkm-skeleton" style="height:360px;border-radius:22px"></div><div class="nkm-skeleton" style="height:360px;border-radius:22px"></div>';
  try{
    challenges=await listCommunityTasks({status:'active',max:60});
    if(me){
      challenges=await Promise.all(challenges.map(async c=>({...c,_joined:await isMember(c.id,me.uid)})));
    }
    await render();
  }catch(error){
    console.error('Discover load failed:',error);
    grid.innerHTML='<div class="discover-empty"><strong>Discover is unavailable.</strong>Please refresh and try again.</div>';
  }
}

function bindFilters(){
  ['usersSearch','categoryFilter','difficultyFilter','timeFilter','ratingFilter','sortFilter'].forEach(id=>{
    const el=$(id);if(!el)return;
    el.addEventListener(id==='usersSearch'?'input':'change',render);
  });
}
bindFilters();
onAuthStateChanged(auth,async user=>{
  me=user;
  if(user)profile=await getMyProfile(user.uid);
  await loadChallenges();
  clearInterval(refreshTimer);
  refreshTimer=setInterval(()=>loadChallenges(),45*1000);
});
