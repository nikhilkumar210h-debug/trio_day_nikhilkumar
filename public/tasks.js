import{auth,db}from'./firebase-init.js';
import{onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import{collection,getDocs,query,orderBy,limit}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const $=id=>document.getElementById(id);
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
async function loadFeatured(){
  const host=$('doFeatured'); if(!host)return;
  try{
    const snap=await getDocs(query(collection(db,'communityTasks'),orderBy('createdAtMs','desc'),limit(6)));
    const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>!x.hidden&&!x.archived).slice(0,4);
    if(!rows.length){host.hidden=true;return}
    host.hidden=false;
    host.innerHTML='<div class="do-featured-head"><strong>Active in Trio Day</strong><span>Pick one</span></div>'+rows.map(x=>'<a class="do-featured-card" href="task-detail.html?id='+encodeURIComponent(x.id)+'"><span class="do-featured-icon">'+esc(x.icon||'🎯')+'</span><span><strong>'+esc(x.title||'Activity')+'</strong><small>'+esc(x.description||'Open the activity and get started.')+'</small></span><b>→</b></a>').join('');
  }catch(e){console.warn('Featured activities unavailable',e);host.hidden=true}
}
onAuthStateChanged(auth,async u=>{
  if(!u){location.href='login.html?redirect=tasks.html';return}
  await loadFeatured();
});