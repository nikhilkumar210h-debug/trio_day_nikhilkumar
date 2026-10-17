/** Cloudinary signed upload via Worker (no unsigned preset). */
const CLOUD_NAME = 'vyhglthg';
import { auth } from './firebase-init.js';
import { cloudinaryAutoUrl } from './utils.js';
// Re-export: script.js / profile.js / challenge-create.js import this from here.
export { cloudinaryAutoUrl };
// Worker endpoint for signed upload params — set after deployment
const DEFAULT_MEDIA_SIGN_URL = 'https://trio-media-upload.trioday-nikhil.workers.dev/media/sign';

/** Media signer endpoint; window.__TRIO_CONFIG__.mediaSignUrl overrides the default. */
function mediaSignUrl() {
  try {
    const override = window.__TRIO_CONFIG__?.mediaSignUrl;
    if (typeof override === 'string' && /^https?:\/\//i.test(override)) return override.replace(/\/+$/, '');
  } catch (_) { /* non-browser context */ }
  return DEFAULT_MEDIA_SIGN_URL;
}

/** Sanitise a client-supplied file name for the Storage fallback path. */
function safeStorageFileName(name, fallbackExt) {
  const clean = String(name || '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+/, '').slice(-120);
  return clean || `upload_${Date.now()}.${fallbackExt || 'webp'}`;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Compress a File/Blob in the browser and return a Blob (not a data URL). */
export async function compressImageFile(file, {
  maxEdge = 1280,
  maxBytes = 850_000,
  startQuality = 0.78
} = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });

    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

    let type = 'image/webp';
    let quality = startQuality;
    let blob = await canvasToBlob(canvas, type, quality);
    if (!blob || blob.type !== 'image/webp') {
      type = 'image/jpeg';
      blob = await canvasToBlob(canvas, type, quality);
    }

    while (blob && blob.size > maxBytes && quality > 0.42) {
      quality -= 0.06;
      blob = await canvasToBlob(canvas, type, quality);
    }

    if (!blob || blob.size > maxBytes) {
      throw Error('Photo too large after compression.');
    }

    const ext = type === 'image/webp' ? 'webp' : 'jpg';
    return { blob, contentType: type, ext };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error('Could not compress image.'))),
      type,
      quality
    );
  });
}

/**
 * Get signed upload params from Worker.
 * @param {string} kind - 'story_image' | 'story_video' | 'profile'
 * @param {string} firebaseToken - Firebase ID token
 * @returns {Promise<Object>} signed params { signature, timestamp, cloudName, apiKey, resourceType, folder, publicId, allowedFormats, overwrite, uploadUrl }
 */
async function getSignedParams(kind, firebaseToken) {
  const token = firebaseToken || await auth.currentUser?.getIdToken();
  if (!token) throw Error('Please sign in again before uploading media.');
  const res = await fetch(mediaSignUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ kind })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.signature) {
    const msg = data?.error?.message || data?.detail || data?.error || `Worker error (${res.status})`;
    throw Error(msg);
  }
  return data;
}

/**
 * Upload a blob to Cloudinary using signed params.
 * @param {Blob} blob
 * @param {Object} signedParams - from getSignedParams
 * @param {AbortSignal} [signal] - optional abort signal
 * @returns {Promise<string>} secure_url
 */
