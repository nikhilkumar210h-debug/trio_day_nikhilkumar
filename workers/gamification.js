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

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || '').trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
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
  // Try cache first
  try {
    const cached = await cacheStorage.match(cacheKey);
    if (cached) {
      const keys = await cached.json();
      return keys;
    }
  } catch (_) { /* ignore */ }

  const res = await fetch(FIREBASE_PUBLIC_KEYS_URL);
  const certMap = await res.json(); // { kid: "-----BEGIN CERTIFICATE-----..." }
  // Convert PEM certs to CryptoKey objects
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
 * List documents from a Firestore collection/subcollection.
 */
async function fsListDocs(projectId, accessToken, path, pageSize = 100) {
  const url = `${firestoreBase(projectId)}/${path}?pageSize=${Math.min(200, Math.max(1, pageSize))}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Firestore LIST ${path} failed: ${res.status}`);
  const data = await res.json();
  return (data.documents || []).map(doc => ({
    name: doc.name,
    id: doc.name.split('/').pop(),
    ...fromFirestoreFields(doc.fields)
  }));
}

async function fsDelete(projectId, accessToken, path) {
  const url = `${firestoreBase(projectId)}/${path}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Firestore DELETE ${path} failed: ${res.status}`);
  return true;
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
  const amount = Math.max(0, Math.min(MAX_XP_AWARD, Math.round(Number(body.amount) || 0)));
  if (amount <= 0) throw new Error('amount must be 1–500');

  const meta = body.meta || {};
  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);

  // Read authoritative user doc
  const userData = await fsGet(projectId, token, `users/${uid}`) || {};

  const weekKey   = localWeekKey();
  const monthKey  = localMonthKey();
  const prevXp    = Number(userData.xp) || 0;
  const newXp     = prevXp + amount;
  const newLevel  = levelFromXp(newXp);

  let weeklyXp   = Number(userData.weeklyXp)   || 0;
  let monthlyXp  = Number(userData.monthlyXp)  || 0;
  if (userData.weeklyXpKey  !== weekKey)  weeklyXp  = 0;
  if (userData.monthlyXpKey !== monthKey) monthlyXp = 0;
  weeklyXp  += amount;
  monthlyXp += amount;

  const patch = {
    xp:           newXp,
    level:        newLevel,
    weeklyXp,
    monthlyXp,
    weeklyXpKey:  weekKey,
    monthlyXpKey: monthKey
  };

  await fsPatch(projectId, token, `users/${uid}`, patch,
    ['xp', 'level', 'weeklyXp', 'monthlyXp', 'weeklyXpKey', 'monthlyXpKey']);

  // Build verified row for leaderboard
  const verified = {
    uid,
    name:           userData.name      || 'User',
    photoURL:       userData.photoURL  || null,
    level:          newLevel,
    xp:             newXp,
    weeklyXp,
    monthlyXp,
    streakCurrent:  Number(userData.streakCurrent) || 0
  };

  // Update all 4 leaderboards (best-effort, non-blocking failures tolerated)
  const boards = [
    { id: 'global',                         key: 'xp' },
    { id: `weekly_${weekKey}`,              key: 'weeklyXp' },
    { id: `monthly_${monthKey}`,            key: 'monthlyXp' },
    { id: 'streak',                         key: 'streakCurrent' }
  ];
  await Promise.allSettled(boards.map(b =>
    fsTransactionUpdateLeaderboard(projectId, token, b.id, uid, verified, b.key)
  ));

  // Evaluate badges
  const currentBadges = Array.isArray(userData.badges) ? userData.badges : [];
  const streakCurrent = Number(userData.streakCurrent) || 0;
  const earned = evaluateBadgesDelta(currentBadges, newXp, streakCurrent, meta.templateId);

  if (earned.length > 0) {
    const newBadges = [...currentBadges, ...earned];
    await fsPatch(projectId, token, `users/${uid}`, { badges: newBadges }, ['badges']);
  }

  return {
    ok: true,
    xp:          newXp,
    level:       newLevel,
    leveledUp:   newLevel > levelFromXp(prevXp),
    awarded:     amount,
    badgesEarned: earned
  };
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

