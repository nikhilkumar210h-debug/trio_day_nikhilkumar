import { auth, db } from './firebase-init.js';
import { notifyUser } from './services/notificationHelpers.js';
import { trioCache } from './trio-cache.js';
import { escapeHtml as esc, avatarHtml } from './utils.js';
import { createSheet } from './ui/sheet.js';
import { getMyProfile } from './services/userCache.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, getDocs, doc, getDoc,
  setDoc, deleteDoc, serverTimestamp,
  query, limit, startAfter
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
let me = null, users = [];
let lastDoc = null, hasMore = true;

// cached connection state
async function getConnState(theirUid) {
  const key = `connstate_${me.uid}_${theirUid}`;
  const cached = trioCache.get(key);
  if (cached !== null) return cached;
  const exists = (await getDoc(doc(db, 'users', me.uid, 'following', theirUid)).catch(() => null))?.exists() ?? false;
  trioCache.set(key, exists, trioCache.TTL.SHORT);
  return exists;
}

function hideSkeletons() {
  ['suggestedSkel','risingSkel','activeSkel','voicesSkel'].forEach(id=>{ const e=$(id); if(e) e.hidden=true; e.style.display='none'; });
}
function showStatus(msg) { const e=$('peopleStatus'); if(e){ e.textContent=msg; e.hidden=!msg; } }

function badgeFor(u) {
  if (u.badges && Array.isArray(u.badges) && u.badges.length) return `${u.badges.length}🏅`;
  if (Number.isFinite(u.xp) && u.xp>0) return `${u.xp} XP`;
  if (u.level) return `Lv ${u.level}`;
  return '';
}

function createUserRow(u) {
  const row = document.createElement('div'); row.className='nkm-user-row';
  const badge = badgeFor(u);
  // avatar
  const av = document.createElement('a'); av.href=`profile.html?uid=${encodeURIComponent(u.uid)}`; av.className='nkm-user-avatar'; av.innerHTML=avatarHtml(u);
  // meta
  const meta = document.createElement('div'); meta.className='nkm-user-meta';
  const name = document.createElement('div'); name.className='nkm-user-name'; name.textContent=u.name||'User';
  const id = document.createElement('div'); id.className='nkm-user-id'; id.textContent=u.userId||u.uid;
  meta.append(name,id);
  if (badge) { const b=document.createElement('span'); b.className='nkm-user-badge'; b.textContent=badge; meta.appendChild(b); }
  const actions = document.createElement('div'); actions.className='nkm-user-actions';
  const connectBtn = document.createElement('button'); connectBtn.className='nkm-btn nkm-btn--primary nkm-btn--sm connect-btn'; connectBtn.type='button'; connectBtn.textContent='…'; connectBtn.disabled=true;
  const menuBtn = document.createElement('button'); menuBtn.className='nkm-user-menu'; menuBtn.type='button'; menuBtn.setAttribute('aria-label','More'); menuBtn.textContent='⋯';
  actions.append(connectBtn, menuBtn);
  row.append(av, meta, actions);
  // name click via row? keep avatar+meta clickable via wrapping anchor? Instead make name clickable
  name.style.cursor='pointer'; name.addEventListener('click',()=> location.href=`profile.html?uid=${encodeURIComponent(u.uid)}`);
  id.style.cursor='pointer'; id.addEventListener('click',()=> location.href=`profile.html?uid=${encodeURIComponent(u.uid)}`);
  // connect logic
  getConnState(u.uid).then(connected=>{
    connectBtn.textContent = connected ? 'Connected' : 'Connect';
    connectBtn.disabled=false;
    if(connected) connectBtn.classList.remove('nkm-btn--primary');
  });
  connectBtn.addEventListener('click', async e=>{
    e.preventDefault(); e.stopPropagation(); connectBtn.disabled=true;
    try{
      if(u.uid===me.uid) throw Error('You cannot connect with yourself.');
      const myRef=doc(db,'users',me.uid,'following',u.uid);
      const theirRef=doc(db,'users',u.uid,'followers',me.uid);
      const s=await getDoc(myRef);
      if(s.exists()){
        await deleteDoc(myRef); await deleteDoc(theirRef).catch(()=>{});
        connectBtn.textContent='Connect'; connectBtn.classList.add('nkm-btn--primary');
        trioCache.set(`connstate_${me.uid}_${u.uid}`, false, trioCache.TTL.SHORT);
      }else{
        const mine=await getMyProfile();
        await setDoc(myRef,{uid:u.uid,userId:u.userId||u.uid,name:u.name||'User',createdAt:serverTimestamp()});
        await setDoc(theirRef,{uid:me.uid,createdAt:serverTimestamp()});
        await notifyUser(u.uid,{type:'connect',actorUid:me.uid,actorName:mine?.name||me.displayName||'Someone'});
        connectBtn.textContent='Connected'; connectBtn.classList.remove('nkm-btn--primary');
        trioCache.set(`connstate_${me.uid}_${u.uid}`, true, trioCache.TTL.SHORT);
      }
      trioCache.invalidate(`following_${me.uid}`); trioCache.invalidate(`following_ids_${me.uid}`); trioCache.invalidate(`followers_${u.uid}`);
    }catch(err){ console.error(err); alert(err.message||'Connect failed.'); }
    finally{ connectBtn.disabled=false; }
  });
  // overflow menu via sheet
  menuBtn.addEventListener('click', e=>{
    e.stopPropagation();
    const { open, close } = createSheet({ title: u.name||'User', content: `
      <div style="display:grid;gap:8px">
        <a class="nkm-btn" href="profile.html?uid=${encodeURIComponent(u.uid)}" style="justify-content:flex-start">View Profile</a>
        <a class="nkm-btn" href="private-chat.html?uid=${encodeURIComponent(u.uid)}" style="justify-content:flex-start">Message</a>
        <button class="nkm-btn" type="button" data-copy style="justify-content:flex-start">Copy TRIO-ID</button>
      </div>
    `});
    open();
    const copyBtn = document.querySelector('[data-copy]');
    if(copyBtn){
      copyBtn.addEventListener('click', async ()=>{
        try{ await navigator.clipboard.writeText(u.userId||u.uid); copyBtn.textContent='Copied!'; setTimeout(close,800);}catch{ prompt('Copy TRIO-ID', u.userId||u.uid); }
      });
    }
  });
  return row;
}

