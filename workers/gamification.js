/**
 * Cloudflare Worker — Trio Day Gamification Backend
 *
 * Handles all server-side writes that are blocked from direct client access:
 *   POST /gamification/award-xp        — XP + level + leaderboard + badges
 *   POST /gamification/bump-streak     — streak fields
 *
 * Auth: every request must carry Authorization: Bearer <firebase-id-token>
 * The Worker verifies the token, derives uid, and writes via service account.
 *
 * Wrangler secrets required:
 *   FIREBASE_PROJECT_ID        e.g. nkm-ind
 *   FIREBASE_SA_CLIENT_EMAIL   service account email
 *   FIREBASE_SA_PRIVATE_KEY    RSA private key PEM (-----BEGIN PRIVATE KEY-----)
 *
 * Setup:
 *   npx wrangler secret put FIREBASE_PROJECT_ID
 *   npx wrangler secret put FIREBASE_SA_CLIENT_EMAIL
 *   npx wrangler secret put FIREBASE_SA_PRIVATE_KEY
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 100;
const LEADERBOARD_TOP_N = 50;
const MAX_XP_AWARD = 500;          // per single call
const FIREBASE_PUBLIC_KEYS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ─── Per-UID rate limiting (10 requests/minute) ───────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitMap = new Map(); // uid -> [timestamps]

function checkRateLimit(uid) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(uid) || [];
  const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((recent[0] + RATE_LIMIT_WINDOW_MS - Date.now()) / 1000) };
  }
  recent.push(now);
  rateLimitMap.set(uid, recent);
  return { allowed: true };
}

const SYSTEM_BADGES = [
  { id:'badge_first_complete', name:'First Challenge', icon:'🎯', desc:'Complete your first Challenge' },
  { id:'badge_streak_3', name:'On Fire', icon:'🔥', desc:'Reach a 3-day Challenge streak' },
  { id:'badge_streak_7', name:'Week Warrior', icon:'⚡', desc:'Reach a 7-day Challenge streak' },
  { id:'badge_streak_30', name:'Unstoppable', icon:'💎', desc:'Reach a 30-day Challenge streak' },
  { id:'badge_xp_500', name:'Rising Star', icon:'✨', desc:'Reach 500 Challenge XP' },
  { id:'badge_xp_1000', name:'Legend', icon:'👑', desc:'Reach 1000 Challenge XP' }
];

// ─── CORS (shared — see workers/shared/cors.js for single source)
import { corsHeaders, json, isAllowedOrigin } from "./shared/cors.js";

// ─── Period key helpers (matches gamification/constants.js) ───────────────────

function pad(n) { return String(n).padStart(2, '0'); }

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localWeekKey(d = new Date()) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (date.getDay() + 6) % 7; // Mon=0
  date.setDate(date.getDate() - day + 3);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNo = 1 + Math.round(
    ((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  );
  return `${date.getFullYear()}-W${pad(weekNo)}`;
}

function localMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function yesterdayDateKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
}

function levelFromXp(xp) {
  return Math.floor(Math.max(0, Number(xp) || 0) / XP_PER_LEVEL) + 1;
}


// Firebase / Firestore REST helpers
function b64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function createServiceAccountJwt(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  function encode(obj) {
    return btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  const headerB64 = encode(header);
  const claimB64 = encode(claimSet);
  const signingInput = `${headerB64}.${claimB64}`;

  const pemBody = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyBytes = b64urlDecode(pemBody);

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sigBytes = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${signingInput}.${sigB64}`;
}

let _cachedAccessToken = null;
let _cachedTokenExpiry = 0;

async function getAccessToken(env) {
  const now = Date.now() / 1000;
  if (_cachedAccessToken && _cachedTokenExpiry > now + 60) {
    return _cachedAccessToken;
  }

  const jwt = await createServiceAccountJwt(
    env.FIREBASE_SA_CLIENT_EMAIL,
    env.FIREBASE_SA_PRIVATE_KEY,
  );

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
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

async function verifyFirebaseIdToken(token, projectId, cacheStorage) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch (_) {
    throw new Error("Token decode failed");
  }

  if (header.alg !== "RS256") throw new Error("Unsupported algorithm");

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) throw new Error("Token expired");
  if (payload.iat > now + 60) throw new Error("Token issued in future");
  if (payload.aud !== projectId) throw new Error("Token audience mismatch");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw new Error("Token issuer mismatch");
  if (!payload.sub) throw new Error("Missing subject");

  const cacheKey = "https://firebase-pubkeys.internal/v1";
  try {
    const cached = await cacheStorage.match(cacheKey);
    if (cached) {
      const keys = await cached.json();
      const publicKey = keys[header.kid];
      if (!publicKey) throw new Error("Unknown key id");

      const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
      const signature = b64urlDecode(parts[2]);

      const valid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        publicKey,
        signature,
        signingInput,
      );
      if (!valid) throw new Error("Token signature invalid");
      return payload;
    }
  } catch (_) {
    /* ignore cache errors */
  }

  const res = await fetch(FIREBASE_PUBLIC_KEYS_URL);
  const certMap = await res.json();

  const result = {};
  for (const [kid, pem] of Object.entries(certMap)) {
    try {
      const pemBody = pem
        .replace("-----BEGIN CERTIFICATE-----", "")
        .replace("-----END CERTIFICATE-----", "")
        .replace(/\s/g, "");
      const derBytes = b64urlDecode(pemBody);

      const cryptoKey = await crypto.subtle.importKey(
        "spki",
        extractPublicKeyFromCert(derBytes),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      result[kid] = cryptoKey;
    } catch (_) {
      /* skip invalid keys */
    }
  }

  const response = new Response(JSON.stringify(result), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
  await cacheStorage.put(cacheKey, response);

  const publicKey = result[header.kid];
  if (!publicKey) throw new Error("Unknown key id");

  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = b64urlDecode(parts[2]);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signingInput,
  );
  if (!valid) throw new Error("Token signature invalid");

  return payload;
}