function normalizeCaseText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\\s+/g, ' ');
}

function normalizeCaseIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(v => String(v ?? '').trim()).filter(Boolean))].sort();
}

function cleanCaseArray(value, maxItems, mapper) {
  return (Array.isArray(value) ? value : []).slice(0, maxItems).map(mapper);
}

/**
 * Create a mystery case with public investigation data and a server-only solution.
 * The solution is deliberately stored outside the readable communityTasks document.
 */
async function handleCreateMystery(uid, body, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);

  const title = String(body.title || '').trim().slice(0, 100);
  const category = ['Logic','Observation','Speed','Reasoning','Memory','Decision','Knowledge'].includes(body.category)
    ? body.category : 'Reasoning';
  const difficulty = ['Easy','Medium','Hard'].includes(body.difficulty)
    ? body.difficulty : 'Medium';
  const durationMinutes = Math.max(5, Math.min(180, Number(body.durationMinutes) || 30));
  const xpReward = Math.max(10, Math.min(500, Number(body.xpReward) || 100));
  const startAtMs = Number(body.startAtMs) || Date.now();
  const endAtMs = Number(body.endAtMs) || (startAtMs + 7 * 86400000);

  const rawCase = body.caseData && typeof body.caseData === 'object' ? body.caseData : {};
  const rawSolution = body.solution && typeof body.solution === 'object' ? body.solution : {};

  if (!title) throw new Error('Challenge title required');
  if (!(endAtMs > startAtMs)) throw new Error('Invalid challenge duration');

  const suspects = cleanCaseArray(rawCase.suspects, 8, (s, i) => ({
    id: String(s?.id || `suspect_${i + 1}`).trim().slice(0, 40),
    name: String(s?.name || '').trim().slice(0, 80),
    role: String(s?.role || '').trim().slice(0, 100),
    alibi: String(s?.alibi || '').trim().slice(0, 500),
    description: String(s?.description || '').trim().slice(0, 800)
  }));

  const clues = cleanCaseArray(rawCase.clues, 24, (clue, i) => ({
    id: String(clue?.id || `clue_${i + 1}`).trim().slice(0, 40),
    title: String(clue?.title || `Evidence ${i + 1}`).trim().slice(0, 120),
    type: ['text','document','image','map'].includes(clue?.type) ? clue.type : 'text',
    content: String(clue?.content || '').trim().slice(0, 3000),
    mediaUrl: String(clue?.mediaUrl || '').trim().slice(0, 1000)
  }));

  const timeline = cleanCaseArray(rawCase.timeline, 24, (event, i) => ({
    id: String(event?.id || `event_${i + 1}`).trim().slice(0, 40),
    time: String(event?.time || '').trim().slice(0, 80),
    event: String(event?.event || '').trim().slice(0, 500)
  }));

  const hints = cleanCaseArray(rawCase.hints, 6, (hint, i) => ({
    id: String(hint?.id || `hint_${i + 1}`).trim().slice(0, 40),
    text: String(hint?.text || '').trim().slice(0, 600)
  })).filter(h => h.text);

  const caseData = {
    synopsis: String(rawCase.synopsis || '').trim().slice(0, 900),
    briefing: String(rawCase.briefing || '').trim().slice(0, 1800),
    estimatedTime: Math.max(5, Math.min(180, Number(rawCase.estimatedTime) || durationMinutes)),
    suspects,
    clues,
    timeline,
    hints,
    finalPrompt: String(rawCase.finalPrompt || 'Who is responsible, why did they do it, and which evidence proves your deduction?').trim().slice(0, 500)
  };

  if (caseData.briefing.length < 20) throw new Error('Mystery briefing is too short');
  if (suspects.length < 2) throw new Error('Add at least 2 suspects');
  if (clues.length < 3) throw new Error('Add at least 3 clues');
  if (timeline.length < 2) throw new Error('Add at least 2 timeline events');

  const suspectIds = new Set(suspects.map(s => s.id));
  const clueIds = new Set(clues.map(clue => clue.id));
  if (suspectIds.size !== suspects.length) throw new Error('Suspect ids must be unique');
  if (clueIds.size !== clues.length) throw new Error('Clue ids must be unique');

  const suspectId = String(rawSolution.suspectId || '').trim();
  const motive = String(rawSolution.motive || '').trim().slice(0, 300);
  const motiveVariants = cleanCaseArray(rawSolution.motiveVariants, 8, v => String(v || '').trim().slice(0, 300))
    .filter(Boolean);
  const keyEvidenceIds = normalizeCaseIds(rawSolution.keyEvidenceIds);

  if (!suspectIds.has(suspectId)) throw new Error('Solution suspectId must match a suspect');
  if (motive.length < 3) throw new Error('Solution motive is required');
  if (!keyEvidenceIds.length) throw new Error('Select at least one key evidence item');
  if (keyEvidenceIds.some(id => !clueIds.has(id))) throw new Error('Solution evidence contains an unknown clue');

  const taskId = crypto.randomUUID();
  const now = Date.now();
  const taskPath = `communityTasks/${taskId}`;
  const verificationPath = `${taskPath}/verification/private`;

  await fsPatch(projectId, token, taskPath, {
    title,
    description: caseData.synopsis,
    objective: caseData.synopsis || caseData.finalPrompt,
    icon: '🕵️',
    kind: 'challenge',
    category,
    difficulty,
    durationMinutes,
    xpReward,
    challengeType: 'mystery',
    caseVersion: 1,
    caseData,
    metric: 'case_solution',
    target: 1,
    creatorUid: uid,
    creatorName: String(body.creatorName || 'User').slice(0, 50),
    creatorPhoto: body.creatorPhoto || null,
    startAtMs,
    endAtMs,
    status: 'active',
    featured: false,
    hidden: false,
    joins: 0,
    solvingNow: 0,
    ratingAverage: 0,
    ratingCount: 0,
    likes: 0,
    comments: 0,
    completions: 0,
    createdAtMs: now
  }, [
    'title','description','objective','icon','kind','category','difficulty',
    'durationMinutes','xpReward','challengeType','caseVersion','caseData',
    'metric','target','creatorUid','creatorName','creatorPhoto','startAtMs',
    'endAtMs','status','featured','hidden','joins','solvingNow','ratingAverage',
    'ratingCount','likes','comments','completions','createdAtMs'
  ]);

  await fsPatch(projectId, token, verificationPath, {
    type: 'mystery-v1',
    suspectId,
    motive,
    motiveNormalized: normalizeCaseText(motive),
    motiveVariants,
    motiveVariantsNormalized: [motive, ...motiveVariants].map(normalizeCaseText).filter(Boolean),
    keyEvidenceIds,
    createdAtMs: now
  }, ['type','suspectId','motive','motiveNormalized','motiveVariants','motiveVariantsNormalized','keyEvidenceIds','createdAtMs']);

  return { ok: true, taskId, challengeType: 'mystery' };
}

