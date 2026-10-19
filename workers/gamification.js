/**
 * Cloudflare Worker — Trio Day Gamification + Activities Backend
 * 
 * Handles all server-side writes that are blocked from direct client access:
 *   POST /gamification/award-xp        — XP + level + leaderboard + badges (legacy Challenges)
 *   POST /gamification/bump-streak     — streak fields (legacy Challenges)
 *   POST /gamification/use-shield      — streak shield
 *   POST /api/activity/complete-task   — AI verification + XP + leaderboard (NEW Activities)
 *   POST /api/activity/skip-task       — Skip task, move to next (NEW Activities)
 *   POST /api/activity/claim-guest-xp  — Replay guest-trial task claims after sign-in
 *   POST /api/admin/activity           — Admin CRUD for Activities (strict admin check)
 *   POST /api/admin/task               — Admin CRUD for Tasks (strict admin check)
 *   POST /api/admin/cloudinary-sign    — Signed Cloudinary upload (strict admin check)
 * 
 * Auth: every request must carry Authorization: Bearer <firebase-id-token>
 * The Worker verifies the token, derives uid, and writes via service account.
 * Admin routes additionally verify email === ADMIN_EMAILS
 * 
 * Wrangler secrets required:
 *   FIREBASE_SA_CLIENT_EMAIL   service account email
 *   (FIREBASE_PROJECT_ID hardcoded to "nkm-ind")
 *   FIREBASE_SA_PRIVATE_KEY    RSA private key PEM stored in KV namespace FIREBASE_KEYS
 *   SUPABASE_URL               https://vccypxwiqcuexxrhtgyq.supabase.co
 *   SUPABASE_ANON_KEY          sb_publishable_zJvP50wf3CW2PNfkOD9yCQ_ffFhsZEp
 *   ADMIN_EMAILS               nikhilkumar210h@gmail.com,nikhilkumar45374@gmail.com
 *   CLOUDINARY_CLOUD_NAME      your-cloud-name
 *   CLOUDINARY_API_KEY         your-api-key
 *   CLOUDINARY_API_SECRET      your-api-secret
 * 
 * Setup:
 *   npx wrangler secret put FIREBASE_SA_CLIENT_EMAIL
 *   npx wrangler secret put SUPABASE_URL
 *   npx wrangler secret put SUPABASE_ANON_KEY
 *   npx wrangler secret put ADMIN_EMAILS
 *   npx wrangler secret put CLOUDINARY_CLOUD_NAME
 *   npx wrangler secret put CLOUDINARY_API_KEY
 *   npx wrangler secret put CLOUDINARY_API_SECRET
 *   npx wrangler kv key put --binding FIREBASE_KEYS --path <pem-file> FIREBASE_SA_PRIVATE_KEY
 *   npx wrangler deploy --config workers/wrangler.gamification.toml
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 100;
const LEADERBOARD_TOP_N = 50;
const BUILTIN_CHALLENGE_IDS = new Set(['trip', 'hour', 'weekend', 'food']);
const MAX_XP_AWARD = 500;          // per single call
const FIREBASE_PUBLIC_KEYS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Admin emails (from env)
const ADMIN_EMAILS = (globalThis.ADMIN_EMAILS || 'nikhilkumar210h@gmail.com,nikhilkumar45374@gmail.com')
  .split(',').map(e => e.trim().toLowerCase());

// Supabase config (from env)
const SUPABASE_URL = globalThis.SUPABASE_URL || 'https://vccypxwiqcuexxrhtgyq.supabase.co';
const SUPABASE_ANON_KEY = globalThis.SUPABASE_ANON_KEY || 'sb_publishable_zJvP50wf3CW2PNfkOD9yCQ_ffFhsZEp';
const SUPABASE_SERVICE_ROLE_KEY = globalThis.SUPABASE_SERVICE_ROLE_KEY || '';

// Cloudinary config (from env)
const CLOUDINARY_CLOUD_NAME = globalThis.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = globalThis.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = globalThis.CLOUDINARY_API_SECRET || '';

// Supabase column selects (verified against the live `activities` / `tasks` tables).
// NOTE: activities has NO `icon` / `updated_at`; tasks has NO `description_en`,
// `is_published`, `is_active` or `updated_at`. Selecting a missing column makes
// PostgREST return 400, so these lists must stay limited to real columns.
const ACTIVITY_SELECT = 'id,display_order,category,title_en,title_hi,description_en,description_hi,difficulty,total_xp,cover_image_url,is_guest_allowed,is_published,created_at';
const TASK_SELECT_PUBLIC = 'id,activity_id,task_number,task_type,title_en,title_hi,instructions_en,instructions_hi,min_time_seconds,xp_reward';
const TASK_SELECT_ADMIN = 'id,activity_id,task_number,task_type,title_en,title_hi,instructions_en,instructions_hi,verification_prompt,min_time_seconds,xp_reward,created_at';

// Writable column allow-lists (unknown columns make PostgREST reject the write).
const ACTIVITY_WRITABLE = [
  'display_order', 'category', 'title_en', 'title_hi', 'description_en', 'description_hi',
  'difficulty', 'total_xp', 'cover_image_url', 'is_guest_allowed', 'is_published'
];
const TASK_WRITABLE = [
  'activity_id', 'task_number', 'task_type', 'title_en', 'title_hi',
  'instructions_en', 'instructions_hi', 'verification_prompt', 'min_time_seconds', 'xp_reward'
];
const ACTIVITY_CATEGORIES = ['Starter', 'Learning', 'Digital Skill', 'Personal Growth', 'Mind & Emotion', 'Social Life', 'Career & Practical Life'];
const TASK_TYPES = ['Brainteaser', 'Action Step', 'Reflection', 'Boss Task', 'Real-life Action', 'Learning Sprint', 'Creative Build', 'Social Connection', 'Mindful Reset', 'Planning', 'Observation', 'Habit Practice', 'Problem Solving'];

// Guest trial: max tasks a guest may claim XP for, and the hard cap on the claim payload.
const GUEST_TASK_LIMIT = 3;

/** Keep only known columns, dropping undefined values (PATCH = leave unchanged). */
function pickColumns(data, allowed) {
  const out = {};
  for (const key of allowed) {
    if (data && data[key] !== undefined) out[key] = data[key];
  }
  return out;
}

