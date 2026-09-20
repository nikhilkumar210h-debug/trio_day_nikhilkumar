/** Cloudinary unsigned upload (no Firebase Storage). */
const CLOUD_NAME = 'vyhglthg';
const UPLOAD_PRESET = 'trio_uploads';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const VIDEO_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;

function randomId(){
  return Math.random().toString(36).slice(2, 10);
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
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

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

/**
 * Upload a compressed blob to Cloudinary (unsigned preset).
 * @returns {Promise<string>} secure_url
 */
export async function uploadImageBlob(blob, { folder, publicId, fileName, signal } = {}){
  const form = new FormData();
  form.append('file', blob, fileName || `upload.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`);
  form.append('upload_preset', UPLOAD_PRESET);
  if(folder) form.append('folder', folder);
  if(publicId) form.append('public_id', publicId);

  const res = await fetch(UPLOAD_URL, { method: 'POST', body: form, signal });
  const data = await res.json().catch(() => ({}));
  if(!res.ok || !data.secure_url){
    const msg = data?.error?.message || `Cloudinary upload failed (${res.status})`;
    throw Error(msg);
  }
  return data.secure_url;
}

/** Post photo → Cloudinary folder trio/posts */
export async function uploadPostImage(uid, file, { signal } = {}){
  const { blob, ext } = await compressImageFile(file, {
    maxEdge: 1280,
    maxBytes: 850_000,
    startQuality: 0.78
  });
  return uploadImageBlob(blob, {
    folder: 'trio/posts',
    publicId: `${uid}_${Date.now()}_${randomId()}`,
    fileName: `post.${ext}`,
    signal
  });
}

/** Story media — ORIGINAL QUALITY (short term 24h) — no compression */
export async function uploadStoryMedia(uid, file, { signal } = {}){
  if(file?.type?.startsWith('video/')){
    if(file.size > 100 * 1024 * 1024) throw Error('Video must be under 100MB.');
    return uploadVideoBlob(file, {
      folder: 'trio/stories',
      publicId: `${uid}_${Date.now()}_${randomId()}`,
      signal
    });
  }
  // Image story: upload original file directly, keep original quality (no compress, no resize)
  if(file.size > 12 * 1024 * 1024) throw Error('Story photo must be under 12MB (original quality).');
  // Direct upload original blob — Cloudinary will keep original
  const form = new FormData();
  form.append('file', file, file.name || `story_${Date.now()}_${file.type==='image/webp'?'webp':file.type==='image/png'?'png':'jpg'}`);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', 'trio/stories');
  form.append('public_id', `${uid}_${Date.now()}_${randomId()}`);
  const res = await fetch(UPLOAD_URL, { method: 'POST', body: form, signal });
  const data = await res.json().catch(() => ({}));
  if(!res.ok || !data.secure_url) throw Error(data?.error?.message || `Cloudinary upload failed (${res.status})`);
  return data.secure_url;
}

async function uploadVideoBlob(file, { folder, publicId, signal } = {}){
  const form = new FormData();
  form.append('file', file, file.name || `video_${Date.now()}.mp4`);
  form.append('upload_preset', UPLOAD_PRESET);
  if(folder) form.append('folder', folder);
  if(publicId) form.append('public_id', publicId);
  const res = await fetch(VIDEO_UPLOAD_URL, { method: 'POST', body: form, signal });
  const data = await res.json().catch(() => ({}));
  if(!res.ok || !data.secure_url){
    const msg = data?.error?.message || `Video upload failed (${res.status})`;
    throw Error(msg);
  }
  return data.secure_url;
}

/** Profile photo → Cloudinary folder trio/profiles */
export async function uploadProfileImage(uid, file){
  const { blob, ext } = await compressImageFile(file, {
    maxEdge: 640,
    maxBytes: 500_000,
    startQuality: 0.76
  });
  return uploadImageBlob(blob, {
    folder: 'trio/profiles',
    publicId: `${uid}_avatar`,
    fileName: `avatar.${ext}`
  });
}