function renderSections(filter='') {
  const q = filter.toLowerCase().trim();
  const base = users.filter(u=> u.uid && u.uid!==me.uid);
  const filtered = q ? base.filter(u=> [u.name,u.userId,u.uid].some(v=> String(v||'').toLowerCase().includes(q))) : base;
  // hide skeletons
  hideSkeletons();
  const loadMoreWrap=$('nkmLoadMoreWrap'), loadMoreBtn=$('nkmLoadMore');
  if(loadMoreBtn) loadMoreBtn.hidden = !hasMore || Boolean(q);
  // if search, show only suggested with filtered results
  if(q){
    const suggested=$('suggestedList'), empty=$('suggestedEmpty');
    const risingSec=$('risingSection'), activeSec=$('activeSection'), voicesSec=$('voicesSection');
    if(risingSec) risingSec.hidden=true; if(activeSec) activeSec.hidden=true; if(voicesSec) voicesSec.hidden=true;
    suggested.innerHTML='';
    if(!filtered.length){ suggested.innerHTML=''; empty.hidden=false; empty.textContent='No user found.'; }
    else { empty.hidden=true; filtered.slice(0,20).forEach(u=> suggested.appendChild(createUserRow(u))); }
    showStatus('');
    return;
  }
  // no filter — show discovery sections
  const risingSec=$('risingSection'), activeSec=$('activeSection'), voicesSec=$('voicesSection');
  if(risingSec) risingSec.hidden=false; if(activeSec) activeSec.hidden=false; if(voicesSec) voicesSec.hidden=false;
  // Suggested People: not connected, up to 5
  (async ()=>{
    const list=$('suggestedList'), empty=$('suggestedEmpty');
    list.innerHTML='';
    // check connection state for first 10 to avoid many reads, use cache
    const candidates=[];
    for(const u of filtered.slice(0,15)){
      const conn = await getConnState(u.uid);
      if(!conn) candidates.push(u);
      if(candidates.length>=5) break;
    }
    const toShow = candidates.length? candidates : filtered.slice(0,5);
    if(!toShow.length){ empty.hidden=false; } else { empty.hidden=true; toShow.forEach(u=> list.appendChild(createUserRow(u))); }
  })();
  // Rising Creators: sort by xp/level if available, otherwise omit if no xp data
  {
    const list=$('risingList'), empty=$('risingEmpty');
    list.innerHTML='';
    const hasXp = filtered.some(u=> Number.isFinite(u.xp) || Number.isFinite(u.level));
    if(!hasXp){ empty.hidden=false; empty.textContent='No rising creators yet — activity will appear here.'; }
    else {
      const sorted=[...filtered].filter(u=> Number.isFinite(u.xp)|| Number.isFinite(u.level)).sort((a,b)=> (b.xp||b.level*100||0)-(a.xp||a.level*100||0)).slice(0,5);
      if(!sorted.length) empty.hidden=false; else { empty.hidden=true; sorted.forEach(u=> list.appendChild(createUserRow(u))); }
    }
  }
  // Active Today: need updatedAtMs / lastActive — check reliable data
  {
    const list=$('activeList'), empty=$('activeEmpty'), sec=$('activeSection');
    list.innerHTML='';
    const hasActive = filtered.some(u=> Number.isFinite(u.updatedAtMs) || Number.isFinite(u.lastActiveMs) || u.updatedAt?.toMillis);
    if(!hasActive){ list.innerHTML=''; empty.hidden=false; sec.hidden=false; }
    else {
      const now=Date.now();
      const active = filtered.filter(u=>{
        const ms = u.updatedAtMs || u.lastActiveMs || (u.updatedAt?.toMillis && u.updatedAt.toMillis()) || 0;
        return ms && (now-ms) < 24*60*60*1000;
      }).sort((a,b)=> (b.updatedAtMs||0)-(a.updatedAtMs||0)).slice(0,5);
      if(!active.length){ empty.hidden=false; } else { empty.hidden=true; active.forEach(u=> list.appendChild(createUserRow(u))); }
    }
  }
  // Community Voices: badges/achievements
  {
    const list=$('voicesList'), empty=$('voicesEmpty');
    list.innerHTML='';
    const voices = filtered.filter(u=> Array.isArray(u.badges)&&u.badges.length).slice(0,5);
    if(!voices.length){ empty.hidden=false; } else { empty.hidden=true; voices.forEach(u=> list.appendChild(createUserRow(u))); }
  }
  showStatus(filtered.length? '': 'No people found.');
  // also keep hidden legacy list empty
  const legacy=$('usersList'); if(legacy) legacy.innerHTML='';
}