function extractPublicKeyFromCert(derBytes) {
  let offset = 0;

  function readTag(buf, off) {
    return { tag: buf[off], next: off + 1 };
  }

  function readLength(buf, off) {
    if (buf[off] < 0x80) return { len: buf[off], next: off + 1 };
    const numBytes = buf[off] & 0x7f;
    let len = 0;
    for (let i = 0; i < numBytes; i++) len = (len << 8) | buf[off + 1 + i];
    return { len, next: off + 1 + numBytes };
  }

  function skipField(buf, off) {
    const { next: afterTag } = readTag(buf, off);
    const { len, next: afterLen } = readLength(buf, afterTag);
    return afterLen + len;
  }

  function enterSequence(buf, off) {
    const { next: afterTag } = readTag(buf, off);
    const { next: afterLen } = readLength(buf, afterTag);
    return afterLen;
  }

  offset = enterSequence(derBytes, offset);
  offset = enterSequence(derBytes, offset);
  if (derBytes[offset] === 0xa0) offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  const { next: afterTag } = readTag(derBytes, offset);
  const { len, next: afterLen } = readLength(derBytes, afterTag);
  const end = afterLen + len;
  return derBytes.slice(offset, end).buffer;
}

function firestoreBase(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return { integerValue: String(Math.round(v)) };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v))
    return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === "object")
    return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function fromFirestoreValue(v) {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("stringValue" in v) return v.stringValue;
  if ("arrayValue" in v)
    return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in v) return fromFirestoreFields(v.mapValue.fields || {});
  if ("timestampValue" in v) return v.timestampValue;
  return null;
}

function fromFirestoreFields(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = fromFirestoreValue(v);
  }
  return obj;
}

async function fsGet(projectId, accessToken, path) {
  const url = `${firestoreBase(projectId)}/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET ${path} failed: ${res.status}`);
  const doc = await res.json();
  return doc.fields ? fromFirestoreFields(doc.fields) : {};
}

async function fsRunQuery(projectId, accessToken, structuredQuery, parent = null) {
  const url = firestoreBase(projectId).replace('/documents', '') + ':runQuery';
  const body = parent ? { structuredQuery, parent } : { structuredQuery };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Firestore query failed: ' + res.status);
  const rows = await res.json();
  return rows.filter(r => r.document).map(r => fromFirestoreFields(r.document.fields || {}));
}



function evaluateBadgesDelta(currentBadges, xp, streak) {
  const have = new Set(Array.isArray(currentBadges) ? currentBadges : []);
  const earned = [];
  const add = id => { if (!have.has(id)) { have.add(id); earned.push(id); } };
  if (have.size === 0) add('badge_first_complete');
  if (Number(streak) >= 3) add('badge_streak_3');
  if (Number(streak) >= 7) add('badge_streak_7');
  if (Number(streak) >= 30) add('badge_streak_30');
  if (Number(xp) >= 500) add('badge_xp_500');
  if (Number(xp) >= 1000) add('badge_xp_1000');
  return earned;
}

