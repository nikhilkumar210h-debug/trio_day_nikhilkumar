import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { createCommunityTask } from './gamification/community-tasks.js?v=20260919-community5';
import { showToast } from './ui/toast.js';

const $=id=>document.getElementById(id); let me=null,profile={}; let choices=['','', ''];
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function render(){
  $('options').innerHTML=choices.map((v,i)=>`<div class="cc-option"><input class="cc-input" maxlength="100" data-choice="${i}" value="${esc(v)}" placeholder="Choice ${i+1}">${choices.length>2?`<button class="cc-remove" type="button" data-remove="${i}">Remove</button>`:''}</div>`).join('');
  $('options').querySelectorAll('[data-choice]').forEach(e=>e.addEventListener('input',()=>{choices[Number(e.dataset.choice)]=e.value;preview();}));
  $('options').querySelectorAll('[data-remove]').forEach(e=>e.addEventListener('click',()=>{choices.splice(Number(e.dataset.remove),1);render();preview();}));
  preview();
}
function preview(){
  const q=$('question').value.trim()||'Your question will appear here.';
  $('preview').innerHTML=`<strong>${esc(q)}</strong>${choices.map(v=>`<button type="button">${esc(v||'Choice')}</button>`).join('')}`;
}
$('question').addEventListener('input',preview); $('topic').addEventListener('input',preview);
$('addOption').addEventListener('click',()=>{if(choices.length<5){choices.push('');render();}});
$('publish').addEventListener('click',async()=>{
 if(!me)return;
 const q=$('question').value.trim(), opts=choices.map(x=>x.trim()).filter(Boolean);
 if(q.length<8)return showToast('Write a clear question first.','warn');
 if(opts.length<2)return showToast('Add at least 2 choices.','warn');
 $('publish').disabled=true;$('status').textContent='Publishing…';
 try{
  const id=await createCommunityTask(me.uid,profile,{title:q.slice(0,100),description:q,goal:'Choose an answer and compare your thinking with other people.',instructions:'Pick one choice. Then use Chat to explain why.',icon:'⚡',kind:'challenge',activityType:'challenge',category:$('topic').value.trim()||'Community',mechanic:'choice',templateId:null,durationMin:2,difficulty:'Easy',expiresInDays:14,target:1,metric:'manual',xpReward:25,interaction:{kind:'choice',question:q,options:opts,correct:null,proofRequired:false,proofPrompt:'Why did you choose this?'}});
  $('status').textContent='Published ✓';showToast('Challenge published.');
  setTimeout(()=>location.href='challenge.html?id='+encodeURIComponent(id),500);
 }catch(e){console.error(e);$('status').textContent=e?.message||'Could not publish.';showToast($('status').textContent,'error');$('publish').disabled=false;}
});
render();
onAuthStateChanged(auth,async user=>{if(!user){location.href='login.html?redirect=challenge-create.html';return;}me=user;const s=await getDoc(doc(db,'users',user.uid)).catch(()=>null);profile=s?.exists()?s.data():{name:user.displayName||'User'};});