/**
 * Verify and finalize a challenge. The client never writes completions directly.
 */
async function handleCompleteChallenge(uid, body, env) {
  const taskId = String(body.taskId || '').trim();
  if (!taskId) throw new Error('taskId required');

  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);
  const task = await fsGet(projectId, token, `communityTasks/${taskId}`);
  if (!task) throw new Error('Challenge not found');
  if (task.endAtMs && Number(task.endAtMs) < Date.now()) throw new Error('Challenge expired');
  if (task.creatorUid === uid) throw new Error('Creators cannot complete their own challenge');

  const member = await fsGet(projectId, token, `communityTasks/${taskId}/members/${uid}`);
  if (!member) throw new Error('Accept the challenge first');

  const completionPath = `communityTasks/${taskId}/completions/${uid}`;
  const existing = await fsGet(projectId, token, completionPath);
  if (existing) return { ok: true, already: true };

  if (task.challengeType === 'mystery') {
    const privateVerification = await fsGet(projectId, token, `communityTasks/${taskId}/verification/private`);
    if (!privateVerification || privateVerification.type !== 'mystery-v1') {
      throw new Error('Mystery verification is not configured');
    }

    const submitted = body.caseSolution && typeof body.caseSolution === 'object' ? body.caseSolution : {};
    const submittedSuspectId = String(submitted.suspectId || '').trim();
    const submittedMotive = normalizeCaseText(submitted.motive);
    const submittedEvidence = normalizeCaseIds(submitted.keyEvidenceIds);

    const suspectCorrect = submittedSuspectId === String(privateVerification.suspectId || '');
    const acceptedMotives = Array.isArray(privateVerification.motiveVariantsNormalized)
      ? privateVerification.motiveVariantsNormalized
      : [String(privateVerification.motiveNormalized || '')];
    const motiveCorrect = acceptedMotives.includes(submittedMotive);
    const expectedEvidence = normalizeCaseIds(privateVerification.keyEvidenceIds);
    const evidenceCorrect =
      submittedEvidence.length === expectedEvidence.length &&
      submittedEvidence.every((id, index) => id === expectedEvidence[index]);

    if (!suspectCorrect || !motiveCorrect || !evidenceCorrect) {
      return {
        ok: false,
        correct: false,
        breakdown: { suspectCorrect, motiveCorrect, evidenceCorrect },
        message: 'Your deduction is incomplete. Re-check the evidence and try again.'
      };
    }

    await fsPatch(projectId, token, completionPath, {
      uid,
      atMs: Date.now(),
      verification: 'mystery',
      caseVersion: Number(task.caseVersion) || 1
    }, ['uid','atMs','verification','caseVersion']);

    await fsAtomicIncrement(projectId, token, `communityTasks/${taskId}`, 'completions', 1);
    const xp = Number(task.xpReward) || 100;
    const award = await handleAwardXp(uid, {
      amount: xp,
      meta: { communityTaskId: taskId, templateId: task.templateId }
    }, env);

    return { ok: true, already: false, verified: true, award };
  }

  const verificationType = task.verificationType === 'answer' ? 'answer' : 'proof';

  if (verificationType === 'answer') {
    const answer = String(body.answer || '').trim();
    if (!answer) throw new Error('Answer required');
    const expectedHash = String(task.answerHash || '');
    if (!expectedHash) throw new Error('This challenge has no configured answer');
    const actualHash = await sha256Hex(answer);
    if (actualHash !== expectedHash) {
      return { ok: false, correct: false, message: 'Not correct yet. Check the challenge and try again.' };
    }
    await fsPatch(projectId, token, completionPath, { uid, atMs: Date.now(), verification: 'answer' }, ['uid', 'atMs', 'verification']);
    await fsAtomicIncrement(projectId, token, `communityTasks/${taskId}`, 'completions', 1);
    const xp = Number(task.xpReward) || 50;
    const award = await handleAwardXp(uid, { amount: xp, meta: { communityTaskId: taskId, templateId: task.templateId } }, env);
    return { ok: true, already: false, verified: true, award };
  }

  const submissionId = String(body.submissionId || uid).trim();
  const submission = await fsGet(projectId, token, `communityTasks/${taskId}/submissions/${submissionId}`);
  if (!submission || submission.uid !== uid) throw new Error('Proof submission not found');
  if (submission.status !== 'approved') {
    return { ok: false, pending: submission.status === 'pending', rejected: submission.status === 'rejected' };
  }

  await fsPatch(projectId, token, completionPath, {
    uid,
    atMs: Date.now(),
    verification: 'proof',
    submissionId
  }, ['uid', 'atMs', 'verification', 'submissionId']);
  await fsAtomicIncrement(projectId, token, `communityTasks/${taskId}`, 'completions', 1);
  const xp = Number(task.xpReward) || 50;
  const award = await handleAwardXp(uid, { amount: xp, meta: { communityTaskId: taskId, templateId: task.templateId } }, env);
  return { ok: true, already: false, verified: true, award };
}

