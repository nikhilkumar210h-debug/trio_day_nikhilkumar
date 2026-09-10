/**
 * NKM Create — Phase 8 full-page creator
 * Modes: post | story (strictly separated end-to-end)
 * Reuses: Cloudinary (image-upload.js), getFilterCSS, Firebase auth/firestore
 */
import { auth, db } from './firebase-init.js';
import { makeUserId, getFilterCSS } from './utils.js';
import { trioCache } from './trio-cache.js';
import { getMyProfile } from './services/userCache.js';
import { SoundManager } from './sound-manager.js';
import { onPostCreated } from './gamification/auto-metrics.js';
import {
  uploadPostImage,
  uploadStoryMedia,
  uploadStoryEditedImage,
  MEDIA_LIMITS
} from './image-upload.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, addDoc, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const DRAFT_KEY = 'nkm_create_draft_v1';
const FILTERS = [
  { id: 'none', label: 'Original' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'bw', label: 'B&W' },
  { id: 'retro', label: 'Retro' },
  { id: 'cinematic', label: 'Cinema' }
];
const STICKERS = [
  '😀','😂','🥰','😍','🥳','🤩','😎','🤗','😇','🫶','💖','💕','🔥','💯','⭐','🌟',
  '🎉','✨','🎶','💪','🙏','👑','👏','🙌','🤔','😭','🥺','🤣','💀','🥶','🤯','🫡',
  '🤷‍♂️','🕺','💃','🌈','⚡','❤️','💜','🇮🇳'
];

// Theme is global (theme.js); no per-page lock here.
try { SoundManager.init(); } catch {}

/** Strict mode state — never share media between post/story */
const state = {
  mode: null,
  stage: 'mode',
  dirty: false,
  publishing: false,
  textOnly: false,
  post: { file: null, objectUrl: null },
  story: { file: null, objectUrl: null },
  caption: '',
  privacy: 'public',
  editor: {
    filter: 'none',
    filterIntensity: 1,
    rotation: 0,
    fit: 'cover',
    aspect: 'free',
    textOverlays: [],
    stickers: [],
    originalImage: null,
    selectedText: null,
    selectedSticker: null,
    drag: null
  },
  camera: {
    stream: null,
    facing: 'environment',
    flashOn: false,
    flashSupported: false
  },
  uploadAbort: null,
  lastPublishError: null
};

let currentUser = null;
let renderFrame = null;
let historyGuard = false;

onAuthStateChanged(auth, (user) => { currentUser = user; });

function activeMedia() {
  if (!state.mode) return { file: null, objectUrl: null };
  return state.mode === 'post' ? state.post : state.story;
}

function setActiveMedia(file) {
  const bucket = state.mode === 'post' ? state.post : state.story;
  if (bucket.objectUrl) URL.revokeObjectURL(bucket.objectUrl);
  bucket.file = file;
  bucket.objectUrl = file ? URL.createObjectURL(file) : null;
  state.dirty = true;
  state.textOnly = false;
}

function clearMediaForMode(mode) {
  const bucket = mode === 'post' ? state.post : state.story;
  if (bucket.objectUrl) URL.revokeObjectURL(bucket.objectUrl);
  bucket.file = null;
  bucket.objectUrl = null;
}

function setStatus(msg = '', kind = '') {
  const el = $('createStatus');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('error', kind === 'error');
  el.classList.toggle('ok', kind === 'ok');
}

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `nkm-toast${kind ? ` ${kind}` : ''}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }, 3500);
}

function setProgress(pct, text) {
  const wrap = $('uploadProgress');
  const fill = $('uploadBarFill');
  const label = $('uploadProgressText');
  if (!wrap) return;
  wrap.hidden = pct == null;
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, pct || 0))}%`;
  if (label && text) label.textContent = text;
}

function updateChrome() {
  const badge = $('createModeBadge');
  const title = $('createTitle');
  const publish = $('publishBtn');
  if (badge) {
    badge.textContent = state.mode === 'story' ? 'Story' : state.mode === 'post' ? 'Post' : 'Create';
    badge.dataset.mode = state.mode || '';
  }
  if (title) {
    const map = { mode: 'Create', source: 'Add media', camera: 'Camera', editor: 'Edit & share' };
    title.textContent = map[state.stage] || 'Create';
  }
  if (publish) publish.textContent = state.mode === 'story' ? 'Share Story' : 'Post';
  const storyOpts = $('storyOptions');
  if (storyOpts) storyOpts.hidden = state.mode !== 'story';
  const captionOnly = $('captionOnlyWrap');
  if (captionOnly) captionOnly.hidden = state.mode !== 'post';
  const gallery = $('galleryInput');
  if (gallery) gallery.accept = state.mode === 'story' ? 'image/*,video/*' : 'image/*';
  const gh = $('galleryHint');
  if (gh) gh.textContent = state.mode === 'story' ? 'Photo or video' : 'Photos only';
  const sh = $('sourceHint');
  if (sh) {
    sh.textContent = state.mode === 'story'
      ? 'Stories support photo or video · expire in 24h'
      : 'Posts support photos · text-only allowed';
  }
  document.body.dataset.stage = state.stage;
  document.body.dataset.mode = state.mode || '';
}

