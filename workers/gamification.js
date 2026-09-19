/**
 * Cloudflare Worker — Trio Day Gamification Backend
 *
 * Handles all server-side writes that are blocked from direct client access:
 *   POST /gamification/award-xp        — XP + level + leaderboard + badges
 *   POST /gamification/bump-streak     — streak fields
 *   POST /gamification/award-badges    — badge array on users/{uid}
 *   POST /gamification/counter         — communityTasks counter bumps
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
  { id: 'badge_first_complete', name: 'First Win',        icon: '🏅' },
  { id: 'badge_first_post',     name: 'Storyteller',      icon: '📝' },
  { id: 'badge_streak_3',       name: 'On Fire',          icon: '🔥' },
  { id: 'badge_streak_7',       name: 'Week Warrior',     icon: '⚔️' },
  { id: 'badge_streak_30',      name: 'Unstoppable',      icon: '🚀' },
  { id: 'badge_xp_500',         name: 'Rising Star',      icon: '⭐' },
  { id: 'badge_xp_1000',        name: 'Legend',           icon: '🏆' },
  { id: 'badge_engager',        name: 'Community Voice',  icon: '🗣️' }
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

const CATALOG_MEDIUM = new Set([
  'p2','p3','p4','p7','p8','p9','p10','p11',
  'b3','b4','b6','b7','b8','b10','b12',
  'l2','l4','l5','l8','l9','l10','l11',
  'c2','c4','c5','c6','c9','c10',
  'g6','g8','g10','g11'
]);
const CATALOG_HARD = new Set(['p12','b11']);

function catalogXp(activityId) {
  const id = String(activityId || '').trim().toLowerCase();
  if (!/^[pblcg]\\d+$/.test(id)) return 0;
  if (CATALOG_HARD.has(id)) return 60;
  if (CATALOG_MEDIUM.has(id)) return 40;
  return 25;
}

function catalogCycleDays(activityId) {
  const cycles = {
    p1:14,p2:21,p3:14,p4:30,p5:14,p6:14,p7:21,p8:30,p9:30,p10:21,p11:14,p12:40,
    b1:21,b2:14,b3:21,b4:30,b5:21,b6:30,b7:30,b8:21,b9:14,b10:21,b11:30,b12:21,
    l1:30,l2:21,l3:21,l4:30,l5:30,l6:21,l7:30,l8:30,l9:21,l10:40,l11:40,l12:14,
    c1:14,c2:21,c3:14,c4:30,c5:21,c6:30,c7:14,c8:21,c9:21,c10:30,c11:14,c12:21,
    g1:14,g2:14,g3:21,g4:14,g5:14,g6:21,g7:14,g8:21,g9:14,g10:21,g11:14,g12:21
  };
  return cycles[String(activityId || '').trim().toLowerCase()] || 21;
}

function catalogCycleKey(activityId, nowMs) {
  const days = catalogCycleDays(activityId);
  const epoch = Date.UTC(2026, 0, 1);
  const index = Math.max(0, Math.floor((nowMs - epoch) / (days * 86400000)));
  return activityId + '_' + String(epoch + index * days * 86400000);
}

async function fsCreateDoc(projectId, accessToken, path, data) {
  const slash = path.lastIndexOf('/');
  const parent = path.slice(0, slash);
  const documentId = path.slice(slash + 1);
  const url = firestoreBase(projectId) + '/' + parent + '?documentId=' + encodeURIComponent(documentId);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) })
  });
  if (res.status === 409) return false;
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Firestore CREATE ' + path + ' failed: ' + res.status + ' ' + txt);
  }
  return true;
}

// ─── Firebase ID token verification ──────────────────────────────────────────

/**
 * Decode a base64url-encoded string to a Uint8Array.
 */
function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (b64.length % 4)) % 4;
  const padded = b64 + '='.repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Fetch and cache Firebase public keys. Returns a Map<kid, CryptoKey>.
 * Keys are cached for 1 hour (Cache API).
 */