/**
 * Create/remove membership server-side and keep the accepted counter aligned.
 */
async function handleMembership(uid, body, env) {
  const taskId = String(body.taskId || '').trim();
  const action = String(body.action || '').trim();
  if (!taskId) throw new Error('taskId required');
  if (!['join','leave'].includes(action)) throw new Error('Invalid membership action');

  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);
  const task = await fsGet(projectId, token, `communityTasks/${taskId}`);
  if (!task) throw new Error('Challenge not found');
  if (task.endAtMs && Number(task.endAtMs) < Date.now()) throw new Error('Challenge expired');

  const memberPath = `communityTasks/${taskId}/members/${uid}`;
  const member = await fsGet(projectId, token, memberPath);
  const user = await fsGet(projectId, token, `users/${uid}`) || {};

  if (action === 'join') {
    if (member) return { ok: true, already: true, joined: true };
    await fsPatch(projectId, token, memberPath, {
      uid,
      name: String(user.name || 'User').slice(0,50),
      userId: String(user.userId || '').slice(0,50),
      photoURL: user.photoURL || null,
      joinedAtMs: Date.now(),
      solvingActive: false,
      solvingAtMs: 0
    }, ['uid','name','userId','photoURL','joinedAtMs','solvingActive','solvingAtMs']);
    await fsAtomicIncrement(projectId, token, `communityTasks/${taskId}`, 'joins', 1);
    return { ok: true, already: false, joined: true };
  }

  if (!member) return { ok: true, already: true, joined: false };
  await fsDelete(projectId, token, memberPath);
  const joins = Math.max(0, Number(task.joins) || 0);
  if (joins > 0) await fsAtomicIncrement(projectId, token, `communityTasks/${taskId}`, 'joins', -1);
  return { ok: true, already: false, joined: false };
}

