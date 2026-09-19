import { auth, db } from './firebase-init.js';
import { getMyProfile } from './services/userCache.js';
import { uploadStoryMedia, uploadPostImage } from './image-upload.js';
import { onPostCreated } from './gamification/auto-metrics.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
let me = null;
let privacy = 'public';
let selectedFile = null;

const FILTERS = {
  none: 'none',
  vivid: 'saturate(1.25) contrast(1.06)',
  warm: 'sepia(.12) saturate(1.12) contrast(1.04)',
  cool: 'saturate(.92) hue-rotate(12deg) contrast(1.04)',
  bw: 'grayscale(1) contrast(1.08)',
  cinematic: 'contrast(1.12) saturate(.9) brightness(.94)'
};

function currentFilterCss(){ return FILTERS[$('uploadFilter')?.value || 'none'] || 'none'; }


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
  el.muted=true; el.playsInline=true; el.alt='Story preview'; if(file.type.startsWith('image/')) el.style.filter=currentFilterCss(); el.onload=()=>URL.revokeObjectURL(url); el.onloadeddata=()=>URL.revokeObjectURL(url);
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
$('uploadFilter')?.addEventListener('change',()=>{ if(selectedFile) renderPreview(selectedFile); });
$('uploadOverlayText')?.addEventListener('input',()=>{});
$('uploadSticker')?.addEventListener('change',()=>{});

async function prepareEditedImage(file){
  const filter=currentFilterCss();
  const overlayText=$('uploadOverlayText')?.value.trim() || '';
  const sticker=$('uploadSticker')?.value || '';
  if(file.type.startsWith('video/') || (filter==='none' && !overlayText && !sticker)) return null;
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
    const maxEdge=1280, scale=Math.min(1,maxEdge/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(img.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');
    ctx.filter=filter;ctx.drawImage(img,0,0,canvas.width,canvas.height);ctx.filter='none';
    if(sticker){ctx.font=`${Math.round(canvas.width*.09)}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(sticker,canvas.width/2,canvas.height*.18);}
    if(overlayText){const size=Math.max(28,Math.round(canvas.width*.055));ctx.font=`800 ${size}px Inter, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=Math.max(3,Math.round(size*.08));ctx.strokeStyle='rgba(0,0,0,.5)';ctx.strokeText(overlayText,canvas.width/2,canvas.height*.84);ctx.fillStyle='#fff';ctx.fillText(overlayText,canvas.width/2,canvas.height*.84);}
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
    return blob?new File([blob],`story-${Date.now()}.jpg`,{type:'image/jpeg'}):null;
  }finally{URL.revokeObjectURL(url);}
}

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
    if(selectedFile){
      status('Processing media…');
      const edited = selectedFile.type.startsWith('image/') ? await prepareEditedImage(selectedFile) : null;
      mediaUrl = edited ? await uploadPostImage(me.uid, edited) : await uploadStoryMedia(me.uid,selectedFile);
      status('Uploading…');
    }
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