async function fsCreateDoc(projectId, accessToken, path, data) {
  const slash = path.lastIndexOf('/');
  const parent = path.slice(0, slash);
  const documentId = path.slice(slash + 1);
  const url = firestoreBase(projectId) + '/' + parent + '?documentId=' + encodeURIComponent(documentId);
  const res = await fetch(url, {
    method:'POST',
    headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
    body:JSON.stringify({fields:toFirestoreFields(data)})
  });
  if (res.status === 409) return false;
  if (!res.ok) throw new Error('Firestore CREATE '+path+' failed: '+res.status);
  return true;
}

async function fsPatch(projectId, accessToken, path, data, fieldPaths) {
  const mask = (fieldPaths || Object.keys(data || {})).map(k=>'updateMask.fieldPaths='+encodeURIComponent(k)).join('&');
  const url = firestoreBase(projectId) + '/' + path + '?' + mask;
  const res = await fetch(url, {
    method:'PATCH',
    headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
    body:JSON.stringify({fields:toFirestoreFields(data)})
  });
  if (!res.ok) throw new Error('Firestore PATCH '+path+' failed: '+res.status);
  return true;
}

async function upsertLeaderboard(projectId, accessToken, boardId, entry, valueKey) {
  try {
    const current = await fsGet(projectId, accessToken, 'leaderboards/'+boardId) || {};
    const entries = Array.isArray(current.entries) ? [...current.entries] : [];
    const next = {uid:entry.uid,name:entry.name||'User',photoURL:entry.photoURL||null,level:Number(entry.level)||1,value:Number(entry[valueKey])||0};
    const idx = entries.findIndex(x=>x?.uid===entry.uid);
    if(idx>=0) entries[idx]=next; else entries.push(next);
    entries.sort((a,b)=>(Number(b.value)||0)-(Number(a.value)||0));
    entries.splice(LEADERBOARD_TOP_N);
    await fsPatch(projectId, accessToken, 'leaderboards/'+boardId, {entries}, ['entries']);
  } catch (_) {}
}

async function handleAwardXp(uid, body, env) {
  const challengeId=String(body?.meta?.challengeId||'').trim();
  if(!challengeId) throw new Error('challengeId required');
  const projectId=env.FIREBASE_PROJECT_ID, token=await getAccessToken(env);
  const answer=await fsGet(projectId,token,'challengeAnswers/'+uid+'_'+challengeId);
  if(!answer || answer.uid!==uid || answer.challengeId!==challengeId || !Number.isInteger(Number(answer.choice))) throw new Error('Challenge answer not found');
  const task=await fsGet(projectId,token,'communityTasks/'+challengeId);
  if(task && (task.kind!=='challenge' || task.activityType!=='challenge')) throw new Error('Not a Challenge');
  if(task?.creatorUid===uid) throw new Error('Creators cannot earn XP from their own Challenge');

  const amount=25, grantKey='challenge_'+challengeId;
  const created=await fsCreateDoc(projectId,token,'users/'+uid+'/xpAwards/'+grantKey,{uid,grantKey,amount,createdAtMs:Date.now()});
  const userData=await fsGet(projectId,token,'users/'+uid)||{};
  if(!created) return {ok:true,xp:Number(userData.xp)||0,level:Number(userData.level)||levelFromXp(userData.xp),leveledUp:false,awarded:0,alreadyAwarded:true,badgesEarned:[]};

  const prevXp=Number(userData.xp)||0, newXp=prevXp+amount, newLevel=levelFromXp(newXp);
  const weekKey=localWeekKey(), monthKey=localMonthKey();
  const weeklyXp=(userData.weeklyXpKey===weekKey?Number(userData.weeklyXp)||0:0)+amount;
  const monthlyXp=(userData.monthlyXpKey===monthKey?Number(userData.monthlyXp)||0:0)+amount;
  const currentBadges=Array.isArray(userData.badges)?userData.badges:[];
  const earned=evaluateBadgesDelta(currentBadges,newXp,Number(userData.streakCurrent)||0);
  const patch={xp:newXp,level:newLevel,weeklyXp,monthlyXp,weeklyXpKey:weekKey,monthlyXpKey:monthKey};
  if(earned.length) patch.badges=[...currentBadges,...earned];
  await fsPatch(projectId,token,'users/'+uid,patch,Object.keys(patch));

  const entry={uid,name:userData.name||'User',photoURL:userData.photoURL||null,level:newLevel,xp:newXp,weeklyXp,monthlyXp,streakCurrent:Number(userData.streakCurrent)||0};
  await Promise.all([
    upsertLeaderboard(projectId,token,'global',entry,'xp'),
    upsertLeaderboard(projectId,token,'weekly_'+weekKey,entry,'weeklyXp'),
    upsertLeaderboard(projectId,token,'monthly_'+monthKey,entry,'monthlyXp'),
    upsertLeaderboard(projectId,token,'streak',entry,'streakCurrent')
  ]);
  return {ok:true,xp:newXp,level:newLevel,leveledUp:newLevel>levelFromXp(prevXp),awarded:amount,alreadyAwarded:false,badgesEarned:earned.map(id=>SYSTEM_BADGES.find(b=>b.id===id)||{id})};
}

