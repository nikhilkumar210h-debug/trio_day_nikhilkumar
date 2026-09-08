import { auth, db } from './firebase-init.js';
import { makeUserId } from './utils.js';
import { trioCache } from './trio-cache.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const CLOUD_NAME = 'vyhglthg';
const UPLOAD_PRESET = 'trio_uploads';
const VIDEO_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;

const $ = id => document.getElementById(id);

let currentUser = null;
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let recordingSeconds = 0;
let timerInterval = null;
let startTime = 0;
let privacy = 'public';
let stream = null;

const recordBtn = () => $('recordBtn');
const timerDisplay = () => $('timerDisplay');
const waveform = () => $('waveform');
const voiceHint = () => $('voiceHint');
const voiceCaption = () => $('voiceCaption');
const captionCount = () => $('captionCount');
const shareBtn = () => $('shareVoiceBtn');
const statusEl = () => $('voiceStatusMsg');
const privacyPublic = () => $('privacyPublic');
const privacyFriends = () => $('privacyFriends');

function formatTimer(sec){
  const m = String(Math.floor(sec/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  return `${m}:${s} / 01:00`;
}

function setStatus(msg='', isError=false){
  const el=statusEl(); if(!el) return;
  el.textContent=msg;
  el.classList.toggle('error', isError);
}

function updateTimer(){
  const elapsed = Math.floor((Date.now() - startTime)/1000);
  recordingSeconds = Math.min(elapsed, 60);
  const td=timerDisplay(); if(td) td.textContent = formatTimer(recordingSeconds);
  if(recordingSeconds >= 60){
    stopRecording();
  }
}

async function startRecording(){
  if(!navigator.mediaDevices || !window.MediaRecorder){
    setStatus('This browser does not support voice recording. Try Chrome on Android.', true);
    return;
  }
  if(!currentUser){
    setStatus('Please login first.', true);
    return;
  }
  try{
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }catch(err){
    console.error(err);
    setStatus('Microphone permission denied. Allow mic in browser settings.', true);
    return;
  }

  audioChunks = [];
  audioBlob = null;
  recordingSeconds = 0;
  const options = { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' };
  try{
    mediaRecorder = new MediaRecorder(stream, options);
  }catch(err){
    console.error(err);
    setStatus('MediaRecorder not supported in this browser.', true);
    stream.getTracks().forEach(t=>t.stop());
    return;
  }

  mediaRecorder.ondataavailable = e => {
    if(e.data && e.data.size>0) audioChunks.push(e.data);
  };
  mediaRecorder.onstop = async () => {
    clearInterval(timerInterval);
    stream?.getTracks().forEach(t=>t.stop());
    stream=null;
    const btn=recordBtn(), td=timerDisplay(), wf=waveform(), hint=voiceHint();
    if(btn){ btn.classList.remove('recording'); btn.textContent='🎙️'; btn.setAttribute('aria-label','Start recording'); }
    if(td) td.classList.remove('recording');
    if(wf) wf.classList.remove('recording');
    const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
    if(blob.size===0){
      setStatus('No audio captured. Try again.', true);
      if(hint) hint.textContent='Tap to start recording';
      return;
    }
    audioBlob = blob;
    recordingSeconds = Math.min(recordingSeconds, 60);
    if(hint) hint.textContent = `Recorded ${recordingSeconds}s — ready to share`;
    setStatus(`Recorded ${recordingSeconds}s. Add caption and press Share.`);
    const sb=shareBtn(); if(sb) sb.disabled=false;
  };

  mediaRecorder.start(100);
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 200);
  const btn=recordBtn(), td=timerDisplay(), wf=waveform(), hint=voiceHint();
  if(btn){ btn.classList.add('recording'); btn.textContent='⏹️'; btn.setAttribute('aria-label','Stop recording'); }
  if(td) td.classList.add('recording');
  if(wf) wf.classList.add('recording');
  if(hint) hint.textContent='Recording… tap to stop';
  setStatus('Recording…');
  const sb=shareBtn(); if(sb) sb.disabled=true;
  // Auto-stop after 60s
  setTimeout(()=>{ if(mediaRecorder && mediaRecorder.state==='recording') stopRecording(); }, 60000);
}

function stopRecording(){
  if(mediaRecorder && mediaRecorder.state==='recording'){
    mediaRecorder.stop();
    clearInterval(timerInterval);
  } else {
    clearInterval(timerInterval);
  }
}

async function getMyProfile(){
  if(!currentUser) return null;
  try{
    const snap=await getDoc(doc(db,'users', currentUser.uid));
    return snap.exists() ? snap.data() : null;
  }catch{ return null; }
}

async function uploadVoiceAudio(uid, blob){
  const form=new FormData();
  const fileName = `voice_${Date.now()}.webm`;
  form.append('file', blob, fileName);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', 'trio/voice');
  form.append('public_id', `${uid}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
  const res=await fetch(VIDEO_UPLOAD_URL, { method:'POST', body: form });
  const data=await res.json().catch(()=>({}));
  if(!res.ok || !data.secure_url) throw Error(data?.error?.message || `Cloudinary upload failed (${res.status})`);
  return data.secure_url;
}

async function shareVoice(){
  if(!currentUser){ setStatus('Please login first.', true); return; }
  if(!audioBlob){ setStatus('Record voice first.', true); return; }
  const caption = (voiceCaption()?.value || '').trim().slice(0,200);
  const btn=shareBtn(); if(btn) { btn.disabled=true; btn.textContent='Uploading…'; }
  setStatus('Uploading voice…');
  try{
    const me = await getMyProfile();
    const mediaUrl = await uploadVoiceAudio(currentUser.uid, audioBlob);
    setStatus('Saving post…');
    const now = Date.now();
    // Voice as story — shows in stories strip, auto-deletes after 24h
    await addDoc(collection(db,'posts'), {
      uid: currentUser.uid,
      name: me?.name || currentUser.displayName || 'User',
      userId: me?.userId || makeUserId(currentUser.uid),
      photoURL: me?.photoURL || currentUser.photoURL || null,
      type: 'story',
      isStory: true,
      isVoice: true,
      mediaUrl,
      duration: recordingSeconds,
      message: caption || '🎙️ Voice',
      privacy,
      createdAt: serverTimestamp(),
      createdAtMs: now,
      expiresAt: serverTimestamp(),
      expiresAtMs: now + 24*60*60*1000
    });
    try{ trioCache.invalidate('feed_recent'); trioCache.invalidate(`posts_${currentUser.uid}`); trioCache.invalidate('feed'); }catch{}
    setStatus('Voice posted ✅ Redirecting…');
    setTimeout(()=>{ location.href='index.html'; }, 2000);
  }catch(err){
    console.error(err);
    setStatus(err.message || 'Upload failed. Try again.', true);
    const b=shareBtn(); if(b){ b.disabled=false; b.textContent='Share Voice Status'; }
  }
}

function initPrivacy(){
  const pub=privacyPublic(), fr=privacyFriends();
  if(!pub || !fr) return;
  const setActive = (p)=>{
    privacy=p;
    pub.classList.toggle('active', p==='public');
    fr.classList.toggle('active', p==='friends');
  };
  pub.addEventListener('click', ()=> setActive('public'));
  fr.addEventListener('click', ()=> setActive('friends'));
}

function initCaption(){
  const ta=voiceCaption(), cc=captionCount();
  if(!ta || !cc) return;
  const update=()=>{ cc.textContent = String(ta.value.length); };
  ta.addEventListener('input', update);
  update();
}

onAuthStateChanged(auth, async user=>{
  currentUser=user;
  if(!user){
    // auth-guard.js will redirect, but keep fallback
    // location.href='login.html?redirect=voice-status.html';
    return;
  }
});

document.addEventListener('DOMContentLoaded', ()=>{
  const btn=recordBtn();
  if(btn){
    btn.addEventListener('click', ()=>{
      if(mediaRecorder && mediaRecorder.state==='recording'){
        stopRecording();
      } else {
        startRecording();
      }
    });
  }
  const sb=shareBtn();
  if(sb) sb.addEventListener('click', shareVoice);
  initPrivacy();
  initCaption();
});