/**
 * Maintain a near-real-time solving presence count.
 * Presence expires after 90s; any fresh heartbeat reconciles the task count.
 */
async function handlePresence(uid, body, env) {
  const taskId = String(body.taskId || '').trim();
  const active = body.active === true;
  if (!taskId) throw new Error('taskId required');

  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);
  const task = await fsGet(projectId, token, `communityTasks/${taskId}`);
  if (!task) throw new Error('Challenge not found');
  if (task.endAtMs && Number(task.endAtMs) < Date.now()) throw new Error('Challenge expired');

  const memberPath = `communityTasks/${taskId}/members/${uid}`;
  const member = await fsGet(projectId, token, memberPath);
  if (!member) throw new Error('Accept the challenge first');

  const now = Date.now();
  await fsPatch(projectId, token, memberPath, {
    solvingActive: active,
    solvingAtMs: active ? now : 0
  }, ['solvingActive','solvingAtMs']);

  const members = await fsListDocs(projectId, token, `communityTasks/${taskId}/members`, 200);
  const activeCount = members.filter(m => m.solvingActive === true && Number(m.solvingAtMs) > now - 90 * 1000).length;
  await fsPatch(projectId, token, `communityTasks/${taskId}`, { solvingNow: activeCount }, ['solvingNow']);

  return { ok: true, solvingNow: activeCount };
}

/**
 * Rate a completed challenge and recalculate the aggregate on the server.
 */
