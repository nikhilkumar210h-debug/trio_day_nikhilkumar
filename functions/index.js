const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const crypto = require('crypto');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'vyhglthg';
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

function extractPublicId(mediaUrl) {
  if (!mediaUrl) return null;
  const match = mediaUrl.match(/\/upload\/v\d+\/(.+)/);
  if (!match) return null;
  const withExt = match[1];
  return withExt.replace(/\.[^.]+$/, '');
}

async function deleteCloudinaryImage(publicId) {
  if (!publicId || !API_KEY || !API_SECRET) {
    console.log('Cloudinary credentials not available, skipping image deletion for:', publicId);
    return;
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureString = `api_key=${API_KEY}&public_id=${publicId}&timestamp=${timestamp}&api_secret=${API_SECRET}`;
  const signature = crypto.createHash('md5').update(signatureString).digest('hex');

  const params = new URLSearchParams();
  params.append('method', 'delete');
  params.append('public_id', publicId);
  params.append('api_key', API_KEY);
  params.append('timestamp', timestamp.toString());
  params.append('signature', signature);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: params,
    });
    const data = await res.json();
    if (data.result === 'ok') {
      console.log(`Cloudinary image deleted: ${publicId}`);
    } else {
      console.warn('Cloudinary delete response:', data);
    }
  } catch (err) {
    console.warn('Cloudinary delete failed for', publicId, err.message);
  }
}

/**
 * Auto-delete expired stories (older than 24 hours).
 * Runs every 30 minutes.
 * Deletes both the Firestore doc AND the Cloudinary image.
 */
exports.deleteExpiredStories = onSchedule({
  schedule: 'every 30 minutes',
  timeoutSeconds: 120,
  memory: '512MiB',
}, async () => {
  const expiryThreshold = Date.now() - 24 * 60 * 60 * 1000;
  const snapshot = await db.collection('posts')
    .where('isStory', '==', true)
    .where('expiresAtMs', '<', expiryThreshold)
    .get();

  if (snapshot.empty) {
    console.log('No expired stories to delete.');
    return;
  }

  const batch = db.batch();
  const deletedIds = [];
  const deletionPromises = [];
  snapshot.forEach(doc => {
    batch.delete(doc.ref);
    deletedIds.push(doc.id);
    const data = doc.data();
    const publicId = extractPublicId(data.mediaUrl);
    if (publicId) {
      deletionPromises.push(deleteCloudinaryImage(publicId));
    }
  });
  await batch.commit();
  await Promise.all(deletionPromises);
  console.log(`Deleted ${deletedIds.length} expired stories (${deletionPromises.length} Cloudinary images).`);
});