function showStage(stage) {
  state.stage = stage;
  document.querySelectorAll('[data-stage-panel]').forEach((el) => {
    el.hidden = el.dataset.stagePanel !== stage;
  });
  updateChrome();
  if (stage !== 'camera') stopCamera();
  if (stage === 'editor') {
    scheduleRender();
    saveDraftMeta();
  }
}

function pickMode(mode) {
  if (mode !== 'post' && mode !== 'story') return;
  if (mode === 'post') clearMediaForMode('story');
  else clearMediaForMode('post');
  state.mode = mode;
  state.editor = {
    ...state.editor,
    filter: 'none',
    filterIntensity: 1,
    rotation: 0,
    fit: mode === 'story' ? 'cover' : 'contain',
    aspect: mode === 'story' ? '9:16' : 'free',
    textOverlays: [],
    stickers: [],
    originalImage: null,
    selectedText: null,
    selectedSticker: null,
    drag: null
  };
  document.querySelectorAll('[data-fit]').forEach((b) => b.classList.toggle('active', b.dataset.fit === state.editor.fit));
  document.querySelectorAll('[data-aspect]').forEach((b) => b.classList.toggle('active', b.dataset.aspect === state.editor.aspect));
  syncUrlMode(mode);
  updateChrome();
  showStage('source');
}

function syncUrlMode(mode) {
  try {
    const u = new URL(location.href);
    if (mode) u.searchParams.set('mode', mode);
    else u.searchParams.delete('mode');
    history.replaceState({ nkmCreate: true, mode }, '', u.pathname + u.search);
  } catch {}
}

async function startCamera() {
  const errBox = $('cameraError');
  if (errBox) errBox.hidden = true;

  if (!navigator.mediaDevices?.getUserMedia) {
    toast('Camera API not supported. Use gallery instead.', 'error');
    return;
  }

  stopCamera();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: state.camera.facing },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });
  } catch (err) {
    console.error(err);
    const errName = String(err?.name || '');
    const errMsg = String(err?.message || '');
    let title, msg;
    if (/NotAllowed|Permission|denied/i.test(errName + errMsg)) {
      title = 'Permission denied';
      msg = 'Allow camera access in browser settings, or pick a photo from gallery.';
    } else if (/NotFound/i.test(errName)) {
      title = 'No camera found';
      msg = 'No camera hardware detected. Use gallery instead.';
    } else if (/Overconstrained/i.test(errName)) {
      title = 'Camera constraints not supported';
      msg = 'Camera does not support requested resolution. Try gallery or flip camera.';
    } else if (/NotReadable/i.test(errName)) {
      title = 'Camera in use';
      msg = 'Camera is being used by another app. Close other apps or use gallery.';
    } else {
      title = 'Camera unavailable';
      msg = 'Could not open the camera. Use gallery instead.';
    }
    toast(`${title}: ${msg}`, 'error');
    return;
  }

  state.camera.stream = stream;
  const video = $('cameraVideo');
  if (video) {
    video.srcObject = stream;
    try {
      await video.play();
    } catch (playErr) {
      console.error(playErr);
      stopCamera();
      toast('Camera playback failed. Use gallery instead.', 'error');
      return;
    }
  }
  detectFlashSupport(stream);
  showStage('camera');
}

function detectFlashSupport(stream) {
  const track = stream.getVideoTracks?.()[0];
  const btn = $('cameraFlashBtn');
  state.camera.flashSupported = false;
  if (!track || !btn) { if (btn) btn.hidden = true; return; }
  const caps = track.getCapabilities?.() || {};
  if (caps.torch) {
    state.camera.flashSupported = true;
    btn.hidden = false;
    btn.textContent = state.camera.flashOn ? 'Flash on' : 'Flash';
  } else {
    btn.hidden = true;
  }
}

async function toggleFlash() {
  if (!state.camera.flashSupported || !state.camera.stream) return;
  const track = state.camera.stream.getVideoTracks()[0];
  state.camera.flashOn = !state.camera.flashOn;
  try {
    await track.applyConstraints({ advanced: [{ torch: state.camera.flashOn }] });
    const btn = $('cameraFlashBtn');
    if (btn) btn.textContent = state.camera.flashOn ? 'Flash on' : 'Flash';
  } catch {
    state.camera.flashOn = false;
  }
}

async function flipCamera() {
  state.camera.facing = state.camera.facing === 'environment' ? 'user' : 'environment';
  const hadStream = !!state.camera.stream;
  await startCamera();
  if (!state.camera.stream && hadStream) {
    showStage('source');
  }
}

function stopCamera() {
  state.camera.stream?.getTracks?.().forEach((t) => t.stop());
  state.camera.stream = null;
  state.camera.flashOn = false;
  const video = $('cameraVideo');
  if (video) video.srcObject = null;
}

function showCameraError(title, msg) {
  const box = $('cameraError');
  if (!box) return;
  box.hidden = false;
  const t = $('cameraErrorTitle');
  const m = $('cameraErrorMsg');
  if (t) t.textContent = title;
  if (m) m.textContent = msg;
}

function capturePhoto() {
  const video = $('cameraVideo');
  if (!video || !state.camera.stream) return;
  const canvas = $('cameraCaptureCanvas') || document.createElement('canvas');
  const w = video.videoWidth || 1280;
  const h = video.videoHeight || 720;
  if (!w || !h) {
    setStatus('Camera not ready yet.', 'error');
    return;
  }
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(video, 0, 0, w, h);
  canvas.toBlob(async (blob) => {
    if (!blob) {
      setStatus('Could not capture photo.', 'error');
      return;
    }
    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
    stopCamera();
    await loadMediaFile(file);
  }, 'image/jpeg', 0.92);
}