async function uploadSignedBlob(blob, signedParams, signal, fileName) {
  const form = new FormData();
  form.append('file', blob, fileName || `upload.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`);
  form.append('api_key', signedParams.apiKey);
  form.append('timestamp', String(signedParams.timestamp));
  form.append('signature', signedParams.signature);
  form.append('folder', signedParams.folder);
  form.append('public_id', signedParams.publicId);
  form.append('overwrite', String(signedParams.overwrite));
  if (signedParams.resourceType === 'video') {
    form.append('resource_type', 'video');
  }

  const res = await fetch(signedParams.uploadUrl, {
    method: 'POST',
    body: form,
    signal
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    const msg = data?.error?.message || `Cloudinary upload failed (${res.status})`;
    throw Error(msg);
  }
  return data.secure_url;
}

/**
 * Upload video file directly to Cloudinary using signed params.
 * @param {File} file
 * @param {Object} signedParams
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>} secure_url
 */
async function uploadSignedVideo(file, signedParams, signal) {
  const form = new FormData();
  form.append('file', file, file.name || `video_${Date.now()}.mp4`);
  form.append('api_key', signedParams.apiKey);
  form.append('timestamp', String(signedParams.timestamp));
  form.append('signature', signedParams.signature);
  form.append('folder', signedParams.folder);
  form.append('public_id', signedParams.publicId);
  form.append('overwrite', String(signedParams.overwrite));
  form.append('resource_type', 'video');

  const res = await fetch(signedParams.uploadUrl, {
    method: 'POST',
    body: form,
    signal
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    const msg = data?.error?.message || `Video upload failed (${res.status})`;
    throw Error(msg);
  }
  return data.secure_url;
}

/**
 * Firebase Storage fallback — last resort when the signed Cloudinary path is
 * unavailable. Uploads are isolated per user (uploads/<uid>/<fileName>) so the
 * Storage rules can enforce request.auth.uid == uid.
 * @param {Blob|File} blobOrFile
 * @param {string} [fileName]
 * @returns {Promise<string>} download URL
 */
export async function uploadToStorageFallback(blobOrFile, fileName) {
  const user = auth.currentUser;
  if (!user) throw Error('Please sign in again before uploading media.');
  const { getStorage, ref, uploadBytes, getDownloadURL } =
    await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js');
  const objectRef = ref(getStorage(), `uploads/${user.uid}/${safeStorageFileName(fileName, 'webp')}`);
  await uploadBytes(objectRef, blobOrFile, {
    contentType: blobOrFile?.type || 'application/octet-stream'
  });
  return getDownloadURL(objectRef);
}

/** Story media — ORIGINAL QUALITY (short term 24h) — signed upload */
export async function uploadStoryMedia(uid, file, firebaseToken, signal) {
  if (file?.type?.startsWith('video/') || file?.type?.startsWith('audio/')) {
    if (file.size > 100 * 1024 * 1024) throw Error('Video must be under 100MB.');
    const signed = await getSignedParams('story_video', firebaseToken);
    return uploadSignedVideo(file, signed, signal);
  }
  // Image story: client-compress to WebP (longest edge ≤1080px, ~0.80 quality)
  // before upload, saving Cloudinary storage and bandwidth. Animated GIFs are
  // uploaded untouched — canvas would destroy the animation; videos bypass this
  // branch entirely.
  let uploadFile = file;
  if (file.type !== 'image/gif') {
    try {
      const { blob, contentType, ext } = await compressImageFile(file, {
        maxEdge: 1080,
        maxBytes: 1_000_000,
        startQuality: 0.80
      });
      uploadFile = new File([blob], (file.name || `story_${Date.now()}`) + '.' + ext, { type: contentType });
    } catch (err) {
      console.warn('[uploadStoryMedia] client WebP compression skipped:', err.message);
    }
  }
  if (uploadFile.size > 12 * 1024 * 1024) throw Error('Story photo must be under 12MB (original quality).');
  try {
    const signed = await getSignedParams('story_image', firebaseToken);
    const form = new FormData();
    form.append('file', uploadFile, uploadFile.name);
    form.append('api_key', signed.apiKey);
    form.append('timestamp', String(signed.timestamp));
    form.append('signature', signed.signature);
    form.append('folder', signed.folder);
    form.append('public_id', signed.publicId);
    form.append('overwrite', String(signed.overwrite));

    const res = await fetch(signed.uploadUrl, { method: 'POST', body: form, signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.secure_url) throw Error(data?.error?.message || `Cloudinary upload failed (${res.status})`);
    return cloudinaryAutoUrl(data.secure_url);
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('[uploadStoryMedia] Cloudinary upload unavailable, using Firebase Storage fallback:', err.message);
    return uploadToStorageFallback(uploadFile, `story_${Date.now()}`);
  }
}

/** Profile photo → Cloudinary folder trio/profiles (signed, overwrite) */
export async function uploadProfileImage(uid, file, firebaseToken, signal) {
  const { blob, ext } = await compressImageFile(file, {
    maxEdge: 640,
    maxBytes: 500_000,
    startQuality: 0.76
  });
  try {
    const signed = await getSignedParams('profile', firebaseToken);
    const url = await uploadSignedBlob(blob, signed, signal, `avatar.${ext}`);
    return cloudinaryAutoUrl(url);
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('[uploadProfileImage] Cloudinary upload unavailable, using Firebase Storage fallback:', err.message);
    return uploadToStorageFallback(blob, `avatar_${Date.now()}.${ext}`);
  }
}