async function getFirebasePublicKeys(cacheStorage) {
  const cacheKey = 'https://firebase-pubkeys.internal/v1';
  let certMap = null;

  // Cache the raw Google certificate map, not CryptoKey objects (CryptoKey is not JSON-serializable).
  try {
    const cached = await cacheStorage.match(cacheKey);
    if (cached) certMap = await cached.json();
  } catch (_) { /* ignore corrupt cache */ }

  if (!certMap || typeof certMap !== 'object') {
    const res = await fetch(FIREBASE_PUBLIC_KEYS_URL);
    if (!res.ok) throw new Error(`Firebase public key fetch failed: ${res.status}`);
    certMap = await res.json();
    try {
      await cacheStorage.put(
        cacheKey,
        new Response(JSON.stringify(certMap), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
        })
      );
    } catch (_) { /* cache is optional */ }
  }

  // Convert PEM certs to CryptoKey objects for signature verification.
  const result = {};
  for (const [kid, pem] of Object.entries(certMap)) {
    try {
      // Extract the base64 DER from PEM certificate
      const pemBody = pem
        .replace('-----BEGIN CERTIFICATE-----', '')
        .replace('-----END CERTIFICATE-----', '')
        .replace(/\s/g, '');
      const derBytes = b64urlDecode(pemBody);
      // Import as a certificate (X.509 SubjectPublicKeyInfo extraction via importKey)
      const cryptoKey = await crypto.subtle.importKey(
        'spki',
        // We need to extract the public key from the certificate DER
        // Use a workaround: parse the certificate to get the public key
        extractPublicKeyFromCert(derBytes),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      result[kid] = cryptoKey;
    } catch (_) { /* skip invalid keys */ }
  }
  return result;
}

/**
 * Extract SubjectPublicKeyInfo from an X.509 DER certificate.
 * This is a minimal DER parser — handles the standard Firebase cert structure.
 */
function extractPublicKeyFromCert(derBytes) {
  // Walk the DER: SEQUENCE { ... TBSCertificate { ... SubjectPublicKeyInfo } ... }
  // TBSCertificate is the first element of the outer SEQUENCE
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
    const { next: afterTag } = readTag(buf, off); // skip tag
    const { next: afterLen } = readLength(buf, afterTag); // skip length
    return afterLen;
  }

  // Outer SEQUENCE
  offset = enterSequence(derBytes, offset);
  // TBSCertificate SEQUENCE — enter it
  offset = enterSequence(derBytes, offset);
  // version [0] EXPLICIT INTEGER — skip if present (tag 0xa0)
  if (derBytes[offset] === 0xa0) offset = skipField(derBytes, offset);
  // serialNumber INTEGER — skip
  offset = skipField(derBytes, offset);
  // signature AlgorithmIdentifier — skip
  offset = skipField(derBytes, offset);
  // issuer Name — skip
  offset = skipField(derBytes, offset);
  // validity Validity — skip
  offset = skipField(derBytes, offset);
  // subject Name — skip
  offset = skipField(derBytes, offset);
  // subjectPublicKeyInfo — this is what we need, return it as a slice
  const { next: afterTag } = readTag(derBytes, offset);
  const { len, next: afterLen } = readLength(derBytes, afterTag);
  const end = afterLen + len;
  return derBytes.slice(offset, end).buffer;
}

/**
 * Verify a Firebase ID token. Returns the payload object or throws.
 */
async function verifyFirebaseIdToken(token, projectId) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch (_) {
    throw new Error('Token decode failed');
  }

  if (header.alg !== 'RS256') throw new Error('Unsupported algorithm');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now)       throw new Error('Token expired');
  if (payload.iat > now + 60)   throw new Error('Token issued in future');
  if (payload.aud !== projectId) throw new Error('Token audience mismatch');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw new Error('Token issuer mismatch');
  if (!payload.sub)             throw new Error('Missing subject');

  // Fetch public keys and verify signature
  const keys = await getFirebasePublicKeys(caches.default);
  const publicKey = keys[header.kid];
  if (!publicKey) throw new Error('Unknown key id');

  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = b64urlDecode(parts[2]);

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signature,
    signingInput
  );
  if (!valid) throw new Error('Token signature invalid');

  return payload;
}

// ─── Service account / Firestore access token ────────────────────────────────

/**
 * Create a signed JWT for the service account (for OAuth2 token exchange).
 */
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

/**
 * Exchange a service account JWT for an OAuth2 access token.
 * Result is cached in the Worker's global scope for reuse within the same request.
 */
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

