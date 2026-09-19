import{auth,db}from'./firebase-init.js';
import{onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import{collection,query,where,limit,getDocs,getDoc,doc}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import{ACTIVITY_TYPES,activityCardHtml,activityCategoryCard,roomCardHtml,normalizeActivityType}from'./activity-ui.js';
const $=id=>document.getElementById(id);
let activities=[],active=new URLSearchParams(location.search).get('activity')||'all',activeSub='all';
const categories=Object.keys(ACTIVITY_TYPES);
function renderCategories(){ $('activityCategories').innerHTML=categories.map(activityCategoryCard).join('');document.querySelectorAll('[data-activity-filter]').forEach(b=>b.onclick=()=>{active=b.dataset.activityFilter;activeSub='all';syncFilters();render()})}
function syncFilters(){activeSub='all';$('activityFilters').innerHTML='<button class="activity-filter-btn '+(active==='all'?'is-active':'')+'" data-filter="all">All</button>'+categories.map(k=>'<button class="activity-filter-btn '+(active===k?'is-active':'')+'" data-filter="'+k+'">'+ACTIVITY_TYPES[k].icon+' '+ACTIVITY_TYPES[k].label+'</button>').join('');document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{active=b.dataset.filter;syncFilters();render()});document.querySelectorAll('[data-activity-filter]').forEach(b=>b.classList.toggle('is-active',b.dataset.activityFilter===active));renderSubFilters()}
function renderSubFilters(){const wrap=$('activitySubFilters');if(!wrap)return;if(active==='all'){wrap.innerHTML='';wrap.hidden=true;return}const subs=[...new Set(activities.filter(t=>typeOf(t)===active).map(t=>t.category).filter(Boolean))].sort();wrap.hidden=!subs.length;wrap.innerHTML='<button class="activity-filter-btn '+(activeSub==='all'?'is-active':'')+'" data-subfilter="all">All '+ACTIVITY_TYPES[active].label+'</button>'+subs.map(s=>'<button class="activity-filter-btn '+(activeSub===s?'is-active':'')+'" data-subfilter="'+s.replace(/"/g,'&quot;')+'">'+s+'</button>').join('');wrap.querySelectorAll('[data-subfilter]').forEach(b=>b.onclick=()=>{activeSub=b.dataset.subfilter;renderSubFilters();render()})}
function typeOf(t){const r=String(t.activityType||'');if(ACTIVITY_TYPES[r])return r;const x=(t.title||'')+' '+(t.description||'');if(/puzzle|riddle|logic|pattern|brain/i.test(x))return'puzzle';if(/build|make|design|code|create/i.test(x))return'build';if(/learn|study|science|coding|technology|knowledge/i.test(x))return'learn';if(t.kind==='challenge'||/challenge|timed/i.test(x))return'challenge';return'game'}
function render(){const q=($('activitySearch').value||'').toLowerCase().trim();const list=activities.filter(t=>(active==='all'||typeOf(t)===active)&&(activeSub==='all'||String(t.category||'')===activeSub)&&(!q||[t.title,t.description,t.creatorName].some(v=>String(v||'').toLowerCase().includes(q))));$('activityHeading').textContent=active==='all'?'All activities':ACTIVITY_TYPES[active].label;$('activitySub').textContent=list.length?list.length+' activities to explore':'Nothing matches this filter yet.';$('activityList').innerHTML=list.length?list.map(t=>activityCardHtml({...t,activityType:typeOf(t)})).join(''):'<div class="nkm-empty">No activities here yet. Create the first one.</div>'}
async function load(){try{
 const snap=await getDocs(query(collection(db,'communityTasks'),where('status','==','active'),limit(60))).catch(()=>null);
 const community=snap?snap.docs.map(d=>({id:d.id,...d.data(),source:'community'})):[]; 
 const now=Date.now();
 const communityActive=community.filter(t=>!t.hidden&&((t.endAtMs||((t.createdAtMs||now)+30*86400000))>now)).map(t=>({...t,activityType:normalizeActivityType(t),source:'community'}));
 activities=[...activeCatalogActivities(),...communityActive].sort((a,b)=>
   ((b.featured?1:0)-(a.featured?1:0)) || ((b.source==='catalog'?1:0)-(a.source==='catalog'?1:0)) || ((b.createdAtMs||0)-(a.createdAtMs||0))
 );
 syncFilters();render();
 const rooms=await getDocs(query(collection(db,'rooms'),where('status','==','open'),limit(8))).catch(()=>null);
 if(!rooms){$('liveRooms').innerHTML='<div class="room-empty">Live rooms are unavailable right now. Explore activities instead.</div>';return;}
 const live=await Promise.all(rooms.docs.map(async d=>{const r={id:d.id,...d.data()};const expires=Number(r.expiresAtMs)||((Number(r.createdAtMs)||now)+6*60*60*1000);if(expires<=now)return null;const m=await getDocs(query(collection(db,'rooms',d.id,'members'),limit(20)));return {...r,memberCount:m.size,expiresAtMs:expires}}));
 const activeLive=live.filter(Boolean);
 $('liveRooms').innerHTML=activeLive.length?activeLive.map(roomCardHtml).join(''):'<div class="room-empty">No live rooms yet — start one from an activity.</div>';
}catch(e){$('activityStatus').textContent=e.message||'Could not load activities.'}}
$('activitySearch').addEventListener('input',render);
renderCategories();
onAuthStateChanged(auth,u=>{if(!u){location.href='login.html?redirect=all-users.html';return}load()});