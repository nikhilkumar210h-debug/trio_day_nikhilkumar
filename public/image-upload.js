/** Authenticated Cloudinary uploads via the Trio Day signing Worker. */
import { auth } from './firebase-init.js';

const MEDIA_SIGN_URL = 'https://trio-media-upload.trioday-nikhil.workers.dev/media/sign';

function randomId(){
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Compress a File/Blob in the browser and return a Blob (not a data URL). */
export async function compressImageFile(file, {
  maxEdge = 1280,
  maxBytes = 850_000,
  startQuality = 0.78
} = {}){
  const url = URL.createObjectURL(file);
  try{
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
    const ctx = canvas.getContext('2d');
    if(!ctx) throw Error('Could not prepare image.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let type = 'image/webp';
    let quality = startQuality;
    let blob = await canvasToBlob(canvas, type, quality);
    if(!blob || blob.type !== 'image/webp'){
      type = 'image/jpeg';
      blob = await canvasToBlob(canvas, type, quality);
    }

    while(blob && blob.size > maxBytes && quality > 0.42){
      quality -= 0.06;
      blob = await canvasToBlob(canvas, type, quality);
    }

    if(!blob || blob.size > maxBytes){
      throw Error('Photo too large after compression.');
    }

    const ext = type === 'image/webp' ? 'webp' : 'jpg';
    return { blob, contentType: type, ext };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, type, quality){
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error('Could not compress image.'))),
      type,
      quality
    );
  });
}

async function getSigningPackage(kind, signal){
  const user = auth.currentUser;
  if(!user) throw Error('Login required for media upload.');

  const token = await user.getIdToken();
  const res = await fetch(MEDIA_SIGN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ kind }),
    signal
  });

  const data = await res.json().catch(() => ({}));
  if(!res.ok || !data.signature || !data.apiKey || !data.cloudName){
    throw Error(data?.error || `Media signing failed (${res.status})`);
  }
  return data;
}

async function signedUpload(file, kind, { signal } = {}){
  if(!file) throw Error('No file selected.');

  const signed = await getSigningPackage(kind, signal);
  const form = new FormData();
  form.append('file', file, file.name || `upload_${Date.now()}`);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  form.append('public_id', signed.publicId);
  form.append('folder', signed.folder);
  form.append('overwrite', signed.overwrite ? 'true' : 'false');
  form.append('allowed_formats', signed.allowedFormats);

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/${encodeURIComponent(signed.resourceType)}/upload`;
  const res = await fetch(endpoint, {
    method: 'POST',
    body: form,
    signal
  });

  const data = await res.json().catch(() => ({}));
  if(!res.ok || !data.secure_url){
    throw Error(data?.error?.message || `Cloudinary upload failed (${res.status})`);
  }
  return data.secure_url;
}

/** Post photo → compressed, authenticated Cloudinary upload. */
export async function uploadPostImage(uid, file, { signal } = {}){
  const { blob, ext } = await compressImageFile(file, {
    maxEdge: 1280,
    maxBytes: 850_000,
    startQuality: 0.78
  });
  return signedUpload(blob, 'post', {
    signal
  });
}

/** Story media — authenticated direct upload, no unsigned preset. */
export async function uploadStoryMedia(uid, file, { signal } = {}){
  if(file?.type?.startsWith('video/')){
    if(file.size > 100 * 1024 * 1024) throw Error('Video must be under 100MB.');
    return signedUpload(file, 'story_video', { signal });
  }

  if(!file?.type?.startsWith('image/')){
    throw Error('Story media must be an image or video.');
  }
  if(file.size > 12 * 1024 * 1024){
    throw Error('Story photo must be under 12MB.');
  }
  return signedUpload(file, 'story_image', { signal });
}

/** Profile photo → authenticated Cloudinary upload; the Worker owns the stable public ID. */
export async function uploadProfileImage(uid, file){
  const { blob } = await compressImageFile(file, {
    maxEdge: 640,
    maxBytes: 500_000,
    startQuality: 0.76
  });
  return signedUpload(new File([blob], 'avatar.webp', { type: blob.type }), 'profile');
}