// ─── Firestore REST helpers ───────────────────────────────────────────────────

function firestoreBase(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

/**
 * Convert a plain JS object to a Firestore REST "fields" map.
 * Handles: string, number, boolean, null, array, object.
 */
function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean')        return { booleanValue: v };
  if (typeof v === 'number')         return { integerValue: String(Math.round(v)) };
  if (typeof v === 'string')         return { stringValue: v };
  if (Array.isArray(v))              return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object')         return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}

/**
 * Convert Firestore REST "fields" map back to a plain JS object.
 */
function fromFirestoreFields(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = fromFirestoreValue(v);
  }
  return obj;
}

function fromFirestoreValue(v) {
  if ('nullValue'    in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue'  in v) return Number(v.doubleValue);
  if ('stringValue'  in v) return v.stringValue;
  if ('arrayValue'   in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue'     in v) return fromFirestoreFields(v.mapValue.fields || {});
  if ('timestampValue' in v) return v.timestampValue;
  return null;
}

/**
 * GET a Firestore document. Returns plain JS object or null if not found.
 */
async function fsGet(projectId, accessToken, path) {
  const url = `${firestoreBase(projectId)}/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET ${path} failed: ${res.status}`);
  const doc = await res.json();
  return doc.fields ? fromFirestoreFields(doc.fields) : {};
}

/**
 * PATCH (merge) a Firestore document with specific fields.
 * updateMask is an array of top-level field names.
 */
async function fsPatch(projectId, accessToken, path, data, updateMask) {
  const maskParams = updateMask.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${firestoreBase(projectId)}/${path}?${maskParams}`;
  const body = { fields: toFirestoreFields(data) };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Firestore PATCH ${path} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

/**
 * Firestore REST transaction: beginTransaction → read board doc → commit with update.
 * Used for leaderboard upserts to prevent races.
 */
async function fsTransactionUpdateLeaderboard(projectId, accessToken, boardId, uid, verified, valueKey) {
  const base = firestoreBase(projectId);
  const docPath = `projects/${projectId}/databases/(default)/documents/leaderboards/${boardId}`;

  // Begin transaction
  const beginRes = await fetch(`${base.replace('/documents', '')}:beginTransaction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ options: { readWrite: {} } })
  });
  if (!beginRes.ok) throw new Error(`beginTransaction failed: ${beginRes.status}`);
  const { transaction } = await beginRes.json();

  // Read existing board inside transaction
  const readRes = await fetch(`${base}/leaderboards/${boardId}?transaction=${encodeURIComponent(transaction)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  let existingEntries = [];
  if (readRes.ok) {
    const readDoc = await readRes.json();
    if (readDoc.fields?.entries?.arrayValue?.values) {
      existingEntries = readDoc.fields.entries.arrayValue.values.map(fromFirestoreValue);
    }
  }

  // Upsert entry in sorted list
  const newValue = Number(verified[valueKey]) || 0;
  const idx = existingEntries.findIndex(e => e.uid === uid);
  const newRow = {
    uid,
    name:      verified.name      || 'User',
    photoURL:  verified.photoURL  || null,
    value:     newValue,
    level:     Number(verified.level) || 1
  };
  if (idx >= 0) {
    existingEntries[idx] = { ...existingEntries[idx], ...newRow };
  } else {
    existingEntries.push(newRow);
  }
  existingEntries.sort((a, b) => (b.value || 0) - (a.value || 0));
  existingEntries = existingEntries.slice(0, LEADERBOARD_TOP_N);

  // Commit
  const writes = [{
    update: {
      name: docPath,
      fields: toFirestoreFields({ updatedAtMs: Date.now(), entries: existingEntries })
    },
    updateMask: { fieldPaths: ['updatedAtMs', 'entries'] },
    currentDocument: {} // allow create
  }];

  const commitRes = await fetch(`${base.replace('/documents', '')}:commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ writes, transaction })
  });
  if (!commitRes.ok) {
    const txt = await commitRes.text();
    throw new Error(`Leaderboard commit failed for ${boardId}: ${txt}`);
  }
}

/**
 * Atomic increment of a single integer field using Firestore field transforms.
 */