async function handleBumpStreak(uid, env) {
  const projectId=env.FIREBASE_PROJECT_ID, token=await getAccessToken(env);
  const userData=await fsGet(projectId,token,'users/'+uid)||{};
  const today=localDateKey(),yesterday=yesterdayDateKey(),last=userData.streakLastDate||null;
  if(last===today) return {ok:true,streakCurrent:Number(userData.streakCurrent)||0,streakBest:Number(userData.streakBest)||0,alreadyCounted:true};
  const streakCurrent=last===yesterday?(Number(userData.streakCurrent)||0)+1:1;
  const streakBest=Math.max(Number(userData.streakBest)||0,streakCurrent);
  const currentBadges=Array.isArray(userData.badges)?userData.badges:[];
  const earned=evaluateBadgesDelta(currentBadges,Number(userData.xp)||0,streakCurrent);
  const patch={streakCurrent,streakBest,streakLastDate:today};
  if(earned.length) patch.badges=[...currentBadges,...earned];
  await fsPatch(projectId,token,'users/'+uid,patch,Object.keys(patch));
  const entry={uid,name:userData.name||'User',photoURL:userData.photoURL||null,level:Number(userData.level)||levelFromXp(userData.xp),xp:Number(userData.xp)||0,weeklyXp:Number(userData.weeklyXp)||0,monthlyXp:Number(userData.monthlyXp)||0,streakCurrent};
  await upsertLeaderboard(projectId,token,'streak',entry,'streakCurrent');
  return {ok:true,streakCurrent,streakBest,alreadyCounted:false,badgesEarned:earned.map(id=>SYSTEM_BADGES.find(b=>b.id===id)||{id})};
}

// ─── Request router ───────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      if (origin && !isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405, origin);
    }

    if (origin && !isAllowedOrigin(origin)) {
      return json({ error: 'Origin not allowed' }, 403, origin);
    }

    // Verify required secrets are present
    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_SA_CLIENT_EMAIL || !env.FIREBASE_SA_PRIVATE_KEY) {
      return json({ error: 'Server configuration incomplete' }, 500, origin);
    }

    // Verify Firebase ID token
    const authHeader = request.headers.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) {
      return json({ error: 'Authorization header required' }, 401, origin);
    }

    let tokenPayload;
    try {
      tokenPayload = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID, caches.default);
    } catch (err) {
      return json({ error: 'Unauthorized', detail: err.message }, 401, origin);
    }

    const uid = tokenPayload.sub;
    if (!uid) return json({ error: 'Invalid token: no uid' }, 401, origin);

    // Rate limit: ~10 requests/minute per UID
    const rateLimit = checkRateLimit(uid);
    if (!rateLimit.allowed) {
      return json({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter }, 429, origin);
    }

    // Reject oversized bodies before parsing.
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > 8192) {
      return json({ error: 'Request body too large' }, 413, origin);
    }

    // Parse body
    let body = {};
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: 'Invalid JSON body' }, 400, origin);
    }

    // Route
    const path = url.pathname.replace(/\/$/, '');
    try {
      let result;
      if (path === '/gamification/award-xp') result = await handleAwardXp(uid, body, env);
      else if (path === '/gamification/bump-streak') result = await handleBumpStreak(uid, env);
      else return json({ error: 'Unknown route' }, 404, origin);
      return json(result, 200, origin);
    } catch (err) {
      console.error(`[gamification] ${path} uid=${uid} error:`, err.message);
      return json({ error: err.message || 'Internal error' }, 500, origin);
    }
  }
};