function validateMedia(file) {
  if (!file) return 'No file selected.';
  if (state.mode === 'post') {
    if (!file.type.startsWith('image/')) return 'Posts only support images.';
    if (file.size > MEDIA_LIMITS.postImageMaxBytes) return 'Photo must be under 40MB.';
  } else if (state.mode === 'story') {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return 'Please select an image or video.';
    }
    if (file.type.startsWith('video/') && file.size > MEDIA_LIMITS.storyVideoMaxBytes) {
      return 'Video must be under 100MB.';
    }
    if (file.type.startsWith('image/') && file.size > MEDIA_LIMITS.storyUiMaxBytes) {
      return 'Media must be under 100MB.';
    }
  } else {
    return 'Choose Post or Story first.';
  }
  return null;
}

async function loadMediaFile(file) {
  const err = validateMedia(file);
  if (err) {
    setStatus(err, 'error');
    return;
  }
  setActiveMedia(file);
  state.editor.textOverlays = [];
  state.editor.stickers = [];
  state.editor.filter = 'none';
  state.editor.filterIntensity = 1;
  state.editor.rotation = 0;
  state.editor.selectedText = null;
  state.editor.selectedSticker = null;

  const canvas = $('editorCanvas');
  const videoEl = $('videoPreview');
  const textOnly = $('textOnlyPreview');
  if (textOnly) textOnly.hidden = true;

  if (file.type.startsWith('video/')) {
    if (canvas) canvas.hidden = true;
    if (videoEl) {
      videoEl.hidden = false;
      videoEl.src = activeMedia().objectUrl;
    }
    $('toolRail')?.querySelectorAll('.nkm-tool').forEach((b) => {
      b.disabled = b.dataset.tool !== 'filters';
    });
    showStage('editor');
    setStatus('');
    return;
  }

  if (videoEl) { videoEl.hidden = true; videoEl.removeAttribute('src'); }
  if (canvas) canvas.hidden = false;
  $('toolRail')?.querySelectorAll('.nkm-tool').forEach((b) => { b.disabled = false; });

  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = activeMedia().objectUrl;
  });
  state.editor.originalImage = img;
  sizeCanvasToImage(img);
  showStage('editor');
  renderEditor();
  setStatus('');
  try { SoundManager.click(); } catch {}
}

function sizeCanvasToImage(img) {
  const canvas = $('editorCanvas');
  if (!canvas || !img) return;
  const wrap = $('previewStage');
  const maxW = wrap?.clientWidth || Math.min(window.innerWidth, 720);
  const maxH = wrap?.clientHeight || Math.min(window.innerHeight * 0.55, 720);
  let targetW = img.naturalWidth;
  let targetH = img.naturalHeight;

  const aspect = state.editor.aspect;
  if (aspect === '1:1') {
    const s = Math.min(targetW, targetH);
    targetW = s; targetH = s;
  } else if (aspect === '4:5') {
    targetH = Math.round(targetW * 5 / 4);
    if (targetH > img.naturalHeight) {
      targetH = img.naturalHeight;
      targetW = Math.round(targetH * 4 / 5);
    }
  } else if (aspect === '9:16') {
    targetH = Math.round(targetW * 16 / 9);
    if (targetH > img.naturalHeight) {
      targetH = img.naturalHeight;
      targetW = Math.round(targetH * 9 / 16);
    }
  }

  const scale = Math.min(1, maxW / targetW, maxH / targetH, 1200 / Math.max(targetW, targetH));
  canvas.width = Math.max(1, Math.round(targetW * scale));
  canvas.height = Math.max(1, Math.round(targetH * scale));
}

function scheduleRender() {
  if (renderFrame != null) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = null;
    renderEditor();
  });
}