async function fsAtomicIncrement(projectId, accessToken, docPath, field, delta) {
  const base = firestoreBase(projectId);
  const fullName = `projects/${projectId}/databases/(default)/documents/${docPath}`;
  const body = {
    writes: [{
      transform: {
        document: fullName,
        fieldTransforms: [{
          fieldPath: field,
          increment: { integerValue: String(delta) }
        }]
      }
    }]
  };
  const res = await fetch(`${base.replace('/documents', '')}:commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Atomic increment ${docPath}.${field} failed: ${txt}`);
  }
}

// ─── Core gamification logic ──────────────────────────────────────────────────

/**
 * Evaluate which badges the user has newly earned given their current stats.
 * Returns array of newly earned badge objects.
 */
function evaluateBadgesDelta(currentBadges, xp, streakCurrent, extraTemplateId) {
  const existing = new Set((currentBadges || []).map(b => b.id));
  const checks = [
    { id: 'badge_first_complete', ok: xp > 0 },
    { id: 'badge_streak_3',       ok: streakCurrent >= 3 },
    { id: 'badge_streak_7',       ok: streakCurrent >= 7 },
    { id: 'badge_streak_30',      ok: streakCurrent >= 30 },
    { id: 'badge_xp_500',         ok: xp >= 500 },
    { id: 'badge_xp_1000',        ok: xp >= 1000 }
  ];
  const templateMap = {
    sys_post:            'badge_first_post',
    sys_monthly_engage:  'badge_engager'
  };
  if (extraTemplateId && templateMap[extraTemplateId]) {
    checks.push({ id: templateMap[extraTemplateId], ok: true });
  }

  const earned = [];
  for (const c of checks) {
    if (!c.ok || existing.has(c.id)) continue;
    const meta = SYSTEM_BADGES.find(b => b.id === c.id) || { id: c.id, name: c.id, icon: '🏅' };
    earned.push({ id: c.id, atMs: Date.now(), name: meta.name, icon: meta.icon });
  }
  return earned;
}

/**
 * Award XP to uid. Reads authoritative user doc, computes new values,
 * writes user doc, updates all leaderboards, evaluates badges.
 */
async function handleAwardXp(uid, body, env) {
  const meta = body?.meta || {};
  const communityTaskId = String(meta.communityTaskId || '').trim();
  const catalogActivityId = String(meta.catalogActivityId || '').trim().toLowerCase();
  if (!communityTaskId && !catalogActivityId) throw new Error('activity context required');

  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);
  const now = Date.now();
  let amount = 0;
  let grantKey = '';

  if (communityTaskId) {
    const task = await fsGet(projectId, token, 'communityTasks/' + communityTaskId);
    if (!task || task.status !== 'active') throw new Error('Community activity is not active');
    const completion = await fsGet(projectId, token, 'communityTasks/' + communityTaskId + '/completions/' + uid);
    if (!completion) throw new Error('Completion record not found');
    amount = Math.max(1, Math.min(MAX_XP_AWARD, Math.round(Number(task.xpReward) || 50)));
    grantKey = 'community_' + communityTaskId;
  } else {
    amount = catalogXp(catalogActivityId);
    if (!amount) throw new Error('Unknown catalog activity');
    const expectedKey = catalogCycleKey(catalogActivityId, now);
    const completionKey = String(meta.catalogCycleKey || '');
    if (completionKey !== expectedKey) throw new Error('Invalid catalog cycle');
    const completion = await fsGet(projectId, token, 'users/' + uid + '/activityCompletions/' + completionKey);
    if (!completion || completion.activityId !== catalogActivityId) throw new Error('Completion record not found');
    grantKey = 'catalog_' + expectedKey;
  }

  const grantPath = 'users/' + uid + '/xpAwards/' + grantKey.replace(/[^A-Za-z0-9_-]/g, '_');
  const created = await fsCreateDoc(projectId, token, grantPath, { uid, grantKey, amount, createdAtMs: now });
  if (!created) {
    const current = await fsGet(projectId, token, 'users/' + uid) || {};
    return {
      ok: true,
      xp: Number(current.xp) || 0,
      level: Number(current.level) || 1,
      leveledUp: false,
      awarded: 0,
      alreadyAwarded: true,
      badgesEarned: []
    };
  }

  const userData = await fsGet(projectId, token, 'users/' + uid) || {};
  const weekKey = localWeekKey();
  const monthKey = localMonthKey();
  const prevXp = Number(userData.xp) || 0;
  const newXp = prevXp + amount;
  const newLevel = levelFromXp(newXp);

  let weeklyXp = Number(userData.weeklyXp) || 0;
  let monthlyXp = Number(userData.monthlyXp) || 0;
  if (userData.weeklyXpKey !== weekKey) weeklyXp = 0;
  if (userData.monthlyXpKey !== monthKey) monthlyXp = 0;
  weeklyXp += amount;
  monthlyXp += amount;

  await fsPatch(projectId, token, 'users/' + uid,
    { xp:newXp, level:newLevel, weeklyXp, monthlyXp, weeklyXpKey:weekKey, monthlyXpKey:monthKey },
    ['xp','level','weeklyXp','monthlyXp','weeklyXpKey','monthlyXpKey']);

  const verified = {
    uid,
    name: userData.name || 'User',
    photoURL: userData.photoURL || null,
    level: newLevel,
    xp: newXp,
    weeklyXp,
    monthlyXp,
    streakCurrent: Number(userData.streakCurrent) || 0
  };
  const boards = [
    { id:'global', key:'xp' },
    { id:'weekly_' + weekKey, key:'weeklyXp' },
    { id:'monthly_' + monthKey, key:'monthlyXp' },
    { id:'streak', key:'streakCurrent' }
  ];
  await Promise.allSettled(boards.map(b =>
    fsTransactionUpdateLeaderboard(projectId, token, b.id, uid, verified, b.key)
  ));

  const currentBadges = Array.isArray(userData.badges) ? userData.badges : [];
  const earned = evaluateBadgesDelta(currentBadges, newXp, Number(userData.streakCurrent) || 0, meta.templateId);
  if (earned.length) {
    await fsPatch(projectId, token, 'users/' + uid, { badges:[...currentBadges, ...earned] }, ['badges']);
  }

  return { ok:true, xp:newXp, level:newLevel, leveledUp:newLevel > levelFromXp(prevXp), awarded:amount, badgesEarned:earned };
}