async function handleRateChallenge(uid, body, env) {
  const taskId = String(body.taskId || '').trim();
  const rating = Math.round(Number(body.rating));
  const feedback = String(body.feedback || '').trim().slice(0,160);
  if (!taskId) throw new Error('taskId required');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Rating must be 1–5');

  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);
  const task = await fsGet(projectId, token, `communityTasks/${taskId}`);
  if (!task) throw new Error('Challenge not found');

  const member = await fsGet(projectId, token, `communityTasks/${taskId}/members/${uid}`);
  if (!member) throw new Error('Accept the challenge first');
  const completion = await fsGet(projectId, token, `communityTasks/${taskId}/completions/${uid}`);
  if (!completion) throw new Error('Complete the challenge before rating it');

  await fsPatch(projectId, token, `communityTasks/${taskId}/ratings/${uid}`, {
    uid, rating, feedback, atMs: Date.now()
  }, ['uid','rating','feedback','atMs']);

  const ratings = await fsListDocs(projectId, token, `communityTasks/${taskId}/ratings`, 200);
  const valid = ratings.map(r => Number(r.rating)).filter(n => Number.isFinite(n) && n >= 1 && n <= 5);
  const count = valid.length;
  const average = count ? Number((valid.reduce((a,b)=>a+b,0)/count).toFixed(2)) : 0;
  await fsPatch(projectId, token, `communityTasks/${taskId}`, {
    ratingAverage: average,
    ratingCount: count
  }, ['ratingAverage','ratingCount']);

  return { ok: true, rating, ratingAverage: average, ratingCount: count };
}

/**
 * Bump a counter field on a communityTasks document.
 * action: 'join'|'leave'|'like'|'unlike'|'comment'|'complete'
 */
async function handleCounter(uid, body, env) {
  const taskId = String(body.taskId || '').trim();
  const action = String(body.action || '').trim();

  if (!taskId) throw new Error('taskId required');

  const validActions = ['join', 'leave', 'like', 'unlike', 'comment'];
  if (!validActions.includes(action)) throw new Error(`Invalid action: ${action}`);

  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);
  const task = await fsGet(projectId, token, `communityTasks/${taskId}`);
  if (!task) throw new Error('Challenge not found');

  if (action === 'like' || action === 'unlike') {
    const likeUid = String(body.likeUid || uid);
    if (likeUid !== uid) throw new Error('Like owner mismatch');
    const likeDoc = await fsGet(projectId, token, `communityTasks/${taskId}/likes/${uid}`);
    if (!likeDoc) throw new Error('Like document not found');
  }
  if (action === 'comment') {
    const commentId = String(body.commentId || '').trim();
    if (!commentId) throw new Error('commentId required');
    const commentDoc = await fsGet(projectId, token, `communityTasks/${taskId}/comments/${commentId}`);
    if (!commentDoc || commentDoc.uid !== uid) throw new Error('Comment document not found');
  }

  const fieldMap = {
    join:     { field: 'joins',       delta: 1 },
    leave:    { field: 'joins',       delta: -1 },
    like:     { field: 'likes',       delta: 1 },
    unlike:   { field: 'likes',       delta: -1 },
    comment:  { field: 'comments',    delta: 1 },
    complete: { field: 'completions', delta: 1 }
  };

  const { field, delta } = fieldMap[action];
  await fsAtomicIncrement(projectId, token, `communityTasks/${taskId}`, field, delta);

  return { ok: true, taskId, action, field, delta };
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
      } else if (path === '/gamification/membership') {
        result = await handleMembership(uid, body, env);
      } else if (path === '/gamification/presence') {
        result = await handlePresence(uid, body, env);
      } else if (path === '/gamification/rate-challenge') {
        result = await handleRateChallenge(uid, body, env);
      } else if (path === '/gamification/complete-challenge') {
        result = await handleCompleteChallenge(uid, body, env);
      } else if (path === '/gamification/create-mystery') {
        result = await handleCreateMystery(uid, body, env);
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
