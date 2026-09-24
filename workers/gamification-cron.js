/**
 * Cloudflare Worker cron for gamification & cleanup tasks.
 *
 * Jobs:
 * - Delete expired stories & voice posts (expiresAtMs < now) from Firestore + Cloudinary
 * - Runs hourly via cron trigger
 *
 * Wrangler secrets required:
 *   npx wrangler secret put FIREBASE_PROJECT_ID      --config wrangler.gamification.toml
 *   npx wrangler secret put FIREBASE_SA_CLIENT_EMAIL --config wrangler.gamification.toml
 *   npx wrangler secret put FIREBASE_SA_PRIVATE_KEY  --config wrangler.gamification.toml
 *   npx wrangler secret put CLOUDINARY_API_KEY       --config wrangler.gamification.toml
 *   npx wrangler secret put CLOUDINARY_API_SECRET    --config wrangler.gamification.toml
 *
 * wrangler.gamification.toml triggers:
 *   [triggers]
 *   crons = ["0 * * * *"]
 */

// ─── Constants ────────────────────────────────────────────────────────────────
const FIREBASE_PUBLIC_KEYS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PROJECT_ID = 'nkm-ind'; // fallback only; deployment should provide FIREBASE_PROJECT_ID

// ─── base64url helpers ─────────────────────────────────────────────────────────
function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (b64.length % 4)) % 4;
  const padded = b64 + '='.repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ─── JWT creation for service account ──────────────────────────────────────────
async function createServiceAccountJwt(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now
  };

  function encode(obj) {
    return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  const headerB64 = encode(header);
  const claimB64 = encode(claimSet);
  const signingInput = `${headerB64}.${claimB64}`;

  // Import private key
  const pemBody = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const keyBytes = b64urlDecode(pemBody);

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${signingInput}.${sigB64}`;
}

// ─── OAuth2 access token (cached per request) ──────────────────────────────────
let _cachedAccessToken = null;
let _cachedTokenExpiry = 0;

async function getAccessToken(env) {
  const now = Date.now() / 1000;
  if (_cachedAccessToken && _cachedTokenExpiry > now + 60) {
    return _cachedAccessToken;
  }

  const jwt = await createServiceAccountJwt(
    env.FIREBASE_SA_CLIENT_EMAIL,
    env.FIREBASE_SA_PRIVATE_KEY
  );

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OAuth2 token exchange failed: ${txt}`);
  }

  const data = await res.json();
  _cachedAccessToken = data.access_token;
  _cachedTokenExpiry = now + (data.expires_in || 3600);
  return _cachedAccessToken;
}

// ─── Cloudinary delete helper ──────────────────────────────────────────────────
async function deleteFromCloudinary(mediaUrl, env) {
  const cloudName = env.CLOUDINARY_CLOUD_NAME || 'vyhglthg';
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) return;

  const match = mediaUrl.match(/\/(?:image|video|raw)\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
  if (!match) return;

  const publicId = match[1];
  const resourceType = mediaUrl.includes('/video/') ? 'video' : 'image';
  const timestamp = Math.floor(Date.now() / 1000);

  // SHA1 signature using crypto.subtle (Workers compatible)
  const sigStr = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(sigStr);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const formData = new FormData();
  formData.append('public_id', publicId);
  formData.append('timestamp', String(timestamp));
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
    { method: 'POST', body: formData }
  );
}

// ─── Main cleanup: delete expired posts (stories + voice) ──────────────────────
async function deleteExpiredPosts(env) {
  const now = Date.now();
  let totalDeleted = 0;
  let hasMore = true;

  // Run multiple batches to handle many docs (limit 100 per batch)
  while (hasMore) {
    const token = await getAccessToken(env);

    // Query expired posts via Firestore REST API
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

    const query = {
      structuredQuery: {
        from: [{ collectionId: 'posts' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: 'expiresAtMs' },
                  op: 'LESS_THAN',
                  value: { integerValue: String(now) }
                }
              }
            ]
          }
        },
        limit: 100
      }
    };

    const queryRes = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(query)
    });

    const docs = await queryRes.json();
    if (!docs.length) break;

    let batchDeleted = 0;
    for (const item of docs) {
      if (!item.document?.name) continue;
      const data = item.document.fields;
      const isStory = data.isStory?.booleanValue === true;
      const isVoice = data.isVoice?.booleanValue === true;
      const type = data.type?.stringValue;
      // Only ephemeral Story/Voice documents are eligible. Never delete a legacy
      // post merely because it happens to contain an expiresAtMs field.
      if (!isStory && !isVoice && type !== 'story' && type !== 'voice') continue;

      // Delete from Cloudinary first
      const mediaUrl = data.mediaUrl?.stringValue;
      if (mediaUrl) {
        try {
          await deleteFromCloudinary(mediaUrl, env);
        } catch (e) {
          console.warn('Cloudinary delete failed:', e.message);
        }
      }

      // Delete from Firestore
      const deleteUrl = `https://firestore.googleapis.com/v1/${item.document.name}`;
      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      batchDeleted++;
    }

    totalDeleted += batchDeleted;
    if (batchDeleted < 100) break;
  }

  console.log(`Cleanup: deleted ${totalDeleted} expired posts`);
  return totalDeleted;
}

export default {
  async fetch() {
    return new Response(
      JSON.stringify({ ok: true, message: 'Gamification cron — expiresAtMs cleanup worker' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  },

  async scheduled(event, env, ctx) {
    console.log('gamification-cron tick', event.cron, Date.now());
    ctx.waitUntil(deleteExpiredPosts(env));
  }
};