// ─── Per-UID rate limiting (10 requests/minute) ───────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitMap = new Map();

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
  { id:'badge_first_complete', name:'First Activity', icon:'🎯', desc:'Complete your first Activity' },
  { id:'badge_streak_3', name:'On Fire', icon:'🔥', desc:'Reach a 3-day Activity streak' },
  { id:'badge_streak_7', name:'Week Warrior', icon:'⚡', desc:'Reach a 7-day Activity streak' },
  { id:'badge_streak_30', name:'Unstoppable', icon:'💎', desc:'Reach a 30-day Activity streak' },
  { id:'badge_xp_500', name:'Rising Star', icon:'✨', desc:'Reach 500 Activity XP' },
  { id:'badge_xp_1000', name:'Legend', icon:'👑', desc:'Reach 1000 Activity XP' }
];

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://trio-day.trioday-nikhil.workers.dev",
  "https://trio-day.web.app",
];

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const u = new URL(origin);
    return u.protocol === "http:" && LOCAL_HOSTS.includes(u.hostname);
  } catch (_) {
    return false;
  }
}

function corsHeaders(origin) {
  const allow = isAllowedOrigin(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin || "") }
  });
}

// ─── Timezone helpers ─────────────────────────────────────────────────────────
const DEFAULT_USER_TIME_ZONE = 'UTC';
const tzDayFormatters = new Map();

function validTimeZone(tz) {
  const candidate = String(tz || '').trim();
  if (!candidate) return null;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: candidate, year: 'numeric', month: '2-digit', day: '2-digit' });
    return candidate;
  } catch (_) {
    return null;
  }
}

function resolveUserTimeZone(tz) {
  return validTimeZone(tz) || DEFAULT_USER_TIME_ZONE;
}

function tzDayFormatter(tz) {
  let fmt = tzDayFormatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    tzDayFormatters.set(tz, fmt);
  }
  return fmt;
}

function pad(n) { return String(n).padStart(2, '0'); }

function localDateKey(now = new Date(), timeZone = DEFAULT_USER_TIME_ZONE) {
  return tzDayFormatter(timeZone).format(now);
}

function yesterdayDateKey(now = new Date(), timeZone = DEFAULT_USER_TIME_ZONE) {
  const todayKey = localDateKey(now, timeZone);
  for (let i = 1; i <= 30; i++) {
    const key = localDateKey(new Date(now.getTime() - i * 3600 * 1000), timeZone);
    if (key !== todayKey) return key;
  }
  return todayKey;
}

function tzCalendarParts(now, timeZone) {
  const parts = tzDayFormatter(timeZone).formatToParts(now);
  const out = { year: 1970, month: 1, day: 1 };
  for (const p of parts) {
    if (p.type === 'year') out.year = Number(p.value);
    else if (p.type === 'month') out.month = Number(p.value);
    else if (p.type === 'day') out.day = Number(p.value);
  }
  return out;
}

function localWeekKey(now = new Date(), timeZone = DEFAULT_USER_TIME_ZONE) {
  const { year, month, day } = tzCalendarParts(now, timeZone);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayIdx = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayIdx + 3);
  const week1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const weekNo = 1 + Math.round(
    ((date - week1) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7
  );
  return `${date.getUTCFullYear()}-W${pad(weekNo)}`;
}