async function fetchUsersPage(isLoadMore=false){
  const status=$('peopleStatus');
  try{
    if(!isLoadMore) showStatus('');
    let q;
    if(!lastDoc) q = query(collection(db,'users'), limit(20));
    else q = query(collection(db,'users'), startAfter(lastDoc), limit(20));
    // Try orderBy updatedAt if exists, fallback to limit only
    const snap = await getDocs(q);
    if(snap.empty){ hasMore=false; if(!users.length) showStatus('No users found.'); return; }
    lastDoc = snap.docs[snap.docs.length-1];
    hasMore = snap.docs.length===20;
    const page = snap.docs.map(d=> ({...d.data(), uid: d.data().uid||d.id}));
    // merge without duplicates
    const existingIds=new Set(users.map(u=>u.uid));
    page.forEach(u=>{ if(!existingIds.has(u.uid)) users.push(u); });
    // ensure current user in cache but not in list
    if(!users.some(x=>x.uid===me.uid)) users.push({uid:me.uid,name:me.displayName||'User',userId:me.uid,photoURL:me.photoURL||null});
    trioCache.set('allUsers', users, trioCache.TTL.LONG);
    users.forEach(u=>{ const k=`user_${u.uid}`; if(!trioCache.get(k)) trioCache.set(k,u,trioCache.TTL.LONG); });
    renderSections($('usersSearch')?.value||'');
    const btn=$('nkmLoadMore'); if(btn) btn.hidden=!hasMore;
  }catch(err){
    console.error(err);
    showStatus(err.message||'Failed to load people.');
  }
}

onAuthStateChanged(auth, async u=>{
  if(!u){ location.href='login.html?redirect=all-users.html'; return; }
  me=u;
  const cacheKey='allUsers';
  const cachedList=trioCache.get(cacheKey);
  if(cachedList && Array.isArray(cachedList) && cachedList.length){
    users=cachedList;
    hasMore=false; lastDoc=null;
    hideSkeletons();
    renderSections();
    // background refresh limited page to get fresh cursor
    fetchUsersPage().catch(()=>{});
    return;
  }
  // show skeletons initially
  users=[]; lastDoc=null; hasMore=true;
  await fetchUsersPage();
});

$('usersSearch')?.addEventListener('input', e=> renderSections(e.target.value));
$('nkmLoadMore')?.addEventListener('click', ()=> fetchUsersPage(true));
