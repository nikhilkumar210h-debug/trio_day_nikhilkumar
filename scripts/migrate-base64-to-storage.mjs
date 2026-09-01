/**
 * Migrate base64 / data-URL images from Firestore → Cloudinary.
 *
 * Targets (from current Trio Day code):
 *   users/{uid}.photoURL  → Cloudinary trio/profiles
 *   posts/{id}.mediaUrl    → Cloudinary trio/posts
 *   posts/{id}.photoURL   → Cloudinary trio/posts (only if still a data URL)
 *
 * Setup:
 *   1. Firebase Console → Project settings → Service accounts → Generate new private key
 *   2. Save as scripts/serviceAccountKey.json  (already gitignored)
 *   3. cd scripts && npm install
 *   4. npm run migrate:dry   # preview
 *   5. npm run migrate       # apply
 *
 * Options:
 *   --dry-run     Do not write Cloudinary / Firestore
 *   --posts-only  Only migrate posts
 *   --users-only  Only migrate users
 *
 * Env (optional):
 *   CLOUDINARY_CLOUD_NAME   default: vyhglthg
 *   CLOUDINARY_UPLOAD_PRESET default: trio_uploads
 *   GOOGLE_APPLICATION_CREDENTIALS  path to service account JSON
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const POSTS_ONLY = args.has('--posts-only');
const USERS_ONLY = args.has('--users-only');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'vyhglthg';
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'trio_uploads';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const credPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  join(__dirname, 'serviceAccountKey.json');

if (!existsSync(credPath)) {
  console.error(`
Missing service account key.
  Place Firebase Admin JSON at:
    ${credPath}
  Or set GOOGLE_APPLICATION_CREDENTIALS to the key path.
`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

function isDataImage(value) {
  return typeof value === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value);
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/is.exec(dataUrl);
  if (!match) throw new Error('Invalid image data URL');
  const contentType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  const ext =
    contentType.includes('webp') ? 'webp'
    : contentType.includes('png') ? 'png'
    : contentType.includes('gif') ? 'gif'
    : 'jpg';
  return { contentType, buffer, ext };
}

async function uploadToCloudinary({ buffer, contentType, ext, folder, publicId }) {
  if (DRY_RUN) {
    return {
      url: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${folder}/${publicId}.${ext}`,
      skipped: true
    };
  }

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: contentType }), `${publicId}.${ext}`);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', folder);
  form.append('public_id', publicId);

  const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error(data?.error?.message || `Cloudinary upload failed (${res.status})`);
  }
  return { url: data.secure_url, skipped: false };
}

async function migrateUsers() {
  console.log('\n=== users.photoURL ===');
  const snap = await db.collection('users').get();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const photoURL = data.photoURL;

    if (!isDataImage(photoURL)) {
      skipped += 1;
      continue;
    }

    try {
      const { contentType, buffer, ext } = parseDataUrl(photoURL);
      const publicId = `${doc.id}_avatar`;
      console.log(`  user ${doc.id}: ${(buffer.length / 1024).toFixed(1)} KB → trio/profiles/${publicId}`);

      const { url } = await uploadToCloudinary({
        buffer,
        contentType,
        ext,
        folder: 'trio/profiles',
        publicId
      });

      if (!DRY_RUN) {
        await doc.ref.update({
          photoURL: url,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      migrated += 1;
    } catch (err) {
      failed += 1;
      console.error(`  FAIL user ${doc.id}:`, err.message || err);
    }
  }

  console.log(`users done — migrated=${migrated} skipped=${skipped} failed=${failed}`);
  return { migrated, skipped, failed };
}

async function migratePosts() {
  console.log('\n=== posts.mediaUrl / posts.photoURL ===');
  const snap = await db.collection('posts').get();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const updates = {};
    const uid = data.uid || 'unknown';

    try {
      if (isDataImage(data.mediaUrl)) {
        const { contentType, buffer, ext } = parseDataUrl(data.mediaUrl);
        const publicId = `${uid}_${doc.id}`;
        console.log(`  post ${doc.id} mediaUrl: ${(buffer.length / 1024).toFixed(1)} KB → trio/posts/${publicId}`);
        const { url } = await uploadToCloudinary({
          buffer,
          contentType,
          ext,
          folder: 'trio/posts',
          publicId
        });
        updates.mediaUrl = url;
      }

      if (isDataImage(data.photoURL)) {
        const { contentType, buffer, ext } = parseDataUrl(data.photoURL);
        const publicId = `${uid}_${doc.id}_author`;
        console.log(`  post ${doc.id} photoURL: ${(buffer.length / 1024).toFixed(1)} KB → trio/posts/${publicId}`);
        const { url } = await uploadToCloudinary({
          buffer,
          contentType,
          ext,
          folder: 'trio/posts',
          publicId
        });
        updates.photoURL = url;
      }

      if (!Object.keys(updates).length) {
        skipped += 1;
        continue;
      }

      // No separate "base64" field — data URL lived IN mediaUrl/photoURL.
      if (!DRY_RUN) {
        await doc.ref.update(updates);
      }

      migrated += 1;
    } catch (err) {
      failed += 1;
      console.error(`  FAIL post ${doc.id}:`, err.message || err);
    }
  }

  console.log(`posts done — migrated=${migrated} skipped=${skipped} failed=${failed}`);
  return { migrated, skipped, failed };
}

async function main() {
  console.log(`Cloudinary: ${CLOUD_NAME} / preset ${UPLOAD_PRESET}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE WRITE'}`);

  const summary = {};
  if (!POSTS_ONLY) summary.users = await migrateUsers();
  if (!USERS_ONLY) summary.posts = await migratePosts();

  console.log('\n=== summary ===');
  console.log(JSON.stringify(summary, null, 2));
  if (DRY_RUN) console.log('\nDry run complete. Re-run without --dry-run to apply.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
