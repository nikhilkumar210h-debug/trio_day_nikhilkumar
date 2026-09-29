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


const DAILY_QUESTIONS = [
 'If you could change one thing about your school or college, what would it be?',
 'What matters more for a first job: skills or marks?',
 'Which study habit actually helps you remember things?',
 'Would you rather learn one skill deeply or five skills lightly?',
 'What should students learn before choosing a career?',
 'Which matters more in a team: speed or communication?',
 'What makes a good teacher unforgettable?',
 'Would you choose a stable job or a risky startup idea?',
 'What is one exam rule you would redesign?',
 'Which is harder: starting a project or finishing it?',
 'What makes an app worth opening every day?',
 'Would you rather build for 100 loyal users or 10,000 casual users?',
 'What should every student know about money?',
 'Which is more useful: asking good questions or giving quick answers?',
 'What makes online communities feel welcoming?',
 'Would you rather work alone or with a great team?',
 'Which college factor matters most to you: course, location, cost or people?',
 'What is the best way to recover after a bad study day?',
 'Would you rather have more free time or more money?',
 'What makes a challenge fun instead of stressful?',
 'Which technology will change student life the most?',
 'What is one skill you wish schools taught earlier?',
 'Would you rather travel often or build something long-term?',
 'What makes someone a good friend in a busy life?',
 'Which is more satisfying: learning something or making something?',
 'What should a beginner check before joining a new online community?',
 'Would you rather solve a hard problem or explain an easy one brilliantly?',
 'What is one small habit that improves your day?',
 'Which matters more when learning: consistency or intensity?',
 'What question should Trio Day ask students tomorrow?'
];
function localDateKeyUtc(ms=Date.now()){return new Date(ms).toISOString().slice(0,10);}
function dailyQuestionFor(ms=Date.now()){const key=localDateKeyUtc(ms);let hash=0;for(const ch of key)hash=(hash*31+ch.charCodeAt(0))>>>0;return {date:key,index:hash%DAILY_QUESTIONS.length,question:DAILY_QUESTIONS[hash%DAILY_QUESTIONS.length],updatedAtMs:ms};}
async function fsPatch(projectId, accessToken, path, data) {
  const url = firestoreBase(projectId) + '/' + path;
  const res = await fetch(url, {method:'PATCH',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({fields:toFirestoreFields(data)})});
  if (!res.ok) throw new Error('Firestore PATCH '+path+' failed: '+res.status);
  return true;
}
function firestoreBase(projectId){return 'https://firestore.googleapis.com/v1/projects/'+projectId+'/databases/(default)/documents';}
function toFirestoreValue(v){if(v===null||v===undefined)return {nullValue:null};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return {integerValue:String(Math.round(v))};if(typeof v==='string')return {stringValue:v};if(Array.isArray(v))return {arrayValue:{values:v.map(toFirestoreValue)}};if(typeof v==='object')return {mapValue:{fields:toFirestoreFields(v)}};return {stringValue:String(v)};}
function toFirestoreFields(obj){const fields={};for(const[k,v]of Object.entries(obj))fields[k]=toFirestoreValue(v);return fields;}
async function publishDailyQuestion(env){const projectId=env.FIREBASE_PROJECT_ID||PROJECT_ID;const token=await getAccessToken(env);const daily=dailyQuestionFor();await fsPatch(projectId,token,'config/dailyQuestion',{...daily,publishedAtMs:Date.now()});console.log('Daily question published',daily.date,daily.index);}

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

async function deleteExpiredTempChats(env){
  const MAX_DELETES_PER_RUN = 200;
  const projectId=env.FIREBASE_PROJECT_ID||PROJECT_ID;
  const token=await getAccessToken(env);
  const now=Date.now();
  const base=firestoreBase(projectId);
  const q={structuredQuery:{from:[{collectionId:'tempMessages'}],where:{fieldFilter:{field:{fieldPath:'expireAt'},op:'LESS_THAN',value:{timestampValue:new Date(now).toISOString()}}},limit:MAX_DELETES_PER_RUN}};
  const res=await fetch(base.replace('/documents','')+':runQuery',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(q)});
  if(!res.ok) throw new Error('Temporary chat cleanup query failed: '+res.status);
  const rows=await res.json();
  const rooms=[];
  const seenRooms=new Set();
  let deletedCount=0;
  for(const item of rows){
    if(deletedCount>=MAX_DELETES_PER_RUN) break;
    const name=item.document?.name||'';
    if(!name) continue;
    const deleted=await fetch('https://firestore.googleapis.com/v1/'+name,{method:'DELETE',headers:{Authorization:'Bearer '+token}});
    if(deleted.ok){
      deletedCount++;
      const match=name.match(/\\/tempChats\\/([^/]+)\\/tempMessages\\//);
      if(match&&!seenRooms.has(match[1])){seenRooms.add(match[1]);rooms.push(match[1]);}
    }
  }
  for(const roomId of rooms){
    if(deletedCount>=MAX_DELETES_PER_RUN) break;
    const deleted=await fetch(base+'/tempChats/'+encodeURIComponent(roomId),{method:'DELETE',headers:{Authorization:'Bearer '+token}});
    if(deleted.ok) deletedCount++;
  }
  console.log('Temporary chat cleanup: deleted '+deletedCount+'/'+MAX_DELETES_PER_RUN+' documents this run.');
  return deletedCount;
}
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
    if (event.cron === '15 0 * * *') {
      ctx.waitUntil(publishDailyQuestion(env));
    } else {
      ctx.waitUntil(Promise.all([deleteExpiredPosts(env), deleteExpiredTempChats(env)]));
    }
  }
};
