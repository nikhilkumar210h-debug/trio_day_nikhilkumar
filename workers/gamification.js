/**
 * Cloudflare Worker — Trio Day Gamification + Activities Backend
 * 
 * Handles all server-side writes that are blocked from direct client access:
 *   POST /gamification/award-xp        — XP + level + leaderboard + badges (legacy Challenges)
 *   POST /gamification/bump-streak     — streak fields (legacy Challenges)
 *   POST /gamification/use-shield      — streak shield
 *   POST /api/activity/complete-task   — AI verification + XP + leaderboard (NEW Activities)
 *   POST /api/activity/skip-task       — Skip task, move to next (NEW Activities)
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

// Supabase column selects (real schema)
const ACTIVITY_SELECT = 'id,display_order,category,title_en,title_hi,description_en,description_hi,difficulty,total_xp,cover_image_url,is_guest_allowed,is_published,created_at';
const TASK_SELECT_PUBLIC = 'id,activity_id,task_number,task_type,title_en,title_hi,description_en,instructions_en,instructions_hi,min_time_seconds,xp_reward';
const TASK_SELECT_ADMIN = 'id,activity_id,task_number,task_type,title_en,title_hi,description_en,instructions_en,instructions_hi,verification_prompt,min_time_seconds,xp_reward,is_published,created_at,updated_at';

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
function supabaseHeaders(useServiceRole = false, env = {}) {
  const key = useServiceRole
    ? (env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY)
    : (env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY);
  if (useServiceRole && !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing from the Cloudflare Worker environment');
  }
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function supabaseRequest(method, path, body = null, useServiceRole = false, env = {}) {
  const baseUrl = env.SUPABASE_URL || SUPABASE_URL;
  const url = `${baseUrl}/rest/v1/${path}`;
  const headers = supabaseHeaders(useServiceRole, env);
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase ${method} ${path} failed: ${res.status} - ${txt}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Privileged reads and writes must use the Cloudflare Worker service-role secret;
// never silently fall back to the public anon key for admin operations.
async function supabaseAdminRequest(method, path, body = null, env = {}) {
  return supabaseRequest(method, path, body, true, env);
}

// ─── AI Verification (Cloudflare Workers AI or Gemini) ────────────────────────
async function verifyTaskResponse(proof, verificationPrompt, taskTitle, taskDescription) {
  // This is a server-side heuristic check, not an LLM call. Published tasks must
  // have verification rules configured; missing rules must never auto-award XP.
  if (!verificationPrompt || !verificationPrompt.trim()) {
    return { valid: false, reason: 'This task is missing response-verification rules. Please contact an admin.' };
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

// ─── Activity Completion Handler ──────────────────────────────────────────────
async function handleCompleteTask(uid, body, env) {
  const { activityId, taskId, taskNumber, proof, timeSpent } = body;
  
  if (!activityId || !taskId) throw new Error('activityId and taskId required');
  
  // Fetch task details from Supabase with service role to get verification_prompt
  const task = await supabaseAdminRequest('GET', `tasks?id=eq.${taskId}&select=${TASK_SELECT_ADMIN}`, null, env);
  if (!task?.length) throw new Error('Task not found');
  const taskData = task[0];
  const minimumSeconds = Math.max(0, Number(taskData.min_time_seconds) || 0);
  const submittedTime = Math.max(0, Number(timeSpent) || 0);
  if (submittedTime < minimumSeconds) {
    return { ok: false, error: `Please spend at least ${minimumSeconds} seconds on this task before completing.`, xpAwarded: 0 };
  }

  // Fetch activity for XP reward
  const activity = await supabaseRequest('GET', `activities?id=eq.${activityId}&select=${ACTIVITY_SELECT}`, null, false, env);
  if (!activity?.length) throw new Error('Activity not found');
  const activityData = activity[0];
  
  // AI Verification - use verification_prompt from task data
  const verification = await verifyTaskResponse(
    proof || '',
    taskData.verification_prompt,
    taskData.title_en,  // Use English title for keyword extraction
    [taskData.description_en, taskData.instructions_en].filter(Boolean).join('\n')  // Include the task brief and instructions
  );
  
  if (!verification.valid) {
    return { ok: false, error: verification.reason, xpAwarded: 0 };
  }
  
  const xpReward = taskData.xp_reward || 10;
  
  // Award XP via Firestore (same as challenge system)
  const userTimeZone = resolveUserTimeZone(body?.timeZone);
  const projectId = 'nkm-ind';
  const token = await getAccessToken(env);
  
  // Check if already awarded for this task (use taskNumber for uniqueness)
  const grantKey = `activity_${activityId}_task_${taskNumber}`;
  const created = await fsCreateDoc(projectId, token, 'users/'+uid+'/xpAwards/'+grantKey, {
    uid, grantKey, amount: xpReward, createdAtMs: Date.now()
  });
  
  const userData = await fsGet(projectId, token, 'users/'+uid) || {};
  if (!created) {
    return { ok: true, xp: Number(userData.xp)||0, level: Number(userData.level)||levelFromXp(userData.xp), leveledUp: false, awarded: 0, alreadyAwarded: true, badgesEarned: [] };
  }
  
  const prevXp = Number(userData.xp) || 0;
  const newXp = prevXp + xpReward;
  const newLevel = levelFromXp(newXp);
  const now = new Date();
  const weekKey = localWeekKey(now, userTimeZone);
  const monthKey = localMonthKey(now, userTimeZone);
  
  const weeklyXp = (userData.weeklyXpKey === weekKey ? Number(userData.weeklyXp) || 0 : 0) + xpReward;
  const monthlyXp = (userData.monthlyXpKey === monthKey ? Number(userData.monthlyXp) || 0 : 0) + xpReward;
  
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
  
  // Log task completion to user_task_progress (via Worker with service role)
  const weekKeyStr = localWeekKey(new Date(), userTimeZone);
  await supabaseAdminRequest('POST', 'user_task_progress', {
    firebase_uid: uid,
    activity_id: activityId,
    task_id: taskId,
    status: 'completed',
    user_submission: proof,
    ai_verified: true,
    ai_feedback: verification.reason,
    xp_awarded: xpReward,
    week_key: weekKeyStr,
    completed_at: new Date().toISOString()
  }, env);
  
  return { ok: true, xp: newXp, level: newLevel, leveledUp: newLevel > levelFromXp(prevXp), awarded: xpReward, alreadyAwarded: false, badgesEarned: earned.map(id => SYSTEM_BADGES.find(b => b.id === id) || { id }) };
}

// ─── Activity Skip Handler ────────────────────────────────────────────────────
async function handleSkipTask(uid, body, env) {
  const { activityId, taskId, taskNumber } = body;
  
  if (!activityId || !taskId) throw new Error('activityId and taskId required');
  
  const projectId = 'nkm-ind';
  const token = await getAccessToken(env);
  
  // Log skip (no XP) to Firestore
  const grantKey = `activity_${activityId}_task_${taskNumber}_skip`;
  await fsCreateDoc(projectId, token, 'users/'+uid+'/taskSkips/'+grantKey, {
    uid, activityId, taskId, taskNumber, createdAtMs: Date.now()
  });
  
  // Log skip to user_task_progress via Supabase (service role)
  const userTimeZone = resolveUserTimeZone(body?.timeZone);
  const weekKeyStr = localWeekKey(new Date(), userTimeZone);
  await supabaseAdminRequest('POST', 'user_task_progress', {
    firebase_uid: uid,
    activity_id: activityId,
    task_id: taskId,
    status: 'skipped',
    user_submission: null,
    ai_verified: false,
    ai_feedback: null,
    xp_awarded: 0,
    week_key: weekKeyStr,
    completed_at: new Date().toISOString()
  }, env);
  
  return { ok: true, skipped: true };
}

// ─── Admin Activity CRUD ──────────────────────────────────────────────────────
async function handleAdminActivity(uid, body, env, request, tokenPayload) {
  const userEmail = tokenPayload.email?.toLowerCase();
  
  if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
    throw new Error('Admin access required');
  }
  
  const { action, activityId, data } = body; // action: create, update, delete
  
  switch (action) {
    case 'list':
      return supabaseAdminRequest('GET', `activities?select=${ACTIVITY_SELECT}&order=display_order.asc`, null, env);
    case 'create':
      data.created_at = new Date().toISOString();
      data.updated_at = new Date().toISOString();
      return supabaseAdminRequest('POST', 'activities', data, env);
    case 'update':
      data.updated_at = new Date().toISOString();
      return supabaseAdminRequest('PATCH', `activities?id=eq.${activityId}`, data, env);
    case 'delete':
      // Delete tasks first
      await supabaseAdminRequest('DELETE', `tasks?activity_id=eq.${activityId}`, null, env);
      return supabaseAdminRequest('DELETE', `activities?id=eq.${activityId}`, null, env);
    default:
      throw new Error('Invalid action');
  }
}

// ─── Admin Task CRUD ──────────────────────────────────────────────────────────
async function handleAdminTask(uid, body, env, request, tokenPayload) {
  const userEmail = tokenPayload.email?.toLowerCase();
  
  if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
    throw new Error('Admin access required');
  }
  
  const { action, taskId, data } = body;
  
  switch (action) {
    case 'list': {
      const query = new URLSearchParams({
        select: TASK_SELECT_ADMIN,
        order: 'activity_id.asc,task_number.asc'
      });
      if (body.activityId) query.set('activity_id', `eq.${body.activityId}`);
      return supabaseAdminRequest('GET', `tasks?${query.toString()}`, null, env);
    }
    case 'create':
      data.created_at = new Date().toISOString();
      data.updated_at = new Date().toISOString();
      return supabaseAdminRequest('POST', 'tasks', data, env);
    case 'update':
      data.updated_at = new Date().toISOString();
      return supabaseAdminRequest('PATCH', `tasks?id=eq.${taskId}`, data, env);
    case 'delete':
      return supabaseAdminRequest('DELETE', `tasks?id=eq.${taskId}`, null, env);
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