function renderEditor() {
  const canvas = $('editorCanvas');
  const img = state.editor.originalImage;
  if (!canvas || !img || activeMedia().file?.type?.startsWith('video/')) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, w, h);

  ctx.translate(w / 2, h / 2);
  ctx.rotate((state.editor.rotation * Math.PI) / 180);

  const rot = ((state.editor.rotation % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const frameW = swap ? h : w;
  const frameH = swap ? w : h;

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  let dw, dh;
  if (state.editor.fit === 'contain') {
    const s = Math.min(frameW / iw, frameH / ih);
    dw = iw * s; dh = ih * s;
  } else {
    const s = Math.max(frameW / iw, frameH / ih);
    dw = iw * s; dh = ih * s;
  }

  ctx.filter = getFilterCSS(state.editor.filter, state.editor.filterIntensity);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.filter = 'none';
  ctx.restore();

  state.editor.textOverlays.forEach((t, i) => {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(((t.rotation || 0) * Math.PI) / 180);
    ctx.fillStyle = t.color;
    ctx.font = `${t.fontWeight || 500} ${t.fontSize}px ${t.fontFamily || 'Inter'}`;
    ctx.textAlign = t.align || 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapText(ctx, t.text, Math.max(80, w * 0.85));
    const lineH = t.fontSize * 1.2;
    const startY = -((lines.length - 1) * lineH) / 2;
    lines.forEach((line, li) => ctx.fillText(line, 0, startY + li * lineH));
    if (state.editor.selectedText === i) {
      ctx.strokeStyle = 'rgba(99,102,241,.9)';
      ctx.lineWidth = 1.5;
      const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
      ctx.strokeRect(-tw / 2 - 8, startY - t.fontSize / 2 - 6, tw + 16, lines.length * lineH + 12);
    }
    ctx.restore();
  });

  state.editor.stickers.forEach((s, i) => {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(((s.rotation || 0) * Math.PI) / 180);
    ctx.font = `${s.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.emoji, 0, 0);
    if (state.editor.selectedSticker === i) {
      ctx.strokeStyle = 'rgba(99,102,241,.9)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-s.size / 2 - 4, -s.size / 2 - 4, s.size + 8, s.size + 8);
    }
    ctx.restore();
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function canvasPoint(e) {
  const canvas = $('editorCanvas');
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX ?? e.touches?.[0]?.clientX;
  const clientY = e.clientY ?? e.touches?.[0]?.clientY;
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

function hitTest(pt) {
  const canvas = $('editorCanvas');
  const ctx = canvas.getContext('2d');
  for (let i = state.editor.textOverlays.length - 1; i >= 0; i--) {
    const t = state.editor.textOverlays[i];
    ctx.font = `${t.fontWeight || 500} ${t.fontSize}px ${t.fontFamily || 'Inter'}`;
    const tw = ctx.measureText(t.text).width;
    if (Math.abs(pt.x - t.x) < tw / 2 + 16 && Math.abs(pt.y - t.y) < t.fontSize) {
      return { type: 'text', index: i };
    }
  }
  for (let i = state.editor.stickers.length - 1; i >= 0; i--) {
    const s = state.editor.stickers[i];
    if (Math.abs(pt.x - s.x) < s.size / 2 + 8 && Math.abs(pt.y - s.y) < s.size / 2 + 8) {
      return { type: 'sticker', index: i };
    }
  }
  return null;
}

function onPointerDown(e) {
  if (activeMedia().file?.type?.startsWith('video/') || state.textOnly) return;
  const pt = canvasPoint(e);
  const hit = hitTest(pt);
  state.editor.selectedText = hit?.type === 'text' ? hit.index : null;
  state.editor.selectedSticker = hit?.type === 'sticker' ? hit.index : null;
  if (hit) {
    const item = hit.type === 'text'
      ? state.editor.textOverlays[hit.index]
      : state.editor.stickers[hit.index];
    state.editor.drag = {
      type: hit.type,
      index: hit.index,
      ox: pt.x - item.x,
      oy: pt.y - item.y
    };
  } else {
    state.editor.drag = null;
  }
  scheduleRender();
}

function onPointerMove(e) {
  if (!state.editor.drag) return;
  e.preventDefault?.();
  const pt = canvasPoint(e);
  const { type, index, ox, oy } = state.editor.drag;
  const list = type === 'text' ? state.editor.textOverlays : state.editor.stickers;
  list[index].x = pt.x - ox;
  list[index].y = pt.y - oy;
  state.dirty = true;
  scheduleRender();
}

function onPointerUp() {
  state.editor.drag = null;
}

function assertPublishPayload(mode, payload) {
  if (mode === 'story') {
    if (payload.type !== 'story') throw Error('Invalid story type.');
    if (payload.isStory !== true) throw Error('Story flag missing.');
    if (typeof payload.expiresAtMs !== 'number' || payload.expiresAtMs <= Date.now()) {
      throw Error('Story expiry invalid.');
    }
    if (!['public', 'friends'].includes(payload.privacy)) throw Error('Story privacy invalid.');
  } else if (mode === 'post') {
    if (payload.type !== 'post') throw Error('Invalid post type.');
    if (payload.isStory === true) throw Error('Post cannot be marked as story.');
    if ('expiresAtMs' in payload) throw Error('Posts must not expire like stories.');
  } else {
    throw Error('Unknown create mode.');
  }
}

async function exportEditedBlob() {
  const file = activeMedia().file;
  if (!file) return null;
  if (file.type.startsWith('video/')) return file;
  const hasEffects =
    state.editor.filter !== 'none' ||
    state.editor.rotation !== 0 ||
    state.editor.textOverlays.length > 0 ||
    state.editor.stickers.length > 0 ||
    state.editor.fit !== 'contain' ||
    state.editor.aspect !== 'free';
  if (!hasEffects) return file;
  const canvas = $('editorCanvas');
  if (!canvas) return file;
  renderEditor();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) return file;
  return new File([blob], `${state.mode}-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

async function publish() {
  if (state.publishing) return;
  if (!currentUser) {
    setStatus('Please login first.', 'error');
    return;
  }
  if (!state.mode) {
    setStatus('Choose Post or Story first.', 'error');
    return;
  }

  const caption = ($('captionInput')?.value || '').trim();
  state.caption = caption;
  const media = activeMedia().file;

  if (state.mode === 'post') {
    if (!caption && !media && !state.textOnly) {
      setStatus('Add a caption or photo.', 'error');
      return;
    }
  } else if (!caption && !media) {
    setStatus('Add a caption or media for your story.', 'error');
    return;
  }

  state.publishing = true;
  state.lastPublishError = null;
  const publishBtn = $('publishBtn');
  const retryBtn = $('retryBtn');
  const cancelBtn = $('cancelUploadBtn');
  if (publishBtn) {
    publishBtn.disabled = true;
    publishBtn.textContent = state.mode === 'story' ? 'Sharing…' : 'Posting…';
  }
  if (retryBtn) retryBtn.hidden = true;
  if (cancelBtn) cancelBtn.hidden = false;

  const controller = new AbortController();
  state.uploadAbort = controller;

  try {
    const me = await getMyProfile(currentUser.uid);
    let mediaUrl = null;
    const fileToUpload = media ? await exportEditedBlob() : null;

    if (fileToUpload) {
      setProgress(2, 'Preparing upload…');
      setStatus(state.mode === 'story' ? 'Uploading story…' : 'Uploading photo…');
      if (state.mode === 'story') {
        // CRITICAL: stories always go to trio/stories — never uploadPostImage
        const edited =
          !fileToUpload.type.startsWith('video/') &&
          (state.editor.filter !== 'none' ||
            state.editor.rotation !== 0 ||
            state.editor.textOverlays.length ||
            state.editor.stickers.length);
        mediaUrl = edited
          ? await uploadStoryEditedImage(currentUser.uid, fileToUpload, {
              onProgress: (p) => setProgress(p, `Uploading… ${p}%`),
              signal: controller.signal
            })
          : await uploadStoryMedia(currentUser.uid, fileToUpload, {
              onProgress: (p) => setProgress(p, `Uploading… ${p}%`),
              signal: controller.signal
            });
      } else {
        mediaUrl = await uploadPostImage(currentUser.uid, fileToUpload, {
          onProgress: (p) => setProgress(p, `Uploading… ${p}%`),
          signal: controller.signal
        });
      }
      setProgress(100, 'Processing…');
    }

    const base = {
      name: me?.name || currentUser.displayName || 'User',
      userId: me?.userId || makeUserId(currentUser.uid),
      uid: currentUser.uid,
      photoURL: me?.photoURL || currentUser.photoURL || null,
      message: caption || (mediaUrl ? '📸' : '🇮🇳'),
      mediaUrl,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now()
    };

    let payload;
    if (state.mode === 'story') {
      const expiresAtMs = Date.now() + 24 * 60 * 60 * 1000;
      payload = {
        ...base,
        type: 'story',
        isStory: true,
        privacy: state.privacy === 'friends' ? 'friends' : 'public',
        expiresAtMs,
        expiresAt: Timestamp.fromMillis(expiresAtMs),
        editorMeta: {
          filter: state.editor.filter,
          filterIntensity: state.editor.filterIntensity,
          rotation: state.editor.rotation,
          textOverlays: state.editor.textOverlays,
          stickers: state.editor.stickers.map((s) => ({
            emoji: s.emoji, x: s.x, y: s.y, size: s.size, rotation: s.rotation || 0
          }))
        }
      };
    } else {
      payload = { ...base, type: 'post' };
    }

    assertPublishPayload(state.mode, payload);

    await addDoc(collection(db, 'posts'), payload);
    trioCache.invalidate(`posts_${currentUser.uid}`);
    trioCache.invalidate('feed_recent');
    onPostCreated(currentUser.uid);
    try { SoundManager.success(); } catch {}

    clearDraft();
    state.dirty = false;
    setProgress(null);
    setStatus(state.mode === 'story' ? 'Story shared ✅' : 'Posted ✅', 'ok');
    if (cancelBtn) cancelBtn.hidden = true;
    setTimeout(() => { location.href = 'index.html'; }, 450);
  } catch (err) {
    console.error(err);
    state.lastPublishError = err;
    setProgress(null);
    setStatus(err?.message || 'Could not publish.', 'error');
    if (retryBtn) retryBtn.hidden = false;
    if (publishBtn) {
      publishBtn.disabled = false;
      publishBtn.textContent = state.mode === 'story' ? 'Share Story' : 'Post';
    }
  } finally {
    state.publishing = false;
    state.uploadAbort = null;
    const c = $('cancelUploadBtn');
    if (c) c.hidden = true;
  }
}

function saveDraftMeta() {
  if (!state.mode) return;
  try {
    const data = {
      mode: state.mode,
      caption: $('captionInput')?.value || state.caption || '',
      privacy: state.privacy,
      stage: state.stage,
      textOnly: state.textOnly,
      editor: {
        filter: state.editor.filter,
        filterIntensity: state.editor.filterIntensity,
        rotation: state.editor.rotation,
        fit: state.editor.fit,
        aspect: state.editor.aspect,
        textOverlays: state.editor.textOverlays,
        stickers: state.editor.stickers
      },
      hasMedia: !!activeMedia().file,
      mediaType: activeMedia().file?.type || null,
      savedAt: Date.now()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    if (activeMedia().file && activeMedia().file.type.startsWith('image/') && activeMedia().file.size < 8 * 1024 * 1024) {
      persistMediaBlob(activeMedia().file).catch(() => {});
    }
  } catch {}
}

function loadDraftMeta() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
  clearMediaIdb().catch(() => {});
}

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('nkm_create', 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains('media')) idb.createObjectStore('media');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persistMediaBlob(file) {
  const dbx = await openIdb();
  await new Promise((res, rej) => {
    const tx = dbx.transaction('media', 'readwrite');
    tx.objectStore('media').put({ blob: file, type: file.type, name: file.name, mode: state.mode }, 'draft');
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function readMediaBlob() {
  try {
    const dbx = await openIdb();
    return await new Promise((res, rej) => {
      const tx = dbx.transaction('media', 'readonly');
      const req = tx.objectStore('media').get('draft');
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  } catch { return null; }
}

async function clearMediaIdb() {
  try {
    const dbx = await openIdb();
    await new Promise((res) => {
      const tx = dbx.transaction('media', 'readwrite');
      tx.objectStore('media').delete('draft');
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch {}
}

function hasUnsavedChanges() {
  if (state.dirty) return true;
  if (activeMedia().file) return true;
  if (state.textOnly) return true;
  const caption = $('captionInput')?.value || '';
  if (caption.trim()) return true;
  const hasMedia = !!activeMedia().file || state.textOnly;
  if (hasMedia) {
    if (state.editor.textOverlays?.length) return true;
    if (state.editor.stickers?.length) return true;
    if (state.editor.filter !== 'none') return true;
    if (state.editor.rotation !== 0) return true;
    if (state.editor.fit !== (state.mode === 'story' ? 'cover' : 'contain')) return true;
    if (state.editor.aspect !== 'free') return true;
  }
  return false;
}

function showDiscard(onConfirm) {
  const sheet = $('discardSheet');
  if (!sheet) { onConfirm(); return; }
  sheet.hidden = false;
  const keep = $('discardKeep');
  const confirm = $('discardConfirm');
  const close = () => { sheet.hidden = true; };
  const onKeep = () => { close(); cleanup(); };
  const onOk = () => { close(); cleanup(); onConfirm(); };
  function cleanup() {
    keep?.removeEventListener('click', onKeep);
    confirm?.removeEventListener('click', onOk);
  }
  keep?.addEventListener('click', onKeep);
  confirm?.addEventListener('click', onOk);
}

function requestExit(targetHref = 'index.html') {
  if (state.publishing) return;
  if (!hasUnsavedChanges() && state.stage === 'mode') {
    location.href = targetHref;
    return;
  }
  if (!hasUnsavedChanges()) {
    clearDraft();
    location.href = targetHref;
    return;
  }
  showDiscard(() => {
    clearDraft();
    stopCamera();
    state.dirty = false;
    location.href = targetHref;
  });
}

function goBack() {
  if (state.publishing) return;
  if (state.stage === 'camera') {
    stopCamera();
    showStage('source');
    return;
  }
  if (state.stage === 'editor') {
    const leave = () => {
      clearMediaForMode(state.mode);
      state.editor.originalImage = null;
      state.textOnly = false;
      const videoEl = $('videoPreview');
      if (videoEl) { videoEl.hidden = true; videoEl.removeAttribute('src'); }
      showStage('source');
    };
    if (hasUnsavedChanges()) showDiscard(leave);
    else leave();
    return;
  }
  if (state.stage === 'source') {
    state.mode = null;
    syncUrlMode(null);
    showStage('mode');
    updateChrome();
    return;
  }
  requestExit('index.html');
}

function buildFilters() {
  const row = $('filterRow');
  if (!row) return;
  row.innerHTML = FILTERS.map((f) =>
    `<button type="button" class="nkm-filter-btn${f.id === 'none' ? ' active' : ''}" data-filter="${f.id}">${f.label}</button>`
  ).join('');
  row.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    row.querySelectorAll('.nkm-filter-btn').forEach((b) => b.classList.toggle('active', b === btn));
    state.editor.filter = btn.dataset.filter;
    state.dirty = true;
    scheduleRender();
  });
}

function buildStickers() {
  const grid = $('stickerGrid');
  if (!grid) return;
  grid.innerHTML = STICKERS.map((s) =>
    `<button type="button" class="nkm-sticker-btn" data-sticker="${s}">${s}</button>`
  ).join('');
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sticker]');
    if (!btn || !state.editor.originalImage) return;
    const canvas = $('editorCanvas');
    state.editor.stickers.push({
      emoji: btn.dataset.sticker,
      x: canvas.width / 2,
      y: canvas.height / 2,
      size: 48,
      rotation: 0
    });
    state.editor.selectedSticker = state.editor.stickers.length - 1;
    state.editor.selectedText = null;
    state.dirty = true;
    scheduleRender();
  });
}

function setTool(tool) {
  document.querySelectorAll('.nkm-tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
  document.querySelectorAll('.nkm-panel').forEach((p) => {
    p.hidden = p.dataset.panel !== tool;
  });
}

function enterTextOnly() {
  if (state.mode !== 'post') return;
  clearMediaForMode('post');
  state.textOnly = true;
  state.dirty = true;
  const canvas = $('editorCanvas');
  const video = $('videoPreview');
  const preview = $('textOnlyPreview');
  if (canvas) canvas.hidden = true;
  if (video) video.hidden = true;
  if (preview) {
    preview.hidden = false;
    preview.textContent = ($('captionInput')?.value || '').trim() || 'Your post';
  }
  $('toolRail')?.querySelectorAll('.nkm-tool').forEach((b) => { b.disabled = true; });
  showStage('editor');
}

function wireEvents() {
  $('pickPost')?.addEventListener('click', () => pickMode('post'));
  $('pickStory')?.addEventListener('click', () => pickMode('story'));
  $('createBackBtn')?.addEventListener('click', goBack);
  $('createCloseBtn')?.addEventListener('click', () => requestExit('index.html'));

  $('openCameraBtn')?.addEventListener('click', () => startCamera());
  $('openGalleryBtn')?.addEventListener('click', () => $('galleryInput')?.click());
  $('cameraGalleryBtn')?.addEventListener('click', () => $('galleryInput')?.click());
  $('cameraFallbackGallery')?.addEventListener('click', () => $('galleryInput')?.click());
  $('cameraShutter')?.addEventListener('click', capturePhoto);
  $('cameraFlipBtn')?.addEventListener('click', flipCamera);
  $('cameraFlashBtn')?.addEventListener('click', toggleFlash);
  $('textOnlyBtn')?.addEventListener('click', enterTextOnly);

  $('galleryInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await loadMediaFile(file);
  });

  document.querySelectorAll('.nkm-tool').forEach((btn) => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  $('filterIntensity')?.addEventListener('input', (e) => {
    state.editor.filterIntensity = parseInt(e.target.value, 10) / 100;
    const lab = $('filterIntensityLabel');
    if (lab) lab.textContent = `${e.target.value}%`;
    state.dirty = true;
    scheduleRender();
  });

  $('rotateLeftBtn')?.addEventListener('click', () => {
    state.editor.rotation = (state.editor.rotation - 90) % 360;
    state.dirty = true;
    scheduleRender();
  });
  $('rotateRightBtn')?.addEventListener('click', () => {
    state.editor.rotation = (state.editor.rotation + 90) % 360;
    state.dirty = true;
    scheduleRender();
  });

  document.querySelectorAll('[data-fit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-fit]').forEach((b) => b.classList.toggle('active', b === btn));
      state.editor.fit = btn.dataset.fit;
      state.dirty = true;
      scheduleRender();
    });
  });
  document.querySelectorAll('[data-aspect]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-aspect]').forEach((b) => b.classList.toggle('active', b === btn));
      state.editor.aspect = btn.dataset.aspect;
      if (state.editor.originalImage) {
        sizeCanvasToImage(state.editor.originalImage);
        scheduleRender();
      }
      state.dirty = true;
    });
  });

  document.querySelectorAll('.nkm-color').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nkm-color').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if ($('textColorWheel')) $('textColorWheel').value = btn.dataset.color;
    });
  });
  $('textColorWheel')?.addEventListener('input', () => {
    document.querySelectorAll('.nkm-color').forEach((b) => b.classList.remove('active'));
  });
  $('textSize')?.addEventListener('input', (e) => {
    const lab = $('textSizeLabel');
    if (lab) lab.textContent = `${e.target.value}px`;
  });
  document.querySelectorAll('[data-align]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-align]').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  $('addTextBtn')?.addEventListener('click', () => {
    const text = ($('textInput')?.value || '').trim();
    if (!text || !state.editor.originalImage) return;
    const canvas = $('editorCanvas');
    const wheel = $('textColorWheel');
    const activeColor = document.querySelector('.nkm-color.active')?.dataset.color;
    const color = activeColor || wheel?.value || '#ffffff';
    const fontSize = parseInt($('textSize')?.value || '22', 10);
    const fontFamily = $('textFont')?.value || 'Inter';
    const align = document.querySelector('[data-align].active')?.dataset.align || 'center';
    state.editor.textOverlays.push({
      text: text.slice(0, 120),
      x: canvas.width / 2,
      y: canvas.height / 2,
      color,
      fontSize,
      fontFamily,
      fontWeight: 500,
      align,
      rotation: 0
    });
    state.editor.selectedText = state.editor.textOverlays.length - 1;
    state.editor.selectedSticker = null;
    if ($('textInput')) $('textInput').value = '';
    state.dirty = true;
    scheduleRender();
  });

  $('removeTextBtn')?.addEventListener('click', () => {
    if (state.editor.selectedText == null) return;
    state.editor.textOverlays.splice(state.editor.selectedText, 1);
    state.editor.selectedText = null;
    state.dirty = true;
    scheduleRender();
  });
  $('textRotateLeft')?.addEventListener('click', () => {
    const t = state.editor.textOverlays[state.editor.selectedText];
    if (!t) return;
    t.rotation = (t.rotation || 0) - 15;
    scheduleRender();
  });
  $('textRotateRight')?.addEventListener('click', () => {
    const t = state.editor.textOverlays[state.editor.selectedText];
    if (!t) return;
    t.rotation = (t.rotation || 0) + 15;
    scheduleRender();
  });

  $('stickerSmaller')?.addEventListener('click', () => {
    const s = state.editor.stickers[state.editor.selectedSticker];
    if (!s) return;
    s.size = Math.max(20, s.size - 8);
    scheduleRender();
  });
  $('stickerLarger')?.addEventListener('click', () => {
    const s = state.editor.stickers[state.editor.selectedSticker];
    if (!s) return;
    s.size = Math.min(160, s.size + 8);
    scheduleRender();
  });
  $('stickerRotateLeft')?.addEventListener('click', () => {
    const s = state.editor.stickers[state.editor.selectedSticker];
    if (!s) return;
    s.rotation = (s.rotation || 0) - 15;
    scheduleRender();
  });
  $('stickerRotateRight')?.addEventListener('click', () => {
    const s = state.editor.stickers[state.editor.selectedSticker];
    if (!s) return;
    s.rotation = (s.rotation || 0) + 15;
    scheduleRender();
  });
  $('removeStickerBtn')?.addEventListener('click', () => {
    if (state.editor.selectedSticker == null) return;
    state.editor.stickers.splice(state.editor.selectedSticker, 1);
    state.editor.selectedSticker = null;
    scheduleRender();
  });

  document.querySelectorAll('[data-privacy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-privacy]').forEach((b) => b.classList.toggle('active', b === btn));
      state.privacy = btn.dataset.privacy;
      state.dirty = true;
      saveDraftMeta();
    });
  });

  $('captionInput')?.addEventListener('input', (e) => {
    const v = e.target.value || '';
    state.caption = v;
    state.dirty = true;
    const c = $('captionCount');
    if (c) c.textContent = String(v.length);
    if (state.textOnly) {
      const preview = $('textOnlyPreview');
      if (preview) preview.textContent = v.trim() || 'Your post';
    }
    saveDraftMeta();
  });

  $('publishBtn')?.addEventListener('click', publish);
  $('retryBtn')?.addEventListener('click', publish);
  $('cancelUploadBtn')?.addEventListener('click', () => {
    state.uploadAbort?.abort();
    setStatus('Upload cancelled.', 'error');
    setProgress(null);
  });

  $('draftResumeBtn')?.addEventListener('click', resumeDraft);
  $('draftDiscardBtn')?.addEventListener('click', () => {
    clearDraft();
    const b = $('draftBanner');
    if (b) b.hidden = true;
  });

  const canvas = $('editorCanvas');
  canvas?.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  canvas?.addEventListener('touchstart', (e) => onPointerDown(e.touches[0]), { passive: true });
  canvas?.addEventListener('touchmove', (e) => {
    if (state.editor.drag) e.preventDefault();
    onPointerMove(e.touches[0]);
  }, { passive: false });
  canvas?.addEventListener('touchend', onPointerUp);

  window.addEventListener('beforeunload', (e) => {
    if (state.dirty || state.publishing) {
      saveDraftMeta();
      e.preventDefault();
      e.returnValue = '';
    }
  });

  window.addEventListener('popstate', () => {
    if (historyGuard) return;
    if (state.stage === 'mode') return;
    historyGuard = true;
    history.pushState({ nkmCreate: true, mode: state.mode }, '', location.href);
    historyGuard = false;
    goBack();
  });

  window.addEventListener('resize', () => {
    if (state.stage === 'editor' && state.editor.originalImage) {
      sizeCanvasToImage(state.editor.originalImage);
      scheduleRender();
    }
  });
}