/**
 * Bump streak for uid (idempotent per day).
 */
async function handleBumpStreak(uid, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);

  const userData = await fsGet(projectId, token, `users/${uid}`) || {};
  const today     = localDateKey();
  const yesterday = yesterdayDateKey();
  const last      = userData.streakLastDate || null;

  // Idempotent — already bumped today
  if (last === today) {
    return {
      ok:             true,
      streakCurrent:  Number(userData.streakCurrent) || 0,
      streakBest:     Number(userData.streakBest)    || 0,
      alreadyCounted: true
    };
  }

  let streakCurrent = 1;
  if (last === yesterday) {
    streakCurrent = (Number(userData.streakCurrent) || 0) + 1;
  }
  const streakBest = Math.max(Number(userData.streakBest) || 0, streakCurrent);

  await fsPatch(projectId, token, `users/${uid}`,
    { streakCurrent, streakBest, streakLastDate: today },
    ['streakCurrent', 'streakBest', 'streakLastDate']
  );

  // Update streak leaderboard
  const verified = {
    uid,
    name:          userData.name     || 'User',
    photoURL:      userData.photoURL || null,
    level:         Number(userData.level) || 1,
    xp:            Number(userData.xp)    || 0,
    weeklyXp:      Number(userData.weeklyXp)   || 0,
    monthlyXp:     Number(userData.monthlyXp)  || 0,
    streakCurrent
  };
  await fsTransactionUpdateLeaderboard(projectId, token, 'streak', uid, verified, 'streakCurrent')
    .catch(() => { /* best-effort */ });

  // Evaluate streak badges
  const currentBadges = Array.isArray(userData.badges) ? userData.badges : [];
  const earned = evaluateBadgesDelta(currentBadges, Number(userData.xp) || 0, streakCurrent, null);
  if (earned.length > 0) {
    const newBadges = [...currentBadges, ...earned];
    await fsPatch(projectId, token, `users/${uid}`, { badges: newBadges }, ['badges'])
      .catch(() => { /* best-effort */ });
  }

  return { ok: true, streakCurrent, streakBest, alreadyCounted: false, badgesEarned: earned };
}