function localMonthKey(now = new Date(), timeZone = DEFAULT_USER_TIME_ZONE) {
  const { year, month } = tzCalendarParts(now, timeZone);
  return `${year}-${pad(month)}`;
}

function levelFromXp(xp) {
  return Math.floor(Math.max(0, Number(xp) || 0) / XP_PER_LEVEL) + 1;
}

// ─── Firebase / Firestore REST helpers ────────────────────────────────────────
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
  const normalizedEmail = String(clientEmail).trim();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: normalizedEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  function encode(obj) {
    const jsonStr = JSON.stringify(obj);
    return btoa(jsonStr)
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

  const privateKey = await env.FIREBASE_KEYS.get("FIREBASE_SA_PRIVATE_KEY");
  if (!privateKey) throw new Error("FIREBASE_SA_PRIVATE_KEY not found in KV");

  const jwt = await createServiceAccountJwt(
    env.FIREBASE_SA_CLIENT_EMAIL,
    privateKey,
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
  function readTag(buf, off) { return { tag: buf[off], next: off + 1 }; }
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

// ─── Badge evaluation ─────────────────────────────────────────────────────────
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

// ─── Supabase helpers ─────────────────────────────────────────────────────────
// Use service role key for writes and admin reads (verification_prompt), anon key for public reads
function supabaseHeaders(useServiceRole = false) {
  const key = useServiceRole && SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function supabaseRequest(method, path, body = null, useServiceRole = false) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = supabaseHeaders(useServiceRole);
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase ${method} ${path} failed: ${res.status} - ${txt}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Admin read with service role to get verification_prompt
async function supabaseAdminRequest(method, path, body = null) {
  return supabaseRequest(method, path, body, true);
}

// ─── AI Verification (Cloudflare Workers AI or Gemini) ────────────────────────
async function verifyWithAI(proof, verificationPrompt, taskTitle, taskDescription) {
  // Try Cloudflare Workers AI first (if available)
  // Fallback: simple heuristic check for demo
  if (!verificationPrompt || !verificationPrompt.trim()) {
    return { valid: true, reason: 'No verification prompt configured' };
  }
  
  // Check for obvious spam
  const spamPatterns = [
    /^asdf+/i, /^qwer+/i, /^zxcv+/i, /^[a-z]{1,3}$/i,
    /^(test|testing|hello|hi|ok|yes|no|done)\.?$/i,
    /^.{0,10}$/ // Too short
  ];
  
  const proofLower = proof.toLowerCase().trim();
  for (const pattern of spamPatterns) {
    if (pattern.test(proofLower)) {
      return { valid: false, reason: 'Response appears to be spam or too short' };
    }
  }
  
  // Check if proof mentions key concepts from task
  const taskKeywords = (taskTitle + ' ' + taskDescription).toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 10);
  
  let keywordMatches = 0;
  for (const kw of taskKeywords) {
    if (proofLower.includes(kw)) keywordMatches++;
  }
  
  // Require at least 1 keyword match or substantial content
  if (keywordMatches === 0 && proof.length < 50) {
    return { valid: false, reason: 'Response does not appear related to the task' };
  }
  
  return { valid: true, reason: 'Verified' };
}

// ─── Shared XP award (idempotent per grantKey) ────────────────────────────────
// Server-authoritative: the client never sends an XP amount, only what it did.
async function awardActivityXp({ uid, env, amount, grantKey, timeZone }) {
  const projectId = 'nkm-ind';
  const token = await getAccessToken(env);

  const created = await fsCreateDoc(projectId, token, 'users/'+uid+'/xpAwards/'+grantKey, {
    uid, grantKey, amount, createdAtMs: Date.now()
  });

  const userData = await fsGet(projectId, token, 'users/'+uid) || {};
  if (!created) {
    return {
      ok: true, xp: Number(userData.xp) || 0,
      level: Number(userData.level) || levelFromXp(userData.xp),
      leveledUp: false, awarded: 0, alreadyAwarded: true, badgesEarned: []
    };
  }

  const prevXp = Number(userData.xp) || 0;
  const newXp = prevXp + amount;
  const newLevel = levelFromXp(newXp);
  const now = new Date();
  const weekKey = localWeekKey(now, timeZone);
  const monthKey = localMonthKey(now, timeZone);

  const weeklyXp = (userData.weeklyXpKey === weekKey ? Number(userData.weeklyXp) || 0 : 0) + amount;
  const monthlyXp = (userData.monthlyXpKey === monthKey ? Number(userData.monthlyXp) || 0 : 0) + amount;

  const allowedBadges = new Set(SYSTEM_BADGES.map(b => b.id));
  const currentBadges = Array.isArray(userData.badges) ? userData.badges.filter(id => allowedBadges.has(id)) : [];
  const earned = evaluateBadgesDelta(currentBadges, newXp, Number(userData.streakCurrent) || 0);

  const patch = { xp: newXp, level: newLevel, weeklyXp, monthlyXp, weeklyXpKey: weekKey, monthlyXpKey: monthKey };
  if (earned.length) patch.badges = [...currentBadges, ...earned];

  await fsPatch(projectId, token, 'users/'+uid, patch, Object.keys(patch));

  const entry = {
    uid, name: userData.name || 'User', photoURL: userData.photoURL || null,
    level: newLevel, xp: newXp, weeklyXp, monthlyXp, streakCurrent: Number(userData.streakCurrent) || 0
  };

  await Promise.all([
    upsertLeaderboard(projectId, token, 'global', entry, 'xp'),
    upsertLeaderboard(projectId, token, 'weekly_'+weekKey, entry, 'weeklyXp'),
    upsertLeaderboard(projectId, token, 'monthly_'+monthKey, entry, 'monthlyXp'),
    upsertLeaderboard(projectId, token, 'streak', entry, 'streakCurrent')
  ]);

  return {
    ok: true, xp: newXp, level: newLevel, weeklyXp,
    leveledUp: newLevel > levelFromXp(prevXp), awarded: amount, alreadyAwarded: false,
    badgesEarned: earned.map(id => SYSTEM_BADGES.find(b => b.id === id) || { id })
  };
}

// Progress log is best-effort: a logging failure must never undo an XP award
// that has already been granted (that would let a user "lose" a verified task).
async function logTaskProgress(row) {
  try {
    await supabaseAdminRequest('POST', 'user_task_progress', row);
  } catch (err) {
    console.error('[gamification] user_task_progress log failed:', err.message);
  }
}

// ─── Activity Completion Handler ──────────────────────────────────────────────
async function handleCompleteTask(uid, body, env) {
  const { activityId, taskId, taskNumber, proof } = body;

  if (!activityId || !taskId) throw new Error('activityId and taskId required');

  // Input validation before anything is awarded.
  const submission = String(proof || '').trim();
  if (submission.length < 10) {
    return { ok: false, error: 'Please write at least a short, specific reflection (10+ characters).', xpAwarded: 0 };
  }
  if (submission.length > 2000) {
    return { ok: false, error: 'Reflection is too long (max 2000 characters).', xpAwarded: 0 };
  }

  // Fetch task details from Supabase with service role to get verification_prompt
  const task = await supabaseAdminRequest('GET', `tasks?id=eq.${taskId}&select=${TASK_SELECT_ADMIN}`);
  if (!task?.length) throw new Error('Task not found');
  const taskData = task[0];

  // The task must really belong to the activity being played.
  if (String(taskData.activity_id) !== String(activityId)) {
    throw new Error('Task does not belong to this activity');
  }

  // Fetch activity (public columns) — also confirms the activity exists.
  const activity = await supabaseRequest('GET', `activities?id=eq.${activityId}&select=${ACTIVITY_SELECT}`);
  if (!activity?.length) throw new Error('Activity not found');

  // AI / rule-based verification uses the server-side verification_prompt.
  const verification = await verifyWithAI(
    submission,
    taskData.verification_prompt,
    taskData.title_en,
    taskData.instructions_en
  );

  if (!verification.valid) {
    return { ok: false, error: verification.reason, xpAwarded: 0 };
  }

  const amount = Math.min(MAX_XP_AWARD, Math.max(0, Number(taskData.xp_reward) || 10));
  const timeZone = resolveUserTimeZone(body?.timeZone);
  const taskNo = Number(taskData.task_number) || Number(taskNumber) || 0;
  const weekKey = localWeekKey(new Date(), timeZone);

  // Idempotent per user + activity + task + week: a task can be verified once a
  // week (matching the weekly-XP leaderboard), and a retried request or double
  // tap can never award twice.
  const grantKey = `activity_${activityId}_task_${taskNo}_w_${weekKey}`;

  const result = await awardActivityXp({ uid, env, amount, grantKey, timeZone });

  if (!result.alreadyAwarded) {
    await logTaskProgress({
      firebase_uid: uid,
      activity_id: activityId,
      task_id: taskId,
      status: 'completed',
      user_submission: submission,
      ai_verified: true,
      ai_feedback: verification.reason,
      xp_awarded: amount,
      week_key: weekKey,
      completed_at: new Date().toISOString()
    });
  }

  return { ...result, verification: verification.reason, weekKey };
}

// ─── Activity Skip Handler ────────────────────────────────────────────────────
async function handleSkipTask(uid, body, env) {
  const { activityId, taskId, taskNumber } = body;

  if (!activityId || !taskId) throw new Error('activityId and taskId required');

  const projectId = 'nkm-ind';
  const token = await getAccessToken(env);

  // A skip never awards XP and is only recorded for history (idempotent).
  const grantKey = `activity_${activityId}_task_${taskNumber}_skip`;
  await fsCreateDoc(projectId, token, 'users/'+uid+'/taskSkips/'+grantKey, {
    uid, activityId, taskId, taskNumber, createdAtMs: Date.now()
  });

  const timeZone = resolveUserTimeZone(body?.timeZone);
  await logTaskProgress({
    firebase_uid: uid,
    activity_id: activityId,
    task_id: taskId,
    status: 'skipped',
    user_submission: null,
    ai_verified: false,
    ai_feedback: null,
    xp_awarded: 0,
    week_key: localWeekKey(new Date(), timeZone),
    completed_at: new Date().toISOString()
  });

  return { ok: true, skipped: true, awarded: 0 };
}

// ─── Guest trial claim ────────────────────────────────────────────────────────
// A guest plays up to GUEST_TASK_LIMIT tasks locally (no account). When they sign
// in, the client replays those claims here. The XP amount always comes from the
// server-side task row, never from the client, and each task is claimable once.
async function handleClaimGuestXp(uid, body, env) {
  const rawClaims = Array.isArray(body?.claims) ? body.claims.slice(0, GUEST_TASK_LIMIT) : [];
  if (!rawClaims.length) return { ok: true, awarded: 0, claimed: 0, alreadyClaimed: true, results: [] };

  const timeZone = resolveUserTimeZone(body?.timeZone);
  const results = [];
  let awardedTotal = 0;
  let claimed = 0;

  for (const claim of rawClaims) {
    const taskId = String(claim?.taskId || '').trim();
    if (!taskId) continue;

    let taskData = null;
    try {
      const rows = await supabaseAdminRequest('GET', `tasks?id=eq.${taskId}&select=${TASK_SELECT_ADMIN}`);
      taskData = rows?.[0] || null;
    } catch (err) {
      console.error('[gamification] guest claim task lookup failed:', err.message);
    }
    if (!taskData) continue;
    if (claim?.activityId && String(taskData.activity_id) !== String(claim.activityId)) continue;

    const amount = Math.min(MAX_XP_AWARD, Math.max(0, Number(taskData.xp_reward) || 10));
    const result = await awardActivityXp({
      uid, env, amount,
      grantKey: `guest_task_${taskId}`,
      timeZone
    });
    awardedTotal += result.awarded || 0;
    if (!result.alreadyAwarded) claimed++;
    results.push({ taskId, awarded: result.awarded || 0, alreadyAwarded: !!result.alreadyAwarded });
  }

  // Persist the bootstrap marker so the client never replays it endlessly.
  try {
    const token = await getAccessToken(env);
    await fsPatch(
      'nkm-ind', token, 'users/'+uid,
      { guestXpClaimed: true, guestTasksClaimed: claimed, guestClaimedAtMs: Date.now() },
      ['guestXpClaimed', 'guestTasksClaimed', 'guestClaimedAtMs']
    );
  } catch (err) {
    console.error('[gamification] guest claim marker failed:', err.message);
  }

  return { ok: true, awarded: awardedTotal, claimed, alreadyClaimed: claimed === 0, results };
}

// ─── Admin Activity CRUD ──────────────────────────────────────────────────────
function assertAdmin(tokenPayload) {
  const userEmail = tokenPayload?.email?.toLowerCase();
  if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
    throw new Error('Admin access required');
  }
}

function coerceInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

async function handleAdminActivity(uid, body, env, request, tokenPayload) {
  assertAdmin(tokenPayload);

  const { action, activityId, data } = body; // action: create, update, delete
  const payload = pickColumns(data, ACTIVITY_WRITABLE);

  const validate = () => {
    if (payload.title_en !== undefined && !String(payload.title_en).trim()) throw new Error('Activity title is required');
    if (payload.category !== undefined && !ACTIVITY_CATEGORIES.includes(payload.category)) {
      throw new Error('Unknown category: ' + payload.category);
    }
    if (payload.display_order !== undefined) payload.display_order = coerceInt(payload.display_order, 0);
    if (payload.total_xp !== undefined) payload.total_xp = Math.max(0, coerceInt(payload.total_xp, 0));
    if (payload.is_guest_allowed !== undefined) payload.is_guest_allowed = payload.is_guest_allowed === true || payload.is_guest_allowed === 'true';
    if (payload.is_published !== undefined) payload.is_published = payload.is_published === true || payload.is_published === 'true';
  };

  switch (action) {
    case 'create': {
      if (!String(payload.title_en || '').trim()) throw new Error('Activity title is required');
      if (!payload.category) throw new Error('Activity category is required');
      validate();
      payload.created_at = new Date().toISOString();
      return supabaseAdminRequest('POST', 'activities', payload);
    }
    case 'update': {
      if (!activityId) throw new Error('activityId required');
      validate();
      if (!Object.keys(payload).length) throw new Error('Nothing to update');
      return supabaseAdminRequest('PATCH', `activities?id=eq.${activityId}`, payload);
    }
    case 'delete': {
      if (!activityId) throw new Error('activityId required');
      // Delete child tasks first so no orphan tasks remain.
      await supabaseAdminRequest('DELETE', `tasks?activity_id=eq.${activityId}`);
      return supabaseAdminRequest('DELETE', `activities?id=eq.${activityId}`);
    }
    default:
      throw new Error('Invalid action');
  }
}

// ─── Admin Task CRUD ──────────────────────────────────────────────────────────
async function handleAdminTask(uid, body, env, request, tokenPayload) {
  assertAdmin(tokenPayload);

  const { action, taskId, data } = body;
  // verification_prompt is omitted from `data` when the admin did not edit it —
  // the browser cannot read that column, so leaving it out preserves the value.
  const payload = pickColumns(data, TASK_WRITABLE);

  const validate = () => {
    if (payload.title_en !== undefined && !String(payload.title_en).trim()) throw new Error('Task title is required');
    if (payload.task_type !== undefined && !TASK_TYPES.includes(payload.task_type)) {
      throw new Error('Unknown task type: ' + payload.task_type);
    }
    if (payload.task_number !== undefined) {
      const n = coerceInt(payload.task_number, 0);
      if (n < 1) throw new Error('Task number must be 1 or greater');
      payload.task_number = n;
    }
    if (payload.min_time_seconds !== undefined) payload.min_time_seconds = Math.max(0, coerceInt(payload.min_time_seconds, 0));
    if (payload.xp_reward !== undefined) payload.xp_reward = Math.max(0, Math.min(MAX_XP_AWARD, coerceInt(payload.xp_reward, 10)));
    if (payload.verification_prompt !== undefined) payload.verification_prompt = String(payload.verification_prompt);
  };

  switch (action) {
    case 'create': {
      if (!payload.activity_id) throw new Error('Task must belong to an activity');
      if (!String(payload.title_en || '').trim()) throw new Error('Task title is required');
      validate();
      payload.created_at = new Date().toISOString();

      // Reject a duplicate task_number up front with a readable message
      // (the table has UNIQUE(activity_id, task_number)).
      const existing = await supabaseAdminRequest('GET', `tasks?activity_id=eq.${payload.activity_id}&task_number=eq.${payload.task_number}&select=id`);
      if (existing?.length) throw new Error(`Task #${payload.task_number} already exists in this activity. Choose a different number.`);

      return supabaseAdminRequest('POST', 'tasks', payload);
    }
    case 'update': {
      if (!taskId) throw new Error('taskId required');
      validate();
      if (!Object.keys(payload).length) throw new Error('Nothing to update');
      return supabaseAdminRequest('PATCH', `tasks?id=eq.${taskId}`, payload);
    }
    case 'delete': {
      if (!taskId) throw new Error('taskId required');
      return supabaseAdminRequest('DELETE', `tasks?id=eq.${taskId}`);
    }
    default:
      throw new Error('Invalid action');
  }
}

// ─── Cloudinary Signed Upload ─────────────────────────────────────────────────
async function handleCloudinarySign(uid, body, env, request, tokenPayload) {
  const userEmail = tokenPayload.email?.toLowerCase();
  
  if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
    throw new Error('Admin access required');
  }
  
  const { folder = 'trio/activities', filename } = body;
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${folder}/${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`;
  
  // Create signature
  const params = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = await generateCloudinarySignature(params);
  
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    signature,
    timestamp,
    apiKey: CLOUDINARY_API_KEY,
    publicId,
    folder
  };
}

async function generateCloudinarySignature(params) {
  const msg = params + CLOUDINARY_API_SECRET;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(CLOUDINARY_API_SECRET),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(params));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Legacy Challenge Handlers (unchanged) ────────────────────────────────────
async function handleAwardXp(uid, body, env) {
  // ... existing implementation from lines 550-587
  // (keeping for backwards compatibility with old Challenge system)
  const challengeId = String(body?.meta?.challengeId || '').trim();
  if (!challengeId) throw new Error('challengeId required');
  const userTimeZone = resolveUserTimeZone(body?.timeZone);
  const projectId = 'nkm-ind', token = await getAccessToken(env);
  const answer = await fsGet(projectId, token, 'challengeAnswers/'+uid+'_'+challengeId);
  if (!answer || answer.uid !== uid || answer.challengeId !== challengeId || !Number.isInteger(Number(answer.choice))) throw new Error('Challenge answer not found');
  const task = await fsGet(projectId, token, 'communityTasks/'+challengeId);
  if (!task && !BUILTIN_CHALLENGE_IDS.has(challengeId)) throw new Error('Challenge not found');
  if (task && (task.kind !== 'challenge' || task.activityType !== 'challenge')) throw new Error('Not a Challenge');
  if (task?.creatorUid === uid) throw new Error('Creators cannot earn XP from their own Challenge');

  const amount = 25, grantKey = 'challenge_'+challengeId;
  const created = await fsCreateDoc(projectId, token, 'users/'+uid+'/xpAwards/'+grantKey, { uid, grantKey, amount, createdAtMs: Date.now() });
  const userData = await fsGet(projectId, token, 'users/'+uid) || {};
  if (!created) return { ok: true, xp: Number(userData.xp)||0, level: Number(userData.level)||levelFromXp(userData.xp), leveledUp: false, awarded: 0, alreadyAwarded: true, badgesEarned: [] };

  const prevXp = Number(userData.xp) || 0, newXp = prevXp + amount, newLevel = levelFromXp(newXp);
  const now = new Date();
  const weekKey = localWeekKey(now, userTimeZone), monthKey = localMonthKey(now, userTimeZone);
  const weeklyXp = (userData.weeklyXpKey === weekKey ? Number(userData.weeklyXp) || 0 : 0) + amount;
  const monthlyXp = (userData.monthlyXpKey === monthKey ? Number(userData.monthlyXp) || 0 : 0) + amount;
  const allowedBadges = new Set(SYSTEM_BADGES.map(b => b.id));
  const currentBadges = Array.isArray(userData.badges) ? userData.badges.filter(id => allowedBadges.has(id)) : [];
  const earned = evaluateBadgesDelta(currentBadges, newXp, Number(userData.streakCurrent) || 0);
  const patch = { xp: newXp, level: newLevel, weeklyXp, monthlyXp, weeklyXpKey: weekKey, monthlyXpKey: monthKey };
  if (earned.length) patch.badges = [...currentBadges, ...earned];
  await fsPatch(projectId, token, 'users/'+uid, patch, Object.keys(patch));
  const entry = { uid, name: userData.name || 'User', photoURL: userData.photoURL || null, level: newLevel, xp: newXp, weeklyXp, monthlyXp, streakCurrent: Number(userData.streakCurrent) || 0 };
  await Promise.all([
    upsertLeaderboard(projectId, token, 'global', entry, 'xp'),
    upsertLeaderboard(projectId, token, 'weekly_'+weekKey, entry, 'weeklyXp'),
    upsertLeaderboard(projectId, token, 'monthly_'+monthKey, entry, 'monthlyXp'),
    upsertLeaderboard(projectId, token, 'streak', entry, 'streakCurrent')
  ]);
  return { ok: true, xp: newXp, level: newLevel, leveledUp: newLevel > levelFromXp(prevXp), awarded: amount, alreadyAwarded: false, badgesEarned: earned.map(id => SYSTEM_BADGES.find(b => b.id === id) || { id }) };
}

async function handleBumpStreak(uid, body, env) {
  // ... existing implementation from lines 589-623
  const challengeId = String(body?.challengeId || '').trim();
  if (!challengeId) throw new Error('challengeId required');
  const userTimeZone = resolveUserTimeZone(body?.timeZone);
  const projectId = 'nkm-ind', token = await getAccessToken(env);
  const answer = await fsGet(projectId, token, 'challengeAnswers/'+uid+'_'+challengeId);
  if (!answer || answer.uid !== uid || answer.challengeId !== challengeId || !Number.isInteger(Number(answer.choice))) throw new Error('Challenge answer not found');
  const task = await fsGet(projectId, token, 'communityTasks/'+challengeId);
  if (!task && !BUILTIN_CHALLENGE_IDS.has(challengeId)) throw new Error('Challenge not found');
  if (task && (task.kind !== 'challenge' || task.activityType !== 'challenge')) throw new Error('Not a Challenge');
  if (task?.creatorUid === uid) throw new Error('Creators cannot earn streaks from their own Challenge');
  const userData = await fsGet(projectId, token, 'users/'+uid) || {};
  const now = new Date();
  const today = localDateKey(now, userTimeZone), yesterday = yesterdayDateKey(now, userTimeZone), last = userData.streakLastDate || null;
  if (last === today) return { ok: true, streakCurrent: Number(userData.streakCurrent) || 0, streakBest: Number(userData.streakBest) || 0, alreadyCounted: true, shields: Number(userData.shields) || 0 };
  const streakCurrent = last === yesterday ? (Number(userData.streakCurrent) || 0) + 1 : 1;
  const streakBest = Math.max(Number(userData.streakBest) || 0, streakCurrent);
  let shields = Number(userData.shields) || 0;
  const prevStreak = last === yesterday ? (Number(userData.streakCurrent) || 0) : 0;
  if (streakCurrent % 7 === 0 && streakCurrent > prevStreak && shields < 3) {
    shields = Math.min(3, shields + 1);
  }
  const currentBadges = Array.isArray(userData.badges) ? userData.badges : [];
  const earned = evaluateBadgesDelta(currentBadges, Number(userData.xp) || 0, streakCurrent);
  const patch = { streakCurrent, streakBest, streakLastDate: today, shields };
  if (earned.length) patch.badges = [...currentBadges, ...earned];
  await fsPatch(projectId, token, 'users/'+uid, patch, Object.keys(patch));
  const entry = { uid, name: userData.name || 'User', photoURL: userData.photoURL || null, level: Number(userData.level) || levelFromXp(userData.xp), xp: Number(userData.xp) || 0, weeklyXp: Number(userData.weeklyXp) || 0, monthlyXp: Number(userData.monthlyXp) || 0, streakCurrent };
  await upsertLeaderboard(projectId, token, 'streak', entry, 'streakCurrent');
  return { ok: true, streakCurrent, streakBest, alreadyCounted: false, badgesEarned: earned.map(id => SYSTEM_BADGES.find(b => b.id === id) || { id }), shields };
}

async function handleUseShield(uid, body, env) {
  // ... existing implementation from lines 625-655
  const userTimeZone = resolveUserTimeZone(body?.timeZone);
  const projectId = 'nkm-ind', token = await getAccessToken(env);
  const userData = await fsGet(projectId, token, 'users/'+uid) || {};
  const shields = Number(userData.shields) || 0;
  if (shields <= 0) return { ok: false, error: 'No shields available', shields: 0 };
  const now = new Date();
  const today = localDateKey(now, userTimeZone);
  const last = userData.streakLastDate || null;
  if (last === today) return { ok: true, streakCurrent: Number(userData.streakCurrent) || 0, streakBest: Number(userData.streakBest) || 0, shields, alreadyProtected: true };
  const newShields = shields - 1;
  const streakCurrent = Number(userData.streakCurrent) || 0;
  const streakBest = Number(userData.streakBest) || 0;
  const patch = { shields: newShields, streakLastDate: today };
  await fsPatch(projectId, token, 'users/' + uid, patch, Object.keys(patch));
  const entry = { uid, name: userData.name || 'User', photoURL: userData.photoURL || null, level: Number(userData.level) || levelFromXp(userData.xp), xp: Number(userData.xp) || 0, weeklyXp: Number(userData.weeklyXp) || 0, monthlyXp: Number(userData.monthlyXp) || 0, streakCurrent };
  await upsertLeaderboard(projectId, token, 'streak', entry, 'streakCurrent');
  return { ok: true, streakCurrent, streakBest, shields: newShields, alreadyProtected: false };
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

    // Verify required secrets
    if (!env.FIREBASE_SA_CLIENT_EMAIL) {
      return json({ error: 'Server configuration incomplete' }, 500, origin);
    }
    try {
      const keyExists = await env.FIREBASE_KEYS.get("FIREBASE_SA_PRIVATE_KEY");
      if (!keyExists) {
        return json({ error: 'Server configuration incomplete: FIREBASE_SA_PRIVATE_KEY missing in KV' }, 500, origin);
      }
    } catch (_) {
      return json({ error: 'Server configuration incomplete: KV access failed' }, 500, origin);
    }

    // Verify Firebase ID token
    const authHeader = request.headers.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) {
      return json({ error: 'Authorization header required' }, 401, origin);
    }

    let tokenPayload;
    try {
      tokenPayload = await verifyFirebaseIdToken(idToken, 'nkm-ind', caches.default);
    } catch (err) {
      return json({ error: 'Unauthorized', detail: err.message }, 401, origin);
    }

    const uid = tokenPayload.sub;
    if (!uid) return json({ error: 'Invalid token: no uid' }, 401, origin);

    // Rate limit
    const rateLimit = checkRateLimit(uid);
    if (!rateLimit.allowed) {
      return json({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter }, 429, origin);
    }

    // Reject oversized bodies
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
      else if (path === '/gamification/bump-streak') result = await handleBumpStreak(uid, body, env);
      else if (path === '/gamification/use-shield') result = await handleUseShield(uid, body, env);
      else if (path === '/api/activity/complete-task') result = await handleCompleteTask(uid, body, env);
      else if (path === '/api/activity/skip-task') result = await handleSkipTask(uid, body, env);
      else if (path === '/api/activity/claim-guest-xp') result = await handleClaimGuestXp(uid, body, env);
      else if (path === '/api/admin/activity') result = await handleAdminActivity(uid, body, env, request, tokenPayload);
      else if (path === '/api/admin/task') result = await handleAdminTask(uid, body, env, request, tokenPayload);
      else if (path === '/api/admin/cloudinary-sign') result = await handleCloudinarySign(uid, body, env, request, tokenPayload);
      else return json({ error: 'Unknown route' }, 404, origin);
      return json(result, 200, origin);
    } catch (err) {
      console.error(`[gamification] ${path} uid=${uid} error:`, err.message);
      return json({ error: err.message || 'Internal error' }, 500, origin);
    }
  }
};