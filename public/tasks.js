import{auth,db}from'./firebase-init.js';
import{onAuthStateChanged}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import{listCommunityTasks}from'./gamification/community-tasks.js';
import{activeCatalogActivities}from'./activity-catalog.js?v=20260920-audit2';
import{activityCardHtml,normalizeActivityType}from'./activity-ui.js';

const $=id=>document.getElementById(id);

function renderCatalog(){
  const host=$('doNowList'),section=$('doNow');if(!host||!section)return;
  const items=activeCatalogActivities().filter(a=>['puzzle','build','learn','challenge','game'].includes(a.type)).slice(0,6);
  const loader=$('doLoading'); if(loader) loader.hidden=true;
  section.hidden=!items.length;
  host.innerHTML=items.map(a=>activityCardHtml({...a,source:'catalog',activityType:a.type})).join('');
}

async function renderCommunity(){
  const host=$('doFeaturedList'),section=$('doFeatured');if(!host||!section)return;
  try{
    const rows=(await listCommunityTasks({status:'active',max:12}))
      .filter(x=>!x.hidden)
      .map(x=>({...x,source:'community',activityType:normalizeActivityType(x)}))
      .slice(0,6);
    section.hidden=!rows.length;
    host.innerHTML=rows.length
      ?rows.map(a=>activityCardHtml(a)).join('')
      :'<div class="do-empty">No community activities are live yet. Create the first one.</div>';
  }catch(e){
    console.warn('Community activities unavailable',e);

    section.hidden=false;
    host.innerHTML='<div class="do-empty">Community activities are temporarily unavailable.</div>';
  }
}

onAuthStateChanged(auth,async u=>{
  if(!u){location.href='login.html?redirect=tasks.html';return}
  renderCatalog();
  await renderCommunity();
});