async function resumeDraft() {
  const draft = loadDraftMeta();
  if (!draft?.mode) return;
  pickMode(draft.mode);
  state.privacy = draft.privacy || 'public';
  document.querySelectorAll('[data-privacy]').forEach((b) => {
    b.classList.toggle('active', b.dataset.privacy === state.privacy);
  });
  if ($('captionInput')) {
    $('captionInput').value = draft.caption || '';
    const c = $('captionCount');
    if (c) c.textContent = String((draft.caption || '').length);
  }
  if (draft.editor) {
    Object.assign(state.editor, {
      filter: draft.editor.filter || 'none',
      filterIntensity: draft.editor.filterIntensity ?? 1,
      rotation: draft.editor.rotation || 0,
      fit: draft.editor.fit || 'cover',
      aspect: draft.editor.aspect || 'free',
      textOverlays: draft.editor.textOverlays || [],
      stickers: draft.editor.stickers || []
    });
    const fi = $('filterIntensity');
    if (fi) {
      fi.value = Math.round(state.editor.filterIntensity * 100);
      const lab = $('filterIntensityLabel');
      if (lab) lab.textContent = `${fi.value}%`;
    }
    document.querySelectorAll('#filterRow .nkm-filter-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.filter === state.editor.filter);
    });
  }
  const stored = await readMediaBlob();
  if (stored?.blob) {
    const file = new File([stored.blob], stored.name || 'draft.jpg', { type: stored.type || 'image/jpeg' });
    await loadMediaFile(file);
  } else if (draft.textOnly && draft.mode === 'post') {
    enterTextOnly();
  } else {
    showStage('source');
  }
  const b = $('draftBanner');
  if (b) b.hidden = true;
}

function initFromUrl() {
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode');
  const draft = loadDraftMeta();
  if (draft?.mode && draft.savedAt && Date.now() - draft.savedAt < 7 * 24 * 60 * 60 * 1000) {
    const banner = $('draftBanner');
    if (banner) {
      banner.hidden = false;
      const meta = $('draftBannerMeta');
      if (meta) {
        meta.textContent = `${draft.mode === 'story' ? 'Story' : 'Post'} draft · ${draft.hasMedia ? 'with media' : 'caption only'}`;
      }
    }
  }
  history.pushState({ nkmCreate: true, mode: mode || null }, '', location.href);
  if (mode === 'post' || mode === 'story') pickMode(mode);
  else {
    showStage('mode');
    updateChrome();
  }
}

buildFilters();
buildStickers();
wireEvents();
initFromUrl();
