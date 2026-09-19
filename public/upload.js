import { auth, db } from './firebase-init.js';
import { getMyProfile } from './services/userCache.js';
import { uploadStoryMedia } from './image-upload.js';
import { onPostCreated } from './gamification/auto-metrics.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
let me = null;
let privacy = 'public';
let selectedFile = null;

function status(message='', error=false){
  const el=$('storyFormStatus'); if(!el)return;
  el.textContent=message; el.classList.toggle('error',!!error);
}
function renderPreview(file){
  const stage=$('storyPreview'), placeholder=$('uploadPlaceholder'), meta=$('mediaMeta');
  if(!stage)return;
  stage.querySelectorAll('img,video').forEach(x=>x.remove());
  if(!file){placeholder.hidden=false;meta.textContent='No media selected';return;}
  placeholder.hidden=true;
  const url=URL.createObjectURL(file);
  const el=document.createElement(file.type.startsWith('video/')?'video':'img');
  el.src=url; el.autoplay=false; el.controls=file.type.startsWith('video/');
  el.muted=true; el.playsInline=true; el.alt='Story preview'; el.onload=()=>URL.revokeObjectURL(url); el.onloadeddata=()=>URL.revokeObjectURL(url);
  stage.appendChild(el);
  meta.textContent=`${file.type.startsWith('video/')?'Video':'Photo'} · ${(file.size/1024/1024).toFixed(1)} MB`;
}
function choose(file){
  if(!file)return;
  if(!file.type.startsWith('image/')&&!file.type.startsWith('video/')){status('Choose a photo or video.',true);return;}
  if(file.size>100*1024*1024){status('Media must be under 100MB.',true);return;}
  if(file.type.startsWith('image/')&&file.size>12*1024*1024){status('Story photo must be under 12MB.',true);return;}
  selectedFile=file; renderPreview(file); status('');
}
$('storyMedia')?.addEventListener('change',e=>choose(e.target.files?.[0]));
$('storyCamera')?.addEventListener('change',e=>choose(e.target.files?.[0]));
document.querySelectorAll('[data-privacy]').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('[data-privacy]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); privacy=btn.dataset.privacy;
}));
$('storySubmitBtn')?.addEventListener('click',async()=>{
  if(!me){status('Please log in first.',true);return;}
  const text=$('storyMessage').value.trim();
  if(!text&&!selectedFile){status('Add a caption or media.',true);return;}
  const btn=$('storySubmitBtn'); btn.disabled=true; btn.textContent='Uploading…';
  try{
    const profile=await getMyProfile(me.uid);
    let mediaUrl=null;
    if(selectedFile){status('Uploading media…');mediaUrl=await uploadStoryMedia(me.uid,selectedFile);}
    const now=Date.now();
    await addDoc(collection(db,'posts'),{
      name:profile?.name||me.displayName||'User',
      userId:profile?.userId||'',
      uid:me.uid,
      photoURL:profile?.photoURL||me.photoURL||null,
      message:text||'📸',
      mediaUrl,
      type:'story',
      isStory:true,
      privacy,
      createdAt:serverTimestamp(),
      createdAtMs:now,
      expiresAtMs:now+24*60*60*1000
    });
    onPostCreated(me.uid);
    status('Story shared ✓');
    btn.textContent='Shared ✓';
    setTimeout(()=>location.href='index.html',500);
  }catch(err){console.error(err);status(err.message||'Could not share story.',true);btn.disabled=false;btn.textContent='Share Story';}
});
onAuthStateChanged(auth,user=>{me=user;if(!user)location.href='login.html?redirect='+encodeURIComponent('upload.html');});