/**
 * Award specific badges to uid (e.g. first_post triggered by template completion).
 */
async function handleAwardBadges(uid, body, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);

  const userData = await fsGet(projectId, token, `users/${uid}`) || {};
  const currentBadges = Array.isArray(userData.badges) ? userData.badges : [];
  const earned = evaluateBadgesDelta(
    currentBadges,
    Number(userData.xp) || 0,
    Number(userData.streakCurrent) || 0,
    body.templateId || null
  );

  if (earned.length > 0) {
    const newBadges = [...currentBadges, ...earned];
    await fsPatch(projectId, token, `users/${uid}`, { badges: newBadges }, ['badges']);
  }

  return { ok: true, badgesEarned: earned };
}

/**
 * Bump a counter field on a communityTasks document.
 * action: 'join'|'leave'|'like'|'unlike'|'comment'|'complete'
 */
async function handleCounter(uid, body, env) {
  const taskId = String(body?.taskId || '').trim();
  const action = String(body?.action || '').trim();
  const eventId = String(body?.eventId || '').trim();
  if (!taskId) throw new Error('taskId required');
  if (!eventId) throw new Error('eventId required');

  const validActions = ['join','leave','like','unlike','comment','complete'];
  if (!validActions.includes(action)) throw new Error('Invalid action: ' + action);

  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);
  const eventKey = action === 'unlike' ? 'like_' + uid + '_' + eventId :
                   action === 'leave' ? 'join_' + uid + '_' + eventId :
                   action + '_' + uid + '_' + eventId;
  const eventPath = 'communityTasks/' + taskId + '/counterEvents/' + eventKey.replace(/[^A-Za-z0-9_-]/g, '_');

  let verified = false;
  if (action === 'join') {
    const member = await fsGet(projectId, token, 'communityTasks/' + taskId + '/members/' + uid);
    verified = !!member && String(member.joinedAtMs) === eventId;
  } else if (action === 'like') {
    const like = await fsGet(projectId, token, 'communityTasks/' + taskId + '/likes/' + uid);
    verified = !!like && String(like.atMs) === eventId;
  } else if (action === 'comment') {
    const comment = await fsGet(projectId, token, 'communityTasks/' + taskId + '/comments/' + eventId);
    verified = !!comment && comment.uid === uid;
  } else if (action === 'complete') {
    const completion = await fsGet(projectId, token, 'communityTasks/' + taskId + '/completions/' + uid);
    verified = !!completion && String(completion.atMs) === eventId;
  } else {
    const previous = await fsGet(projectId, token, eventPath);
    verified = !!previous && previous.uid === uid;
  }

  if (!verified) throw new Error('Counter event could not be verified');

  if (action === 'unlike' || action === 'leave') {
    await fsDelete(projectId, token, eventPath);
    await fsAtomicIncrement(
      projectId,
      token,
      'communityTasks/' + taskId,
      action === 'unlike' ? 'likes' : 'joins',
      -1
    );
    return { ok:true, taskId, action, eventId, delta:-1 };
  }

  const created = await fsCreateDoc(projectId, token, eventPath, {
    uid, action, eventId, createdAtMs: Date.now()
  });
  if (!created) {
    return { ok:true, taskId, action, eventId, delta:0, alreadyCounted:true };
  }

  const fieldMap = {
    join:'joins', like:'likes', comment:'comments', complete:'completions'
  };
  await fsAtomicIncrement(projectId, token, 'communityTasks/' + taskId, fieldMap[action], 1);
  return { ok:true, taskId, action, eventId, delta:1 };
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
      tokenPayload = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
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
      if (path === '/gamification/award-xp') {
        result = await handleAwardXp(uid, body, env);
      } else if (path === '/gamification/bump-streak') {
        result = await handleBumpStreak(uid, env);
      } else if (path === '/gamification/award-badges') {
        result = await handleAwardBadges(uid, body, env);
      } else if (path === '/gamification/counter') {
        result = await handleCounter(uid, body, env);
      } else {
        return json({ error: 'Unknown route' }, 404, origin);
      }
      return json(result, 200, origin);
    } catch (err) {
      console.error(`[gamification] ${path} uid=${uid} error:`, err.message);
      return json({ error: err.message || 'Internal error' }, 500, origin);
    }
  }
};